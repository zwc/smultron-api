import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { getAllOrders } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    const orders = await getAllOrders();
    return successResponse(orders);
  } catch (error) {
    console.error('List orders error:', error);
    return errorResponse('Internal server error', 500);
  }
};
