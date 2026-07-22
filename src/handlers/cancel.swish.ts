import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import { getOrder } from '../services/product'
import { cancelSwishPayment, updateSwishPaymentStatus } from '../services/swish'
import { cancelOrderReservations } from '../services/stock-reservation'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '../utils/response'
import { PAYMENT_STATUS_REASON } from '../utils/payment-status-reason'

export const method = 'PATCH'
export const route = '/cancel/{id}'

/**
 * Cancel an ongoing checkout/payment attempt.
 *
 * The {id} path parameter is the internal order ID returned by POST /checkout.
 * Cancels the Swish payment and stock reservations, and records the outcome on
 * the payments table. Does NOT change order.status — only an admin may mark an
 * order invalid.
 * A paid order (status=active) cannot be cancelled via this endpoint.
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

    // Paid orders cannot be cancelled here
    if (order.status === 'active') {
      return errorResponse('Cannot cancel a confirmed paid order', 409)
    }

    // Already manually invalidated — nothing left to cancel on the payment side
    if (order.status === 'invalid') {
      return successResponse({ id: orderId, status: 'CANCELLED' })
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

      await updateSwishPaymentStatus(order.swish_payment_id, {
        status: 'CANCELLED',
        reason: PAYMENT_STATUS_REASON.CHECKOUT_CANCELLED,
      })
    }

    // Release reserved stock — order stays pending/unpaid until admin acts
    await cancelOrderReservations(orderId)

    console.log('Payment cancelled for order (order status unchanged):', orderId)
    return successResponse({ id: orderId, status: 'CANCELLED' })
  } catch (error) {
    console.error('Cancel order error:', error)
    return errorResponse('Internal server error', 500)
  }
}
