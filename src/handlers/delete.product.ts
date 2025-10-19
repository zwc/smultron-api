import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { deleteProduct } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response';
import { CreateProductResponseSchema } from '../schemas/handlers';

export const responseSchema = CreateProductResponseSchema;

export const method = 'DELETE';
export const route = '/admin/products/{id}';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    const id = event.pathParameters?.id;
    
    if (!id) {
      return errorResponse('Product ID is required', 400);
    }

    await deleteProduct(id);

    return successResponse({ 
      message: 'Product deleted successfully',
      id: id
    });
  } catch (error) {
    console.error('Delete product error:', error);
    return errorResponse('Internal server error', 500);
  }
};
