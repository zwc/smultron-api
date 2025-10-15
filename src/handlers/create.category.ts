import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { createCategory, saveCategory } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    const { brand, title, subtitle = '', index, status = 'active' } = body;

    if (!brand || !title || index === undefined) {
      return errorResponse('Missing required fields', 400);
    }

    // Validate status if provided
    if (status && status !== 'active' && status !== 'inactive') {
      return errorResponse('Status must be either "active" or "inactive"', 400);
    }

    const category = createCategory({ brand, title, subtitle, index, status });
    await saveCategory(category);

    return successResponse(category, 201);
  } catch (error) {
    console.error('Create category error:', error);
    return errorResponse('Internal server error', 500);
  }
};
