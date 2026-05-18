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
      status: order.status,
    })
  } catch (error) {
    console.error('Get order status error:', error)
    return errorResponse('Internal server error', 500)
  }
}
