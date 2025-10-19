import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { getAllOrders, getOrder } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '../utils/response';
import { ListOrdersResponseSchema } from '../schemas/handlers';

export const responseSchema = ListOrdersResponseSchema;

export const method = 'GET';
export const route = '/admin/orders';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    // Allow fetching a single order via query param ?id= (some callers use this)
    const qs = event.queryStringParameters || {};
    const id = qs.id;

    if (id) {
      const order = await getOrder(id);
      if (!order) return notFoundResponse('Order');
      return successResponse(order, { total: 1 });
    }

    const orders = await getAllOrders();
    return successResponse(orders, { total: orders.length });
  } catch (error) {
    console.error('List orders error:', error);
    return errorResponse('Internal server error', 500);
  }
};
