import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { createProduct, createCategory } from '../services/product'

const mockGetAllCategories = mock(async () => [])
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
  getAllCategories: mockGetAllCategories,
  getActiveProducts: mockGetActiveProducts,
  adminGetProducts: async () => ({ items: [], total: 0 }),
  saveCategory: async () => undefined,
  saveProduct: async () => undefined,
  createCategory,
  createProduct,
}))

const { handler } = await import('./list.catalog')

describe('List Catalog Handler (unit)', () => {
  beforeEach(() => {
    mockGetAllCategories.mockClear()
    mockGetActiveProducts.mockClear()
  })

  test('returns empty catalog when no categories or products exist', async () => {
    mockGetAllCategories.mockResolvedValue([])
    mockGetActiveProducts.mockResolvedValue([])

    const event = {} as APIGatewayProxyEvent
    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.data.categories).toEqual([])
    expect(body.data.products).toEqual([])
    expect(body.meta.categoriesTotal).toBe(0)
    expect(body.meta.productsTotal).toBe(0)
  })

  test('returns active categories and products', async () => {
    const category = createCategory({
      slug: 'test-category',
      title: 'Test Category',
      brand: 'Test Brand',
      subtitle: 'Test Subtitle',
      index: 0,
      status: 'active',
    })

    const product = createProduct({
      slug: 'test-product',
      category: 'test-category',
      article: 'ART-001',
      brand: 'Test Brand',
      title: 'Test Product',
      subtitle: 'Test Subtitle',
      price: 99,
      stock: 10,
      status: 'active',
    })

    mockGetAllCategories.mockResolvedValue([category])
    mockGetActiveProducts.mockResolvedValue([product])

    const event = {} as APIGatewayProxyEvent
    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.data.categories).toHaveLength(1)
    expect(body.data.categories[0].slug).toBe('test-category')
    expect(body.data.categories[0].title).toBe('Test Category')
    expect(body.data.products).toHaveLength(1)
    expect(body.data.products[0].id).toBe(product.id)
    expect(body.data.products[0].title).toBe('Test Product')
    expect(body.data.products[0].category).toBe('test-category')
    expect(body.data.products[0].categoryId).toBe(category.id)
    expect(body.meta.categoriesTotal).toBe(1)
    expect(body.meta.productsTotal).toBe(1)
  })

  test('links products to categories via categoryId', async () => {
    const category1 = createCategory({
      slug: 'category-1',
      title: 'Category 1',
      brand: 'Brand 1',
      subtitle: 'Subtitle 1',
      index: 0,
      status: 'active',
    })

    const category2 = createCategory({
      slug: 'category-2',
      title: 'Category 2',
      brand: 'Brand 2',
      subtitle: 'Subtitle 2',
      index: 1,
      status: 'active',
    })

    const product1 = createProduct({
      slug: 'product-1',
      category: 'category-1',
      article: 'ART-001',
      brand: 'Brand 1',
      title: 'Product 1',
      subtitle: 'Subtitle 1',
      price: 99,
      stock: 10,
      status: 'active',
    })

    const product2 = createProduct({
      slug: 'product-2',
      category: 'category-2',
      article: 'ART-002',
      brand: 'Brand 2',
      title: 'Product 2',
      subtitle: 'Subtitle 2',
      price: 149,
      stock: 5,
      status: 'active',
    })

    mockGetAllCategories.mockResolvedValue([category1, category2])
    mockGetActiveProducts.mockResolvedValue([product1, product2])

    const event = {} as APIGatewayProxyEvent
    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.data.categories).toHaveLength(2)
    expect(body.data.products).toHaveLength(2)

    const prod1 = body.data.products.find((p: any) => p.slug === 'product-1')
    const prod2 = body.data.products.find((p: any) => p.slug === 'product-2')

    expect(prod1.id).toBe(product1.id)
    expect(prod1.category).toBe('category-1')
    expect(prod1.categoryId).toBe(category1.id)
    expect(prod2.id).toBe(product2.id)
    expect(prod2.category).toBe('category-2')
    expect(prod2.categoryId).toBe(category2.id)
  })

  test('handles service errors gracefully', async () => {
    const consoleErrorMock = mock(() => {})
    const originalConsoleError = console.error
    console.error = consoleErrorMock

    mockGetAllCategories.mockRejectedValue(new Error('Database error'))
    mockGetActiveProducts.mockResolvedValue([])

    const event = {} as APIGatewayProxyEvent
    const response = await handler(event)

    console.error = originalConsoleError

    expect(response.statusCode).toBe(500)
    const body = JSON.parse(response.body)
    expect(body.error.message).toBe('Internal server error')
  })

  test('calls getAllCategories with active filter', async () => {
    mockGetAllCategories.mockResolvedValue([])
    mockGetActiveProducts.mockResolvedValue([])

    const event = {} as APIGatewayProxyEvent
    await handler(event)

    expect(mockGetAllCategories).toHaveBeenCalledTimes(1)
    expect(mockGetAllCategories).toHaveBeenCalledWith('active')
  })

  test('calls getActiveProducts without parameters', async () => {
    mockGetAllCategories.mockResolvedValue([])
    mockGetActiveProducts.mockResolvedValue([])

    const event = {} as APIGatewayProxyEvent
    await handler(event)

    expect(mockGetActiveProducts).toHaveBeenCalledTimes(1)
    expect(mockGetActiveProducts).toHaveBeenCalledWith()
  })
})
