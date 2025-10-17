import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { updateProduct } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response';
import { stripProductId } from '../utils/transform';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    const id = event.pathParameters?.id;
    
    if (!id) {
      return errorResponse('Product ID is required', 400);
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    
    // Filter out protected fields that cannot be updated
    const { id: _id, slug: _slug, createdAt: _createdAt, updatedAt: _updatedAt, ...updates } = body;
    
    const updatedProduct = await updateProduct(id, updates);

    return successResponse({ data: stripProductId(updatedProduct) });
  } catch (error) {
    console.error('Update product error:', error);
    return errorResponse('Internal server error', 500);
  }
};
