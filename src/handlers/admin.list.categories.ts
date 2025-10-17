import { z } from 'zod';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse, AdminCategoriesResponse, Category } from '../types';
import { getAllCategories } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response';
import { verifyAuthToken } from '../middleware/auth';
import { formatCategories } from '../utils/transform';

// Query parameter validation schema
const QueryParamsSchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
  sort: z.enum([
    'id', '-id',
    'title', '-title',
    'brand', '-brand',
    'index', '-index'
  ]).optional().default('title'),
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    // Verify authentication for admin endpoint
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    // Parse and validate query parameters
    const rawParams = event.queryStringParameters || {};
    let params;
    
    try {
      params = QueryParamsSchema.parse(rawParams);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse(`Invalid query parameters: ${error.issues.map((e: any) => e.message).join(', ')}`, 400);
      }
      throw error;
    }

    // Get categories with optional status filter
    let categories = await getAllCategories(params.status);
    
    // Apply sorting
    const sortField = params.sort.startsWith('-') ? params.sort.slice(1) : params.sort;
    const sortDirection = params.sort.startsWith('-') ? -1 : 1;
    
    categories = categories.sort((a, b) => {
      let aVal: any = a[sortField as keyof Category];
      let bVal: any = b[sortField as keyof Category];
      
      // Handle string comparison (case-insensitive)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (aVal < bVal) return -1 * sortDirection;
      if (aVal > bVal) return 1 * sortDirection;
      return 0;
    });
    
    // Format response with data wrapper
    const response: AdminCategoriesResponse = {
      data: formatCategories(categories),
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
