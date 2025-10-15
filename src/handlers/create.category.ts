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
    const { brand, title, subtitle = '', index, active = true } = body;

    if (!brand || !title || index === undefined) {
      return errorResponse('Missing required fields', 400);
    }

    // Validate active is boolean if provided
    if (typeof active !== 'boolean') {
      return errorResponse('Active must be a boolean', 400);
    }

    const category = createCategory({ brand, title, subtitle, index, active });
    await saveCategory(category);

    return successResponse(category, 201);
  } catch (error) {
    console.error('Create category error:', error);
    return errorResponse('Internal server error', 500);
  }
};
