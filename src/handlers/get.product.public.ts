import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { getProduct, getAllCategories } from '../services/product';
import { successResponse, errorResponse, notFoundResponse, unauthorizedResponse } from '../utils/response';
import { verifyAuthToken } from '../middleware/auth';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    // Verify authentication for admin endpoint
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    const id = event.pathParameters?.id;
    
    if (!id) {
      return errorResponse('Product ID is required', 400);
    }

    const product = await getProduct(id);
    
    if (!product) {
      return notFoundResponse('Product');
    }

    // Get all active categories (for dropdown/selection)
    const allCategories = await getAllCategories('active');
    
    // Format categories as simple objects with title and id
    const categories = allCategories.map(cat => ({
      title: cat.title,
      id: cat.id
    }));

    // Construct the response with categories first, then product fields
    const response = {
      categories,
      status: product.status,
      id: product.id,
      category: product.category,
      title: product.title,
      subtitle: product.subtitle,
      brand: product.brand,
      price: product.price,
      stock: product.stock,
      description: product.description,
      image: product.image,
      images: product.images
    };

    return successResponse(response);
  } catch (error) {
    console.error('Get product error:', error);
    return errorResponse('Internal server error', 500);
  }
};
