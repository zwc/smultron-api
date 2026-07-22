import { ZodError, z } from 'zod'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import {
  createOrder,
  saveOrder,
  getProduct,
  updateOrder,
} from '../services/product'
import { getShipmentOptionByName } from '../services/shipment-option'
import { createSwishPayment } from '../services/swish'
import { SwishPaymentError } from '../integrations/swish/index'
import {
  reserveStock,
  cancelOrderReservations,
} from '../services/stock-reservation'
import { successResponse, errorResponse } from '../utils/response'
import { OrderInformationSchema } from '../schemas/order'

// Cart input: only id + quantity — prices are always read from the database
const CheckoutCartItemSchema = z.object({
  id: z.string(),
  number: z.number().int().min(1),
})

// Schema for the checkout request payload
const CheckoutRequestSchema = z.object({
  order: z.object({
    payment: z.enum(['swish', 'card', 'invoice']),
    // Name of the shipment option (e.g. "postnord"). Required only when an address is supplied.
    delivery: z.string().optional().default(''),
    orderId: z.string().optional(),
    name: z.string(),
    company: z.string().optional().default(''),
    address: z.string().optional().default(''),
    zip: z.string().optional().default(''),
    city: z.string().optional().default(''),
    email: z.string().email(),
    phone: z.string(),
  }),
  cart: z.array(CheckoutCartItemSchema),
})

// Response schema
const CheckoutResponseSchema = z.object({
  order: z.object({
    id: z.string(),
    // null until payment is confirmed; the frontend should poll /v1/order/status/{id}
    number: z.string().nullable(),
    status: z.string(),
  }),
  payment: z.object({
    method: z.string(),
    status: z.string(),
    // Total SEK sent to Swish (cart + delivery)
    amount: z.number().optional(),
    reference: z.string().optional(),
    swishUrl: z.string().optional(),
  }),
})

export const requestSchema = CheckoutRequestSchema
export const responseSchema = CheckoutResponseSchema

export const method = 'POST'
export const route = '/checkout'

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIResponse> => {
  try {
    if (!event.body) {
      return errorResponse('Request body is required', 400)
    }

    let validatedData
    try {
      validatedData = CheckoutRequestSchema.parse(JSON.parse(event.body))
    } catch (error) {
      if (error instanceof SyntaxError) {
        return errorResponse('Invalid JSON in request body', 400)
      }
      if (error instanceof ZodError) {
        return errorResponse(
          `Validation error: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          400,
        )
      }
      throw error
    }

    const { order: orderData, cart } = validatedData

    // Transform order data to match internal OrderInformation schema
    const information = {
      name: orderData.name,
      company: orderData.company || '',
      address: orderData.address || '',
      zip: orderData.zip || '',
      city: orderData.city || '',
      email: orderData.email,
      phone: orderData.phone,
    }

    // Determine shipping cost:
    // - Only charged when the customer has provided a delivery address
    // - Cost is looked up from the shipment-options table by delivery name
    const hasAddress = Boolean(
      orderData.address && orderData.zip && orderData.city,
    )

    let deliveryCost = 0
    if (hasAddress && orderData.delivery) {
      const shipmentOption = await getShipmentOptionByName(orderData.delivery)
      if (!shipmentOption) {
        return errorResponse(
          `Shipment option "${orderData.delivery}" not found`,
          400,
        )
      }
      deliveryCost = shipmentOption.cost
    }

    // Step 1: Validate cart items exist and calculate total from DB prices only
    let totalAmount = deliveryCost
    const cartItems = []

    for (const item of cart) {
      const product = await getProduct(item.id)

      if (!product) {
        return errorResponse(`Product ${item.id} not found`, 404, {
          errorCode: 'PRODUCT_NOT_FOUND',
          productId: item.id,
        })
      }

      if (product.status !== 'active') {
        return errorResponse(
          `Product ${product.title || item.id} is not available`,
          400,
          {
            errorCode: 'PRODUCT_UNAVAILABLE',
            productId: item.id,
          },
        )
      }

      // Always use the DB price — never the client-supplied price
      totalAmount += product.price * item.number

      cartItems.push({
        id: item.id,
        quantity: item.number,
      })
    }

    console.log('Cart validated. Total amount:', totalAmount, 'SEK')

    // Step 2: Create order (pending, no order number yet)
    const order = await createOrder(
      information,
      cart,
      orderData.delivery,
      deliveryCost,
      orderData.orderId,
    )

    console.log('Order created:', order.id, '(number pending payment confirmation)')

    // Step 3: Reserve stock for 5 minutes
    let reservationIds: string[] = []
    try {
      reservationIds = await reserveStock(order.id, cartItems)
      console.log(
        'Stock reserved for order:',
        order.id,
        'Reservations:',
        reservationIds,
      )
    } catch (error) {
      console.error('Stock reservation failed:', error)
      return errorResponse(
        error instanceof Error ? error.message : 'Insufficient stock available',
        200,
        { errorCode: 'INSUFFICIENT_STOCK' },
      )
    }

    // Step 4: Save order to database (pending until payment confirmed, no order number)
    await saveOrder(order)
    console.log('Order saved to database with stock reservations')

    // Step 5: Initialize payment based on payment method
    let orderStatus = order.status
    let paymentResponse = {
      method: orderData.payment,
      status: 'pending',
      amount: totalAmount,
      reference: undefined as string | undefined,
      swishUrl: undefined as string | undefined,
    }

    if (orderData.payment === 'swish') {
      try {
        // Strip hyphens from UUID so it fits within Swish's 35-character limit
        // (UUID with hyphens = 36 chars; without hyphens = 32 chars).
        // The callback reconstructs the UUID to look up the order by partition key.
        const swishRef = order.id.replace(/-/g, '')
        console.log('Initiating Swish payment for order:', order.id)

        const swishPayment = await createSwishPayment(
          swishRef,
          totalAmount,
          orderData.phone,
          `Minibutik`,
        )

        // Persist the Swish instruction ID and mark order as unpaid (payment initiated)
        await updateOrder(order.id, { swish_payment_id: swishPayment.id, status: 'unpaid' })
        orderStatus = 'unpaid'

        paymentResponse = {
          method: 'swish',
          status: swishPayment.status.toLowerCase(),
          amount: totalAmount,
          reference: swishPayment.id,
          swishUrl: swishPayment.location,
        }

        console.log('Swish payment created:', swishPayment.id)
      } catch (error) {
        console.error('Swish payment creation failed:', error)

        // Cancel stock reservations on payment failure
        try {
          await cancelOrderReservations(order.id)
          console.log('Stock reservations cancelled due to payment failure')
        } catch (reservationError) {
          console.error(
            'Failed to cancel stock reservations:',
            reservationError,
          )
        }

        if (error instanceof SwishPaymentError && error.errors.length > 0) {
          const { errorCode, errorMessage, additionalInformation } =
            error.errors[0]
          return errorResponse('Swish payment failed', 200, {
            errorCode,
            errorMessage,
            additionalInformation,
          })
        }

        return errorResponse(
          'Payment initialization failed. Please try again.',
          500,
        )
      }
    }

    const response = {
      order: {
        id: order.id,
        // null at this point — the number is assigned only after payment is confirmed
        number: order.number,
        status: orderStatus,
      },
      payment: paymentResponse,
    }

    return successResponse(response, null, null, 201)
  } catch (error) {
    console.error('Checkout error:', error)
    console.error(
      'Error stack:',
      error instanceof Error ? error.stack : 'No stack trace',
    )
    return errorResponse('Internal server error', 500)
  }
}
