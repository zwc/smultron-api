import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import { cancelSwishPayment } from '../services/swish'
import { successResponse, errorResponse } from '../utils/response'

export const method = 'PATCH'
export const route = '/cancel/{id}'

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIResponse> => {
  try {
    const id = event.pathParameters?.id
    if (!id) {
      return errorResponse('Payment ID is required', 400)
    }

    await cancelSwishPayment(id)

    return successResponse({ id, status: 'CANCELLED' })
  } catch (error) {
    console.error('Cancel Swish payment error:', error)
    return errorResponse('Internal server error', 500)
  }
}
