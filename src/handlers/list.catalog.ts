import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { getAllCategories, getActiveProducts } from '../services/product';
import { successResponse, errorResponse } from '../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    // Fetch both categories and products in parallel for better performance
    // Only return active products and categories for public catalog
    const [categories, products] = await Promise.all([
      getAllCategories('active'),
      getActiveProducts()
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
