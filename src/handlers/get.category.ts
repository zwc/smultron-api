import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { getCategoryBySlug } from '../services/product';
import { successResponse, errorResponse, notFoundResponse, unauthorizedResponse } from '../utils/response';
import { verifyAuthToken } from '../middleware/auth';
import { stripCategoryId } from '../utils/transform';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    // Verify authentication for admin endpoint
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    const slug = event.pathParameters?.slug;
    
    if (!slug) {
      return errorResponse('Category slug is required', 400);
    }

    const category = await getCategoryBySlug(slug);
    
    if (!category) {
      return notFoundResponse('Category');
    }

    return successResponse({ data: stripCategoryId(category) });
  } catch (error) {
    console.error('Get category error:', error);
    return errorResponse('Internal server error', 500);
  }
};
