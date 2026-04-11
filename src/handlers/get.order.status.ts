import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import { getOrder } from '../services/product'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '../utils/response'

export const method = 'GET'
export const route = '/v1/order/status/{id}'

// Maps internal order status to a public-facing payment status string
const toPaymentStatus = (
  orderStatus: 'active' | 'inactive' | 'invalid',
): 'pending' | 'paid' | 'cancelled' => {
  if (orderStatus === 'active') return 'paid'
  if (orderStatus === 'invalid') return 'cancelled'
  return 'pending'
}

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIResponse> => {
  try {
    const id = event.pathParameters?.id
    if (!id) {
      return errorResponse('Order ID is required', 400)
    }

    const order = await getOrder(id)
    if (!order) {
      return notFoundResponse('Order')
    }

    return successResponse({
      orderId: order.id,
      orderNumber: order.number,
      status: toPaymentStatus(order.status),
    })
  } catch (error) {
    console.error('Get order status error:', error)
    return errorResponse('Internal server error', 500)
  }
}
