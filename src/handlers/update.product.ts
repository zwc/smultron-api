import { z } from 'zod'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import { verifyAuthToken } from '../middleware/auth'
import { updateProduct } from '../services/product'
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from '../utils/response'
import { formatProduct } from '../utils/transform'

// Request body validation schema for updating products
import {
  UpdateProductRequestSchema,
  CreateProductResponseSchema,
} from '../schemas/handlers'

export const requestSchema = UpdateProductRequestSchema
export const responseSchema = CreateProductResponseSchema

export const method = 'PUT'
export const route = '/admin/products/{id}'
const UpdateProductSchema = z
  .object({
    slug: z.string().min(1).optional(),
    category: z.string().optional(),
    categorySlug: z.string().optional(),
    article: z.string().optional(),
    brand: z.string().optional(),
    title: z.string().min(1).optional(),
    subtitle: z.string().optional(),
    price: z.number().min(0).optional(),
    price_reduced: z.number().min(0).optional(),
    description: z.array(z.string()).optional(),
    tag: z.string().optional(),
    index: z.number().int().min(0).optional(),
    stock: z.number().int().min(0).optional(),
    max_order: z.number().int().min(1).optional(),
    image: z.string().optional(),
    images: z.array(z.string()).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .strict() // Reject unknown fields

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse()
    }

    const id = event.pathParameters?.id

    if (!id) {
      return errorResponse('Product ID is required', 400)
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400)
    }

    const body = JSON.parse(event.body)

    // Filter out protected fields that cannot be updated (id, createdAt, updatedAt are managed by the system)
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...updates
    } = body

    // Validate request body with Zod
    let validatedData
    try {
      validatedData = UpdateProductSchema.parse(updates)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse(
          `Validation error: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          400,
        )
      }
      throw error
    }

    const normalizedUpdates = {
      ...validatedData,
      category: validatedData.category ?? validatedData.categorySlug,
    }
    const { categorySlug: _categorySlug, ...persistedUpdates } =
      normalizedUpdates

    const updatedProduct = await updateProduct(id, persistedUpdates)

    return successResponse(formatProduct(updatedProduct))
  } catch (error) {
    console.error('Update product error:', error)
    return errorResponse('Internal server error', 500)
  }
}
