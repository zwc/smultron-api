import { ZodError, z } from 'zod'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import {
  createOrder,
  saveOrder,
  getProduct,
  updateProduct,
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
    number: z.string(),
    status: z.string(),
  }),
  payment: z.object({
    method: z.string(),
    status: z.string(),
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
        return errorResponse(`Product ${item.id} not found`, 404)
      }

      if (product.status !== 'active') {
        return errorResponse(
          `Product ${product.title || item.id} is not available`,
          400,
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

    // Step 2: Create order (with pending status)
    const order = await createOrder(
      information,
      cart,
      orderData.delivery,
      deliveryCost,
    )

    console.log('Order created:', order.id, order.number)

    // Step 3: Reserve stock for 10 minutes
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
        400,
      )
    }

    // Step 4: Save order to database with reservation info
    const orderWithReservations = {
      ...order,
      status: 'inactive' as const, // Order is inactive until payment is confirmed
    }

    await saveOrder(orderWithReservations)
    console.log('Order saved to database with stock reservations')

    // Step 5: Initialize payment based on payment method
    let paymentResponse = {
      method: orderData.payment,
      status: 'pending',
      reference: undefined as string | undefined,
      swishUrl: undefined as string | undefined,
    }

    if (orderData.payment === 'swish') {
      try {
        console.log('Initiating Swish payment for order:', order.number)

        const swishPayment = await createSwishPayment(
          order.number,
          totalAmount,
          orderData.phone,
          `Order ${order.number}`,
        )

        paymentResponse = {
          method: 'swish',
          status: swishPayment.status.toLowerCase(),
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
        number: order.number,
        status: order.status,
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
