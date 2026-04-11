import { z } from 'zod'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import { verifyAuthToken } from '../middleware/auth'
import {
  createShipmentOption,
  saveShipmentOption,
} from '../services/shipment-option'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from '../utils/response'

export const method = 'POST'
export const route = '/v1/shipment-options'

const CreateShipmentOptionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  cost: z.number().nonnegative('Cost must be a non-negative number'),
})

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse()
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400)
    }

    const body = JSON.parse(event.body)

    let validatedData
    try {
      validatedData = CreateShipmentOptionSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse(
          `Validation error: ${error.issues.map((e) => e.message).join(', ')}`,
          400,
        )
      }
      throw error
    }

    const option = createShipmentOption(validatedData)
    await saveShipmentOption(option)

    return successResponse(option, null, null, 201)
  } catch (error) {
    console.error('Create shipment-option error:', error)
    return errorResponse('Internal server error', 500)
  }
}
