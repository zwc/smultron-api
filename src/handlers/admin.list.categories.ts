import { z } from 'zod';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse, AdminCategoriesResponse, Category } from '../types';
import { getAllCategories } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response';
import { verifyAuthToken } from '../middleware/auth';
import { formatCategories } from '../utils/transform';
import { ListCategoriesResponseSchema } from '../schemas/handlers';

export const responseSchema = ListCategoriesResponseSchema;

export const method = 'GET';
export const route = '/admin/categories';

// Query parameter validation schema
const QueryParamsSchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
  sort: z.enum([
    'id', '-id',
    'title', '-title',
    'brand', '-brand',
    'index', '-index',
    'createdAt', '-createdAt',
    'updatedAt', '-updatedAt'
  ]).optional().default('title'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

export const requestSchema = QueryParamsSchema;

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
    
    // Store total before pagination
    const total = categories.length;
    
    // Apply pagination
    const paginatedCategories = categories.slice(params.offset, params.offset + params.limit);
    
    // Build pagination links
    const baseUrl = `https://${event.requestContext.domainName}${event.requestContext.path}`;
    const buildUrl = (offset: number) => {
      const urlParams = new URLSearchParams();
      if (params.status) urlParams.set('status', params.status);
      urlParams.set('sort', params.sort);
      urlParams.set('limit', params.limit.toString());
      urlParams.set('offset', offset.toString());
      return `${baseUrl}?${urlParams.toString()}`;
    };
    
    // Prepare envelope parts (don't wrap twice)
    const data = formatCategories(paginatedCategories);
    const meta = {
      total: total,
      limit: params.limit,
      offset: params.offset,
      sort: params.sort,
      filters: {
        status: params.status || null
      }
    };

    const links = {
      self: buildUrl(params.offset),
      next: params.offset + params.limit < total
        ? buildUrl(params.offset + params.limit)
        : null,
      prev: params.offset > 0
        ? buildUrl(Math.max(0, params.offset - params.limit))
        : null
    };

    return successResponse(data, meta, links, 200);
  } catch (error) {
    console.error('List categories error:', error);
    return errorResponse('Internal server error', 500);
  }
};
