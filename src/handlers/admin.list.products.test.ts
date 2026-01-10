import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { createProduct, createCategory } from '../services/product'

// Define mocks first
const mockAdminGetProducts = mock(async () => ({ items: [], total: 0 }))
const mockGetAllCategories = mock(async () => [])

mock.module('../services/dynamodb', () => ({
  putItem: async () => undefined,
  getItem: async () => null,
  deleteItem: async () => undefined,
  scanTable: async () => [],
  queryItems: async () => [],
  updateItem: async () => ({}),
}))

// Mock the module
mock.module('../services/product', () => ({
  adminGetProducts: mockAdminGetProducts,
  getAllCategories: mockGetAllCategories,
  getActiveProducts: async () => [],
  saveProduct: async () => undefined,
  saveCategory: async () => undefined,
  createCategory,
  createProduct,
}))

// Import the handler
const { handler } = await import('./admin.list.products')

describe('Admin List Products Handler (unit)', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockAdminGetProducts.mockClear()
    mockGetAllCategories.mockClear()
  })

  test('validates query params and returns 400 on invalid', async () => {
    const event = {
      queryStringParameters: { limit: '0' }, // invalid: min 1
      requestContext: { domainName: 'example.com', path: '/admin/products' },
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body)
    expect(body.error).toBe('Validation error')
  })

  test('calls service with correct params and returns formatted response', async () => {
    const products = [
      {
        id: '1',
        title: 'Product 1',
        categorySlug: 'cat1',
        index: 1,
        createdAt: 100,
      },
      {
        id: '2',
        title: 'Product 2',
        categorySlug: 'cat2',
        index: 2,
        createdAt: 200,
      },
    ]
    const categories = [
      { id: 'c1', slug: 'cat1', title: 'Category 1', index: 1 },
      { id: 'c2', slug: 'cat2', title: 'Category 2', index: 2 },
    ]

    mockAdminGetProducts.mockResolvedValue({ items: products, total: 10 })
    mockGetAllCategories.mockResolvedValue(categories)

    const event = {
      queryStringParameters: {
        status: 'active',
        q: 'search',
        sort: 'title',
        limit: '2',
        offset: '0',
      },
      requestContext: { domainName: 'example.com', path: '/admin/products' },
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(200)

    // Verify service call
    expect(mockAdminGetProducts).toHaveBeenCalledWith({
      status: 'active',
      searchQuery: 'search',
      sortField: 'title',
      limit: 2,
      offset: 0,
    })

    const body = JSON.parse(res.body)
    expect(body.data.length).toBe(2)
    expect(body.data[0].title).toBe('Product 1')
    expect(body.meta.total).toBe(10)
    expect(body.meta.categories).toHaveLength(2)
    expect(body.links.next).toBeDefined()
  })

  test('paginates results and provides next/prev links', async () => {
    mockAdminGetProducts.mockResolvedValue({ items: [], total: 50 })
    mockGetAllCategories.mockResolvedValue([])

    const event = {
      queryStringParameters: { limit: '10', offset: '10' },
      requestContext: { domainName: 'example.com', path: '/admin/products' },
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)

    expect(body.links.self).toContain('offset=10')
    expect(body.links.next).toContain('offset=20')
    expect(body.links.prev).toContain('offset=0')
  })

  test('matches snapshot for happy path', async () => {
    const products = [
      {
        id: 'p1',
        title: 'Snapshot Product 1',
        categorySlug: 'cat1',
        price: 100,
        index: 1,
        createdAt: 1234567890,
        updatedAt: 1234567890,
        status: 'active',
      },
      {
        id: 'p2',
        title: 'Snapshot Product 2',
        categorySlug: 'cat2',
        price: 200,
        index: 2,
        createdAt: 1234567890,
        updatedAt: 1234567890,
        status: 'inactive',
      },
    ]

    const categories = [
      { id: 'c1', slug: 'cat1', title: 'Category 1', index: 1 },
      { id: 'c2', slug: 'cat2', title: 'Category 2', index: 2 },
    ]

    mockAdminGetProducts.mockResolvedValue({ items: products, total: 2 })
    mockGetAllCategories.mockResolvedValue(categories)

    const event = {
      queryStringParameters: { limit: '10', sort: '-createdAt' },
      requestContext: { domainName: 'example.com', path: '/admin/products' },
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toMatchInlineSnapshot(`
      {
        "data": [
          {
            "category": "cat1",
            "createdAt": 1234567890,
            "id": "p1",
            "index": 1,
            "price": 100,
            "status": "active",
            "title": "Snapshot Product 1",
            "updatedAt": 1234567890,
          },
          {
            "category": "cat2",
            "createdAt": 1234567890,
            "id": "p2",
            "index": 2,
            "price": 200,
            "status": "inactive",
            "title": "Snapshot Product 2",
            "updatedAt": 1234567890,
          },
        ],
        "error": null,
        "links": {
          "next": null,
          "prev": null,
          "self": "https://example.com/admin/products?sort=-createdAt&limit=10&offset=0",
        },
        "meta": {
          "categories": [
            {
              "id": "c1",
              "slug": "cat1",
              "title": "Category 1",
            },
            {
              "id": "c2",
              "slug": "cat2",
              "title": "Category 2",
            },
          ],
          "filters": {
            "q": null,
            "status": null,
          },
          "limit": 10,
          "offset": 0,
          "sort": "-createdAt",
          "total": 2,
        },
      }
    `)
  })
})
