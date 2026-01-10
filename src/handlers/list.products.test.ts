import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { createProduct, createCategory } from '../services/product'

const mockGetActiveProducts = mock(async () => [])

mock.module('../services/dynamodb', () => ({
  putItem: async () => undefined,
  getItem: async () => null,
  deleteItem: async () => undefined,
  scanTable: async () => [],
  queryItems: async () => [],
  updateItem: async () => ({}),
}))

mock.module('../services/product', () => ({
  getActiveProducts: mockGetActiveProducts,
  getAllCategories: async () => [],
  adminGetProducts: async () => ({ items: [], total: 0 }),
  saveCategory: async () => undefined,
  saveProduct: async () => undefined,
  createCategory,
  createProduct,
}))

const { handler } = await import('./list.products')

describe('List Products Handler (unit)', () => {
  beforeEach(() => {
    mockGetActiveProducts.mockClear()
  })

  test('returns empty array when no products exist', async () => {
    mockGetActiveProducts.mockResolvedValue([])

    const event = {} as APIGatewayProxyEvent
    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.data).toEqual([])
  })

  test('returns active products', async () => {
    const product1 = createProduct({
      slug: 'product-1',
      categorySlug: 'test-category',
      article: 'ART-001',
      brand: 'Test Brand',
      title: 'Product 1',
      subtitle: 'Subtitle 1',
      price: 99,
      stock: 10,
      status: 'active',
    })

    const product2 = createProduct({
      slug: 'product-2',
      categorySlug: 'test-category',
      article: 'ART-002',
      brand: 'Test Brand',
      title: 'Product 2',
      subtitle: 'Subtitle 2',
      price: 149,
      stock: 5,
      status: 'active',
    })

    mockGetActiveProducts.mockResolvedValue([product1, product2])

    const event = {} as APIGatewayProxyEvent
    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.data).toHaveLength(2)
    expect(body.data[0].title).toBe('Product 1')
    expect(body.data[0].status).toBe('active')
    expect(body.data[1].title).toBe('Product 2')
    expect(body.data[1].status).toBe('active')
  })

  test('calls getActiveProducts without parameters', async () => {
    mockGetActiveProducts.mockResolvedValue([])

    const event = {} as APIGatewayProxyEvent
    await handler(event)

    expect(mockGetActiveProducts).toHaveBeenCalledTimes(1)
    expect(mockGetActiveProducts).toHaveBeenCalledWith()
  })

  test('handles service errors gracefully', async () => {
    mockGetActiveProducts.mockRejectedValue(new Error('Database error'))

    const event = {} as APIGatewayProxyEvent
    const response = await handler(event)

    expect(response.statusCode).toBe(500)
    const body = JSON.parse(response.body)
    expect(body.error.message).toBe('Internal server error')
  })

  test('returns products with correct structure', async () => {
    const product = createProduct({
      slug: 'test-product',
      categorySlug: 'test-category',
      article: 'ART-001',
      brand: 'Test Brand',
      title: 'Test Product',
      subtitle: 'Test Subtitle',
      price: 99,
      price_reduced: 79,
      description: ['Line 1', 'Line 2'],
      tag: 'new',
      index: 1,
      stock: 10,
      max_order: 5,
      image: 'test.jpg',
      images: ['test1.jpg', 'test2.jpg'],
      status: 'active',
    })

    mockGetActiveProducts.mockResolvedValue([product])

    const event = {} as APIGatewayProxyEvent
    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.data).toHaveLength(1)
    const returnedProduct = body.data[0]
    expect(returnedProduct.slug).toBe('test-product')
    expect(returnedProduct.categorySlug).toBe('test-category')
    expect(returnedProduct.title).toBe('Test Product')
    expect(returnedProduct.subtitle).toBe('Test Subtitle')
    expect(returnedProduct.price).toBe(99)
    expect(returnedProduct.price_reduced).toBe(79)
    expect(returnedProduct.description).toEqual(['Line 1', 'Line 2'])
    expect(returnedProduct.tag).toBe('new')
    expect(returnedProduct.stock).toBe(10)
    expect(returnedProduct.status).toBe('active')
  })
})
