import { z } from 'zod';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { createCategory, saveCategory } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response';
import { formatCategory } from '../utils/transform';

// Request body validation schema
const CreateCategorySchema = z.object({
  slug: z.string().min(1, 'Slug is required'),
  title: z.string().min(1, 'Title is required'),
  brand: z.string().default(''),
  subtitle: z.string().default(''),
  index: z.number().int().min(0, 'Index must be a non-negative integer').default(999),
  status: z.enum(['active', 'inactive']).default('active')
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);

    // Validate request body with Zod
    let validatedData;
    try {
      validatedData = CreateCategorySchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse(
          `Validation error: ${error.issues.map((e) => e.message).join(', ')}`,
          400
        );
      }
      throw error;
    }

    const category = createCategory(validatedData);
    await saveCategory(category);

  return successResponse(formatCategory(category), null, null, 201);
  } catch (error) {
    console.error('Create category error:', error);
    return errorResponse('Internal server error', 500);
  }
};
