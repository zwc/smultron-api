import { z } from 'zod';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { getAllOrders, getOrder } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '../utils/response';
import { ListOrdersResponseSchema } from '../schemas/handlers';

export const responseSchema = ListOrdersResponseSchema;

export const method = 'GET';
export const route = '/admin/orders';

// Query parameter validation schema
const QueryParamsSchema = z.object({
  status: z.enum(['active', 'inactive', 'invalid']).optional(),
  q: z.string().optional(),
  sort: z.enum([
    'date', '-date',
    'date_change', '-date_change',
    'number', '-number',
    'status', '-status',
    'createdAt', '-createdAt',
    'updatedAt', '-updatedAt'
  ]).optional().default('-date'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

export const requestSchema = QueryParamsSchema;

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

    // Parse and validate query parameters
    const params = QueryParamsSchema.parse(qs);

    // Get orders - use GSI if filtering by status, otherwise full table scan
    let orders = await getAllOrders(params.status);

    // Apply search filter if query string is provided
    if (params.q) {
      const searchQuery = params.q.toLowerCase();
      orders = orders.filter(order => 
        order.number.toLowerCase().includes(searchQuery) ||
        order.information.name.toLowerCase().includes(searchQuery)
      );
    }

    // Apply sorting
    const sortField = params.sort.startsWith('-') ? params.sort.slice(1) : params.sort;
    const sortDirection = params.sort.startsWith('-') ? -1 : 1;

    orders = orders.sort((a, b) => {
      let aVal: any = a[sortField as keyof typeof a];
      let bVal: any = b[sortField as keyof typeof b];

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
    const total = orders.length;

    // Apply pagination
    const paginatedOrders = orders.slice(params.offset, params.offset + params.limit);

    // Build pagination links
    const baseUrl = `https://${event.requestContext.domainName}${event.requestContext.path}`;
    const buildUrl = (offset: number) => {
      const urlParams = new URLSearchParams();
      if (params.status) urlParams.set('status', params.status);
      if (params.q) urlParams.set('q', params.q);
      urlParams.set('sort', params.sort);
      urlParams.set('limit', params.limit.toString());
      urlParams.set('offset', offset.toString());
      return `${baseUrl}?${urlParams.toString()}`;
    };

    const meta = {
      total: total,
      limit: params.limit,
      offset: params.offset,
      sort: params.sort,
      filters: {
        status: params.status || null,
        q: params.q || null
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

    return successResponse(paginatedOrders, meta, links, 200);
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return errorResponse(`Invalid query parameters: ${error.issues.map((e: any) => e.message).join(', ')}`, 400);
    }

    console.error('List orders error:', error);
    return errorResponse('Internal server error', 500);
  }
};
