import { ZodError, z } from 'zod';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { createOrder, saveOrder, getProduct, updateProduct } from '../services/product';
import { createSwishPayment } from '../services/swish';
import { successResponse, errorResponse } from '../utils/response';
import { OrderInformationSchema, OrderCartItemSchema } from '../schemas/order';

// Schema for the checkout request payload
const CheckoutRequestSchema = z.object({
  order: z.object({
    payment: z.enum(['swish', 'card', 'invoice']),
    delivery: z.string(),
    delivery_cost: z.number().min(0),
    name: z.string(),
    company: z.string().optional().default(''),
    address: z.string(),
    zip: z.string(),
    city: z.string(),
    email: z.string().email(),
    phone: z.string(),
  }),
  cart: z.array(OrderCartItemSchema),
});

// Response schema
const CheckoutResponseSchema = z.object({
  order: z.object({
    id: z.string(),
    number: z.string(),
    status: z.string(),
  }),
  payment: z.object({
    method: z.string(),
    status: z.string(),
    reference: z.string().optional(),
    swishUrl: z.string().optional(),
  }),
});

export const requestSchema = CheckoutRequestSchema;
export const responseSchema = CheckoutResponseSchema;

export const method = 'POST';
export const route = '/checkout';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    let validatedData;
    try {
      validatedData = CheckoutRequestSchema.parse(JSON.parse(event.body));
    } catch (error) {
      if (error instanceof ZodError) {
        return errorResponse(
          `Validation error: ${error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          400
        );
      }
      throw error;
    }

    const { order: orderData, cart } = validatedData;

    // Transform order data to match internal OrderInformation schema
    const information = {
      name: orderData.name,
      company: orderData.company || '',
      address: orderData.address,
      zip: orderData.zip,
      city: orderData.city,
      email: orderData.email,
      phone: orderData.phone,
    };

    // Validate cart items exist and have sufficient stock
    const stockUpdates: Array<{ id: string; newStock: number }> = [];
    let totalAmount = orderData.delivery_cost;

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

      // Calculate total amount (use item.price from cart or product.price as fallback)
      const itemPrice = item.price || product.price || 0;
      totalAmount += itemPrice * item.number;
    }

    console.log('Creating order with total amount:', totalAmount, 'SEK');

    // Create order
    const order = await createOrder(
      information,
      cart,
      orderData.delivery,
      orderData.delivery_cost
    );

    console.log('Order created:', order.id, order.number);

    // Save order to database
    await saveOrder(order);

    console.log('Order saved to database');

    // Update stock for all products
    await Promise.all(
      stockUpdates.map(({ id, newStock }) => 
        updateProduct(id, { stock: newStock })
      )
    );

    console.log('Stock updated for products');

    // Initialize payment based on payment method
    let paymentResponse = {
      method: orderData.payment,
      status: 'pending',
      reference: undefined as string | undefined,
      swishUrl: undefined as string | undefined,
    };

    if (orderData.payment === 'swish') {
      try {
        console.log('Initiating Swish payment for order:', order.number);
        
        const swishPayment = await createSwishPayment(
          order.number,
          totalAmount,
          orderData.phone,
          `Order ${order.number}`
        );

        paymentResponse = {
          method: 'swish',
          status: swishPayment.status.toLowerCase(),
          reference: swishPayment.id,
          swishUrl: swishPayment.location,
        };

        console.log('Swish payment created:', swishPayment.id);
      } catch (error) {
        console.error('Swish payment creation failed:', error);
        return errorResponse(
          'Order created but payment initialization failed. Please contact support.',
          500
        );
      }
    }

    const response = {
      order: {
        id: order.id,
        number: order.number,
        status: order.status,
      },
      payment: paymentResponse,
    };

    return successResponse(response, null, null, 201);
  } catch (error) {
    console.error('Checkout error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return errorResponse('Internal server error', 500);
  }
};
