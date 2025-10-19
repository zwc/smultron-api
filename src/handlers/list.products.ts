import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { getActiveProducts } from '../services/product';
import { successResponse, errorResponse } from '../utils/response';
import { ListProductsResponseSchema } from '../schemas/handlers';

export const responseSchema = ListProductsResponseSchema;

export const method = 'GET';
export const route = '/products';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    // Only return active products for public endpoint
    const products = await getActiveProducts();
  return successResponse(products);
  } catch (error) {
    console.error('List products error:', error);
    return errorResponse('Internal server error', 500);
  }
};
