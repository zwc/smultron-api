import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import { verifyAuthToken } from '../middleware/auth'
import { deleteShipmentOption } from '../services/shipment-option'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from '../utils/response'

export const method = 'DELETE'
export const route = '/v1/shipment-options/{id}'

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse()
    }

    const id = event.pathParameters?.id
    if (!id) {
      return errorResponse('Shipment option ID is required', 400)
    }

    await deleteShipmentOption(id)

    return successResponse({
      message: 'Shipment option deleted successfully',
      id,
    })
  } catch (error) {
    console.error('Delete shipment-option error:', error)
    return errorResponse('Internal server error', 500)
  }
}
