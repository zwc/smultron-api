import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { updateCategory } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response';
import { formatCategory } from '../utils/transform';

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
    
    // Validate status field if provided
    if ('status' in updates && updates.status !== 'active' && updates.status !== 'inactive') {
      return errorResponse('Status must be either "active" or "inactive"', 400);
    }
    
    const updatedCategory = await updateCategory(id, updates);

    return successResponse({ data: formatCategory(updatedCategory) });
  } catch (error) {
    console.error('Update category error:', error);
    return errorResponse('Internal server error', 500);
  }
};
