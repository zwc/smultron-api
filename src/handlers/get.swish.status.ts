import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import { getSwishPaymentStatus } from '../services/swish'
import {
  successResponse,
  errorResponse,
  notFoundResponse,
} from '../utils/response'

export const method = 'GET'
export const route = '/swish/status/{id}'

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIResponse> => {
  try {
    const id = event.pathParameters?.id
    if (!id) {
      return errorResponse('Payment ID is required', 400)
    }

    const status = await getSwishPaymentStatus(id)

    if (!status) {
      return notFoundResponse('Payment')
    }

    return successResponse(status)
  } catch (error) {
    console.error('Get Swish status error:', error)
    return errorResponse('Internal server error', 500)
  }
}
