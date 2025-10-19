import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { getProduct, getAllCategories } from '../services/product';
import { successResponse, errorResponse, notFoundResponse } from '../utils/response';
import { formatProduct } from '../utils/transform';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    const id = event.pathParameters?.id;
    
    if (!id) {
      return errorResponse('Product ID is required', 400);
    }

    // Get product and categories in parallel
    const [product, allCategories] = await Promise.all([
      getProduct(id),
      getAllCategories('active')
    ]);
    
    if (!product) {
      return notFoundResponse('Product');
    }

    // Sort categories by index and map to simplified format
    const categories = allCategories
      .sort((a, b) => a.index - b.index)
      .map(cat => ({
        id: cat.id,
        slug: cat.slug,
        title: cat.title
      }));

  return successResponse(formatProduct(product));
  } catch (error) {
    console.error('Get product error:', error);
    return errorResponse('Internal server error', 500);
  }
};
