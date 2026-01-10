import { z } from 'zod'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { APIResponse } from '../types'
import { getAllCategories } from '../services/product'
import { successResponse, errorResponse } from '../utils/response'
import { formatCategories } from '../utils/transform'
import { buildPaginationUrl } from '../utils/url'
import { sortByField } from '../utils/sort'
import { buildPaginationEnvelope } from '../utils/pagination'

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
    const rawParams = event.queryStringParameters ?? {}
    const parsed = QueryParamsSchema.safeParse(rawParams)

    if (!parsed.success) {
      return errorResponse(
        `Invalid query parameters: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
        400,
      )
    }

    const params = parsed.data

    const allCategories = await getAllCategories(params.status)

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

    const { meta, links } = buildPaginationEnvelope(
      total,
      { limit: params.limit, offset: params.offset, sort: params.sort },
      buildUrl,
      { status: params.status, q: params.q },
    )

    const data = formatCategories(paginatedCategories)

    return successResponse(data, meta, links, 200)
  } catch (error) {
    console.error('List categories error:', error)
    return errorResponse('Internal server error', 500)
  }
}
