import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { getCategoryBySlug, deleteCategory } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    const slug = event.pathParameters?.slug;
    
    if (!slug) {
      return errorResponse('Category slug is required', 400);
    }

    // Get the category by slug to find its internal ID
    const category = await getCategoryBySlug(slug);
    if (!category) {
      return notFoundResponse('Category');
    }

    await deleteCategory(category.id);

    return successResponse(null, 204);
  } catch (error) {
    console.error('Delete category error:', error);
    return errorResponse('Internal server error', 500);
  }
};
