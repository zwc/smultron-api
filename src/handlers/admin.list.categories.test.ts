import { describe, test, expect, mock } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'

const mockGetAllCategories = mock<
  (status?: 'active' | 'inactive') => Promise<any[]>
>(() => Promise.resolve([]))

mock.module('../services/product', () => ({
  getAllCategories: mockGetAllCategories,
  getActiveProducts: async () => [],
  adminGetProducts: async () => ({ items: [], total: 0 }),
}))

const { handler } = await import('./admin.list.categories')

describe('Admin List Categories Handler (unit)', () => {
  test('validates query params and returns 400 on invalid', async () => {
    const event = {
      queryStringParameters: { limit: '0' }, // invalid: min 1
      requestContext: { domainName: 'example.com', path: '/admin/categories' },
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(400)
  })

  test('applies status filter, search, sorting and pagination', async () => {
    const categories = [
      { id: '1', title: 'Labubu', index: 2, createdAt: 1 },
      { id: '2', title: 'Skullpanda', index: 1, createdAt: 2 },
      { id: '3', title: 'Getahug', index: 3, createdAt: 3 },
    ]

    mockGetAllCategories.mockResolvedValue(categories)
    // Removed mock implementation for formatCategories

    const event = {
      queryStringParameters: {
        status: 'active',
        q: 'a',
        sort: '-title',
        limit: '2',
        offset: '0',
      },
      requestContext: { domainName: 'example.com', path: '/admin/categories' },
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(200)

    const body = JSON.parse(res.body)
    expect(body.data.length).toBe(2)
    expect(body.data[0].title.toLowerCase()).toBe('skullpanda')
    expect(body.meta.total).toBe(3)
    expect(body.meta.limit).toBe(2)
    expect(body.meta.offset).toBe(0)
    expect(body.links.self).toContain('/admin/categories')
  })

  test('paginates results and provides next/prev links', async () => {
    const categories = []
    for (let i = 0; i < 10; i++)
      categories.push({
        id: `${i}`,
        title: `Item ${i}`,
        index: i,
        createdAt: i,
      })

    mockGetAllCategories.mockResolvedValue(categories)
    // Removed mock implementation for formatCategories

    const event = {
      queryStringParameters: { limit: '3', offset: '3', sort: 'index' },
      requestContext: { domainName: 'example.com', path: '/admin/categories' },
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.length).toBe(3)
    expect(body.meta.total).toBe(10)
    expect(body.links.next).toBeDefined()
    expect(body.links.prev).toBeDefined()
  })

  test('matches snapshot for happy path', async () => {
    const categories = [
      {
        id: '1',
        title: 'Snapshot Cat 1',
        index: 1,
        createdAt: 1234567890,
        status: 'active',
      },
      {
        id: '2',
        title: 'Snapshot Cat 2',
        index: 2,
        createdAt: 1234567890,
        status: 'inactive',
      },
    ]

    mockGetAllCategories.mockResolvedValue(categories)

    const event = {
      queryStringParameters: { limit: '10', sort: 'index' },
      requestContext: { domainName: 'example.com', path: '/admin/categories' },
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toMatchInlineSnapshot(`
      {
        "data": [
          {
            "createdAt": 1234567890,
            "id": "1",
            "index": 1,
            "status": "active",
            "title": "Snapshot Cat 1",
          },
          {
            "createdAt": 1234567890,
            "id": "2",
            "index": 2,
            "status": "inactive",
            "title": "Snapshot Cat 2",
          },
        ],
        "error": null,
        "links": {
          "next": null,
          "prev": null,
          "self": "https://example.com/admin/categories?sort=index&limit=10&offset=0",
        },
        "meta": {
          "filters": {
            "q": null,
            "status": null,
          },
          "limit": 10,
          "offset": 0,
          "sort": "index",
          "total": 2,
        },
      }
    `)
  })
})
