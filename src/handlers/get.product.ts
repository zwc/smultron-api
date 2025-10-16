import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { getProductBySlug } from '../services/product';
import { successResponse, errorResponse, notFoundResponse } from '../utils/response';
import { stripProductId } from '../utils/transform';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    const slug = event.pathParameters?.slug;
    
    if (!slug) {
      return errorResponse('Product slug is required', 400);
    }

    const product = await getProductBySlug(slug);
    
    if (!product) {
      return notFoundResponse('Product');
    }

    return successResponse({ data: stripProductId(product) });
  } catch (error) {
    console.error('Get product error:', error);
    return errorResponse('Internal server error', 500);
  }
};
