import { z } from 'zod';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { updateOrderStatus } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response';

// Zod validation schema
const UpdateOrderStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'invalid'], {
    message: "Status must be 'active', 'inactive', or 'invalid'"
  })
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    const id = event.pathParameters?.id;
    
    if (!id) {
      return errorResponse('Order ID is required', 400);
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);

    // Validate request body with Zod
    let validatedData;
    try {
      validatedData = UpdateOrderStatusSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse(
          `Validation error: ${error.issues.map((e) => e.message).join(', ')}`,
          400
        );
      }
      throw error;
    }

    const updatedOrder = await updateOrderStatus(id, validatedData.status);

  return successResponse(updatedOrder);
  } catch (error) {
    console.error('Update order status error:', error);
    return errorResponse('Internal server error', 500);
  }
};

export const method = 'PUT';
export const route = '/admin/orders/{id}/status';
