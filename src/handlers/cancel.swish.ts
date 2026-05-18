import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import { getOrder, updateOrder } from '../services/product'
import { cancelSwishPayment } from '../services/swish'
import { cancelOrderReservations } from '../services/stock-reservation'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '../utils/response'

export const method = 'PATCH'
export const route = '/cancel/{id}'

/**
 * Cancel an ongoing checkout/payment attempt.
 *
 * The {id} path parameter is the internal order ID returned by POST /checkout.
 * Idempotent: if the order is already cancelled (status=cancelled) the endpoint
 * returns success without performing any additional side effects.
 * A successful order (status=successful) cannot be cancelled via this endpoint.
 */
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

    // Idempotency: already cancelled → success with no side effects
    if (order.status === 'cancelled') {
      return successResponse({ id: orderId, status: 'CANCELLED' })
    }

    // Successful orders cannot be cancelled here
    if (order.status === 'successful') {
      return errorResponse('Cannot cancel a confirmed paid order', 409)
    }

    // Cancel the Swish payment if one was created for this order.
    // Errors are caught and logged but do not fail the cancellation — the Swish
    // payment may have already expired or been cancelled by the provider.
    if (order.swish_payment_id) {
      try {
        await cancelSwishPayment(order.swish_payment_id)
        console.log(
          'Swish payment cancelled:',
          order.swish_payment_id,
          'for order:',
          orderId,
        )
      } catch (swishError) {
        console.warn(
          'Swish cancellation failed (payment may already be expired/cancelled):',
          swishError,
        )
      }
    }

    // Release reserved stock
    await cancelOrderReservations(orderId)

    // Mark the order as cancelled — no order number is assigned
    await updateOrder(orderId, { status: 'cancelled' })

    console.log('Order cancelled:', orderId)
    return successResponse({ id: orderId, status: 'CANCELLED' })
  } catch (error) {
    console.error('Cancel order error:', error)
    return errorResponse('Internal server error', 500)
  }
}
