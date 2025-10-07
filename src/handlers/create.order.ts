import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { createOrder, saveOrder } from '../services/product';
import { successResponse, errorResponse } from '../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    const { items, total, customerEmail, customerName } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('Order must contain at least one item', 400);
    }

    if (!total || !customerEmail || !customerName) {
      return errorResponse('Missing required fields', 400);
    }

    const order = createOrder({
      items,
      total,
      customerEmail,
      customerName,
      status: 'pending',
    });

    await saveOrder(order);

    return successResponse(order, 201);
  } catch (error) {
    console.error('Create order error:', error);
    return errorResponse('Internal server error', 500);
  }
};
