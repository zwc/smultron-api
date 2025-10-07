import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { getOrder } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '../utils/response';

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

    return successResponse(order);
  } catch (error) {
    console.error('Get order error:', error);
    return errorResponse('Internal server error', 500);
  }
};
