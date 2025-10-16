import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { getProductBySlug, deleteProduct } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    const slug = event.pathParameters?.slug;
    
    if (!slug) {
      return errorResponse('Product slug is required', 400);
    }

    // Get the product by slug to find its internal ID
    const product = await getProductBySlug(slug);
    if (!product) {
      return notFoundResponse('Product');
    }

    await deleteProduct(product.id);

    return successResponse(null, 204);
  } catch (error) {
    console.error('Delete product error:', error);
    return errorResponse('Internal server error', 500);
  }
};
