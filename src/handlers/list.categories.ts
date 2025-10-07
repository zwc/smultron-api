import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { getAllCategories } from '../services/product';
import { successResponse, errorResponse } from '../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    const categories = await getAllCategories();
    return successResponse(categories);
  } catch (error) {
    console.error('List categories error:', error);
    return errorResponse('Internal server error', 500);
  }
};
