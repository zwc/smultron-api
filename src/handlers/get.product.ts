import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { getProduct } from '../services/product';
import { successResponse, errorResponse, notFoundResponse } from '../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    const id = event.pathParameters?.id;
    
    if (!id) {
      return errorResponse('Product ID is required', 400);
    }

    const product = await getProduct(id);
    
    if (!product) {
      return notFoundResponse('Product');
    }

    return successResponse(product);
  } catch (error) {
    console.error('Get product error:', error);
    return errorResponse('Internal server error', 500);
  }
};
