import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { getAllCategories, getAllProducts } from '../services/product';
import { successResponse, errorResponse } from '../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    // Fetch both categories and products in parallel for better performance
    const [categories, products] = await Promise.all([
      getAllCategories(),
      getAllProducts()
    ]);

    return successResponse({
      categories,
      products
    });
  } catch (error) {
    console.error('List catalog error:', error);
    return errorResponse('Internal server error', 500);
  }
};
