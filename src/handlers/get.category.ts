import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { getCategory } from '../services/product';
import { successResponse, errorResponse, notFoundResponse } from '../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    const id = event.pathParameters?.id;
    
    if (!id) {
      return errorResponse('Category ID is required', 400);
    }

    const category = await getCategory(id);
    
    if (!category) {
      return notFoundResponse('Category');
    }

    return successResponse(category);
  } catch (error) {
    console.error('Get category error:', error);
    return errorResponse('Internal server error', 500);
  }
};
