import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import { getAllShipmentOptions } from '../services/shipment-option'
import { successResponse, errorResponse } from '../utils/response'

export const method = 'GET'
export const route = '/v1/shipment-options'

export const handler = async (
  _event: APIGatewayProxyEvent,
): Promise<APIResponse> => {
  try {
    const options = await getAllShipmentOptions()
    return successResponse(options)
  } catch (error) {
    console.error('List shipment-options error:', error)
    return errorResponse('Internal server error', 500)
  }
}
