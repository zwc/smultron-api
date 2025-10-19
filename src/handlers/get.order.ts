import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { getOrder } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '../utils/response';
import { GetOrderResponseSchema } from '../schemas/handlers';

export const responseSchema = GetOrderResponseSchema;

export const method = 'GET';
export const route = '/admin/orders/{id}';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    const id = event.pathParameters?.id;
    
    if (!id) {
      return errorResponse('Order ID is required', 400);
    }

    const order = await getOrder(id);
    
    if (!order) {
      return notFoundResponse('Order');
    }

  return successResponse(order, { total: 1 });
  } catch (error) {
    console.error('Get order error:', error);
    return errorResponse('Internal server error', 500);
  }
};
