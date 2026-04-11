import { z } from 'zod'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import { verifyAuthToken } from '../middleware/auth'
import {
  getShipmentOption,
  updateShipmentOption,
} from '../services/shipment-option'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
} from '../utils/response'

export const method = 'PATCH'
export const route = '/v1/shipment-options/{id}'

const UpdateShipmentOptionSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    cost: z.number().nonnegative().optional(),
  })
  .strict()

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

    if (!event.body) {
      return errorResponse('Request body is required', 400)
    }

    const body = JSON.parse(event.body)
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...updates
    } = body

    let validatedData
    try {
      validatedData = UpdateShipmentOptionSchema.parse(updates)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse(
          `Validation error: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          400,
        )
      }
      throw error
    }

    const existing = await getShipmentOption(id)
    if (!existing) {
      return notFoundResponse('Shipment option')
    }

    const updated = await updateShipmentOption(id, validatedData)
    return successResponse(updated)
  } catch (error) {
    console.error('Update shipment-option error:', error)
    return errorResponse('Internal server error', 500)
  }
}
