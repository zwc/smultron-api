import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { updateCategory } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response';

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

    const updates = JSON.parse(event.body);
    const updatedCategory = await updateCategory(id, updates);

    return successResponse(updatedCategory);
  } catch (error) {
    console.error('Update category error:', error);
    return errorResponse('Internal server error', 500);
  }
};
