import { z } from 'zod'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import { getAllCategories } from '../services/product'
import { successResponse, errorResponse } from '../utils/response'
import { formatCategories } from '../utils/transform'
import { buildPaginationUrl } from '../utils/url'
import { sortByField } from '../utils/sort'

export const method = 'GET'
export const route = '/admin/categories'

// Query parameter validation schema
const QueryParamsSchema = z.object({
  status: z.enum(['active', 'inactive']).optional(),
  q: z.string().optional(),
  sort: z
    .enum([
      'id',
      '-id',
      'title',
      '-title',
      'brand',
      '-brand',
      'index',
      '-index',
      'createdAt',
      '-createdAt',
      'updatedAt',
      '-updatedAt',
    ])
    .optional()
    .default('title'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

export const requestSchema = QueryParamsSchema

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIResponse> => {
  try {
    const rawParams = event.queryStringParameters || {}

    const paramsResult = (() => {
      try {
        return {
          success: true as const,
          data: QueryParamsSchema.parse(rawParams),
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return {
            success: false as const,
            error: `Invalid query parameters: ${error.issues.map((e: any) => e.message).join(', ')}`,
          }
        }
        throw error
      }
    })()

    if (!paramsResult.success) {
      return errorResponse(paramsResult.error, 400)
    }

    const params = paramsResult.data

    const allCategories = await getAllCategories(params.status)

    // Apply search filter if query string is provided
    const searchFiltered = params.q
      ? (() => {
          const searchQuery = params.q.toLowerCase()
          return allCategories.filter((cat) =>
            cat.title.toLowerCase().includes(searchQuery),
          )
        })()
      : allCategories

    const sorted = sortByField(searchFiltered, params.sort)

    const total = sorted.length

    const paginatedCategories = sorted.slice(
      params.offset,
      params.offset + params.limit,
    )

    const buildUrl = (offset: number) =>
      buildPaginationUrl(
        event.requestContext.domainName,
        event.requestContext.path,
        {
          status: params.status,
          q: params.q,
          sort: params.sort,
          limit: params.limit,
          offset,
        },
      )

    // Prepare envelope parts (don't wrap twice)
    const data = formatCategories(paginatedCategories)
    const meta = {
      total: total,
      limit: params.limit,
      offset: params.offset,
      sort: params.sort,
      filters: {
        status: params.status || null,
        q: params.q || null,
      },
    }

    const links = {
      self: buildUrl(params.offset),
      next:
        params.offset + params.limit < total
          ? buildUrl(params.offset + params.limit)
          : null,
      prev:
        params.offset > 0
          ? buildUrl(Math.max(0, params.offset - params.limit))
          : null,
    }

    return successResponse(data, meta, links, 200)
  } catch (error) {
    console.error('List categories error:', error)
    return errorResponse('Internal server error', 500)
  }
}
