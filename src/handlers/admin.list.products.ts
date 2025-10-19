import { z } from 'zod';
import { adminGetProducts, getAllCategories } from '../services/product';
import type { AdminProductsResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { unauthorizedResponse, errorResponse } from '../utils/response';
import { formatProducts } from '../utils/transform';
import { AdminProductsResponseSchema } from '../schemas/handlers';

export const responseSchema = AdminProductsResponseSchema;

export const method = 'GET';
export const route = '/admin/products';

// Query parameter validation schema
const QueryParamsSchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
  q: z.string().optional(),
  sort: z.enum([
    'createdAt', '-createdAt',
    'updatedAt', '-updatedAt',
    'id', '-id',
    'title', '-title',
    'index', '-index'
  ]).optional().default('-createdAt'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

export const handler = async (event: any) => {
  // Verify authentication
  if (!verifyAuthToken(event.headers || {})) {
    return unauthorizedResponse();
  }

  try {
    // Parse and validate query parameters
    const params = QueryParamsSchema.parse(event.queryStringParameters || {});

    // Get products and categories in parallel
    const [result, allCategories] = await Promise.all([
      adminGetProducts({
        status: params.status,
        searchQuery: params.q,
        sortField: params.sort,
        limit: params.limit,
        offset: params.offset
      }),
      getAllCategories('active')
    ]);

    // Sort categories by index and map to simplified format
    const categories = allCategories
      .sort((a, b) => a.index - b.index)
      .map(cat => ({
        id: cat.id,
        slug: cat.slug,
        title: cat.title
      }));

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

    const response: AdminProductsResponse = {
      data: formatProducts(result.items),
      categories: categories,
      meta: {
        total: result.total,
        limit: params.limit,
        offset: params.offset,
        sort: params.sort,
        filters: {
          status: params.status || null,
          q: params.q || null
        }
      },
      links: {
        self: buildUrl(params.offset),
        next: params.offset + params.limit < result.total 
          ? buildUrl(params.offset + params.limit) 
          : null,
        prev: params.offset > 0 
          ? buildUrl(Math.max(0, params.offset - params.limit)) 
          : null
      }
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response)
    };
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Validation error',
          details: error.issues
        })
      };
    }

    console.error('Error in admin.list.products:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error'
      })
    };
  }
};
