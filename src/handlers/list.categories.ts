import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse, AdminCategoriesResponse } from '../types';
import { getAllCategories } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response';
import { verifyAuthToken } from '../middleware/auth';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    // Verify authentication for admin endpoint
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    // Get optional status filter from query parameters
    const statusFilter = event.queryStringParameters?.status as 'active' | 'inactive' | undefined;
    
    // Validate status filter if provided
    if (statusFilter && statusFilter !== 'active' && statusFilter !== 'inactive') {
      return errorResponse('Status must be either "active" or "inactive"', 400);
    }

    const categories = await getAllCategories(statusFilter);
    
    // Format response with data wrapper
    const response: AdminCategoriesResponse = {
      data: categories,
      meta: {
        total: categories.length,
      },
    };
    
    return successResponse(response);
  } catch (error) {
    console.error('List categories error:', error);
    return errorResponse('Internal server error', 500);
  }
};
