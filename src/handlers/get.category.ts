import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { getCategory } from '../services/product';
import { successResponse, errorResponse, notFoundResponse, unauthorizedResponse } from '../utils/response';
import { verifyAuthToken } from '../middleware/auth';
import { formatCategory } from '../utils/transform';
import { GetCategoryResponseSchema } from '../schemas/handlers';

export const responseSchema = GetCategoryResponseSchema;
export const method = 'GET';
export const route = '/admin/categories/{id}';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    // Verify authentication for admin endpoint
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    const id = event.pathParameters?.id;
    
    if (!id) {
      return errorResponse('Category ID is required', 400);
    }

    const category = await getCategory(id);
    
    if (!category) {
      return notFoundResponse('Category');
    }

  return successResponse(formatCategory(category));
  } catch (error) {
    console.error('Get category error:', error);
    return errorResponse('Internal server error', 500);
  }
};
