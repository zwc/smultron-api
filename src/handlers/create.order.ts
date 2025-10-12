import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse, CartItem, OrderDetails } from '../types';
import { createOrder, saveOrder, getProduct, updateProduct } from '../services/product';
import { successResponse, errorResponse } from '../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    const { cart, order: orderDetails } = body;

    // Validate cart
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return errorResponse('Order must contain at least one item in cart', 400);
    }

    // Validate required cart item fields
    for (const item of cart) {
      if (!item.id || typeof item.price !== 'number' || typeof item.number !== 'number' || item.number < 1) {
        return errorResponse('Each cart item must have id, price, and number (quantity >= 1)', 400);
      }
    }

    // Validate order details
    if (!orderDetails || !orderDetails.name || !orderDetails.address || 
        !orderDetails.zip || !orderDetails.city || !orderDetails.phone || 
        !orderDetails.delivery || !orderDetails.payment) {
      return errorResponse('Missing required order details (name, address, zip, city, phone, delivery, payment)', 400);
    }

    // Calculate total from cart
    const total = cart.reduce((sum: number, item: CartItem) => sum + (item.price * item.number), 0);

    // Check stock availability and prepare stock updates
    const stockUpdates: Array<{ id: string; newStock: number }> = [];
    for (const item of cart) {
      const product = await getProduct(item.id);
      
      if (!product) {
        return errorResponse(`Product ${item.id} not found`, 404);
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

    // Create order
    const order = createOrder({
      cart,
      order: orderDetails,
      total,
      status: 'pending',
    });

    // Save order
    await saveOrder(order);

    // Update stock for all products
    await Promise.all(
      stockUpdates.map(({ id, newStock }) => 
        updateProduct(id, { stock: newStock })
      )
    );

    return successResponse(order, 201);
  } catch (error) {
    console.error('Create order error:', error);
    return errorResponse('Internal server error', 500);
  }
};
