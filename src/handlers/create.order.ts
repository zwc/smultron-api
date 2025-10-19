import { ZodError } from 'zod';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { createOrder, saveOrder, getProduct, updateProduct } from '../services/product';
import { successResponse, errorResponse } from '../utils/response';
import {
  CreateOrderRequestSchema,
  CreateOrderResponseSchema,
} from '../schemas/handlers';

// Expose schemas for automated OpenAPI generation
export const requestSchema = CreateOrderRequestSchema;
export const responseSchema = CreateOrderResponseSchema;

export const method = 'POST';
export const route = '/orders';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    let validatedData;
    try {
      validatedData = CreateOrderRequestSchema.parse(JSON.parse(event.body));
    } catch (error) {
      if (error instanceof ZodError) {
        return errorResponse(
          `Validation error: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          400
        );
      }
      throw error;
    }

    const { information, cart, order: orderDetails } = validatedData;

    // Check stock availability and prepare stock updates
    const stockUpdates: Array<{ id: string; newStock: number }> = [];
    for (const item of cart) {
      const product = await getProduct(item.id);
      
      if (!product) {
        return errorResponse(`Product ${item.id} not found`, 404);
      }

      if (product.status !== 'active') {
        return errorResponse(`Product ${product.title || item.id} is not available`, 400);
      }

      if (product.stock < item.number) {
        return errorResponse(
          `Insufficient stock for ${product.title || item.id}. Available: ${product.stock}, Requested: ${item.number}`,
          400
        );
      }

      stockUpdates.push({
        id: item.id,
        newStock: product.stock - item.number,
      });
    }

    // Create order with frozen product data
    const order = await createOrder(
      information,
      cart,
      orderDetails.delivery,
      orderDetails.delivery_cost
    );

    console.log('Order created successfully:', order.id, order.number);

    // Save order
    await saveOrder(order);

    console.log('Order saved to database');

    // Update stock for all products
    await Promise.all(
      stockUpdates.map(({ id, newStock }) => 
        updateProduct(id, { stock: newStock })
      )
    );

    console.log('Stock updated for products');

  return successResponse(order, null, null, 201);
  } catch (error) {
    console.error('Create order error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return errorResponse('Internal server error', 500);
  }
};
