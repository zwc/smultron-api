/**
 * TEST-ONLY ENDPOINT — REMOVE BEFORE LAUNCH
 *
 * Force-confirms an order as paid, bypassing Swish entirely.
 * Runs the exact same flow as a PAID Swish callback so the full
 * confirmation pipeline (stock reduction, order number, emails) is exercised.
 *
 * No authentication required — this endpoint is intentionally open.
 */
import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import { getOrder, updateOrder, assignOrderNumber } from '../services/product'
import { confirmOrderReservations } from '../services/stock-reservation'
import {
  sendOrderConfirmationEmails,
  type OrderConfirmationData,
} from '../services/email'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '../utils/response'

export const method = 'POST'
export const route = '/test/confirm-payment/{id}'

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIResponse> => {
  try {
    const orderId = event.pathParameters?.id
    if (!orderId) {
      return errorResponse('Order ID is required', 400)
    }

    const order = await getOrder(orderId)
    if (!order) {
      return notFoundResponse('Order')
    }

    if (order.status === 'successful') {
      return successResponse({
        orderId,
        orderNumber: order.number,
        message: 'Order already confirmed',
      })
    }

    console.log(`[TEST] Force-confirming order ${orderId} as paid`)

    await confirmOrderReservations(order.id)

    const orderNumber = await assignOrderNumber(order.id)

    await updateOrder(order.id, { status: 'successful' })

    const emailData = buildEmailData({ ...order, number: orderNumber })
    await sendOrderConfirmationEmails(emailData)

    console.log(
      `[TEST] Order ${orderId} force-confirmed with number ${orderNumber}`,
    )

    return successResponse({
      orderId,
      orderNumber,
      message: 'Order confirmed as paid (test override)',
    })
  } catch (error) {
    console.error('[TEST] Force-confirm error:', error)
    return errorResponse('Internal server error', 500)
  }
}

const buildEmailData = (order: any): OrderConfirmationData => {
  const cartTotal = order.cart.reduce(
    (sum: number, item: any) => sum + (item.price || 0) * item.number,
    0,
  )
  return {
    orderId: order.number,
    customerName: order.information.name,
    customerEmail: order.information.email,
    customerPhone: order.information.phone,
    orderTotal: cartTotal + (order.delivery_cost || 0),
    currency: 'SEK',
    cartItems: order.cart.map((item: any) => ({
      name: item.title || 'Unknown Product',
      quantity: item.number,
      price: item.price || 0,
    })),
    deliveryMethod: order.delivery,
    deliveryCost: order.delivery_cost || 0,
    paymentMethod: 'swish',
    paymentReference: 'test-override',
    deliveryAddress: order.information.address
      ? {
          company: order.information.company,
          address: order.information.address,
          zip: order.information.zip,
          city: order.information.city,
        }
      : undefined,
  }
}
