import { z } from 'zod';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { updateCategory } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response';
import { formatCategory } from '../utils/transform';

// Request body validation schema for updating categories
const UpdateCategorySchema = z.object({
  slug: z.string().min(1).optional(),
  brand: z.string().optional(),
  title: z.string().min(1).optional(),
  subtitle: z.string().optional(),
  index: z.number().int().min(0).optional(),
  status: z.enum(['active', 'inactive']).optional()
}).strict(); // Reject unknown fields

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    const id = event.pathParameters?.id;
    
    if (!id) {
      return errorResponse('Category ID is required', 400);
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    
    // Filter out protected fields that cannot be updated (id, createdAt, updatedAt are managed by the system)
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...updates } = body;
    
    // Validate request body with Zod
    let validatedData;
    try {
      validatedData = UpdateCategorySchema.parse(updates);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse(
          `Validation error: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          400
        );
      }
      throw error;
    }
    
    const updatedCategory = await updateCategory(id, validatedData);

  return successResponse(formatCategory(updatedCategory));
  } catch (error) {
    console.error('Update category error:', error);
    return errorResponse('Internal server error', 500);
  }
};
