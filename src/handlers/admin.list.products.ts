import { adminGetProducts, getAllCategories } from '../services/product'
import { successResponse } from '../utils/response'
import { formatProducts } from '../utils/transform'

export { AdminListProductsQuerySchema as requestSchema } from '../schemas/handlers'
import { AdminListProductsQuerySchema } from '../schemas/handlers'

export const method = 'GET'
export const route = '/admin/products'

export const handler = async (event: any) => {
  try {
    // Parse and validate query parameters
    const parsed = AdminListProductsQuerySchema.safeParse(
      event.queryStringParameters || {},
    )

    if (!parsed.success) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: `Invalid query parameters: ${parsed.error.issues.map((i) => i.message).join(', ')}`,
        }),
      }
    }

    const params = parsed.data

    // Get products and categories in parallel
    const [result, allCategories] = await Promise.all([
      adminGetProducts({
        status: params.status,
        searchQuery: params.q,
        sortField: params.sort,
        limit: params.limit,
        offset: params.offset,
      }),
      getAllCategories('active'),
    ])

    // Sort categories by index and map to simplified format
    const categories = [...allCategories]
      .sort((a, b) => a.index - b.index)
      .map((cat) => ({
        id: cat.id,
        slug: cat.slug,
        title: cat.title,
      }))

    // Build pagination links
    const baseUrl = `https://${event.requestContext.domainName}${event.requestContext.path}`
    const buildUrl = (offset: number) => {
      const urlParams = new URLSearchParams()
      if (params.status) urlParams.set('status', params.status)
      if (params.q) urlParams.set('q', params.q)
      urlParams.set('sort', params.sort)
      urlParams.set('limit', params.limit.toString())
      urlParams.set('offset', offset.toString())
      return `${baseUrl}?${urlParams.toString()}`
    }

    const data = formatProducts(result.items)

    const meta = {
      total: result.total,
      limit: params.limit,
      offset: params.offset,
      sort: params.sort,
      filters: {
        status: params.status || null,
        q: params.q || null,
      },
      categories,
    }

    const links = {
      self: buildUrl(params.offset),
      next:
        params.offset + params.limit < result.total
          ? buildUrl(params.offset + params.limit)
          : null,
      prev:
        params.offset > 0
          ? buildUrl(Math.max(0, params.offset - params.limit))
          : null,
    }

    return successResponse(data, meta, links, 200)
  } catch (error) {
    console.error('Error in admin.list.products:', error)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
      }),
    }
  }
}
