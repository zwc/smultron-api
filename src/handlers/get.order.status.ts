import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import { getOrder } from '../services/product'
import { cleanupExpiredReservations } from '../services/stock-reservation'
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
    try {
      await cleanupExpiredReservations()
    } catch (cleanupError) {
      console.error('Failed to cleanup expired reservations:', cleanupError)
    }

    const id = event.pathParameters?.id
    if (!id) {
      return errorResponse('Order ID is required', 400)
    }

    const order = await getOrder(id)
    if (!order) {
      return notFoundResponse('Order')
    }

    return successResponse(order)
  } catch (error) {
    console.error('Get order status error:', error)
    return errorResponse('Internal server error', 500)
  }
}
