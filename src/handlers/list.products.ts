import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { getAllProducts } from '../services/product';
import { successResponse, errorResponse } from '../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    const products = await getAllProducts();
    return successResponse(products);
  } catch (error) {
    console.error('List products error:', error);
    return errorResponse('Internal server error', 500);
  }
};
