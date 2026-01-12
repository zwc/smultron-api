import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { createProduct, createCategory } from '../services/product'
import { generateToken } from '../utils/jwt'

const mockUpdateProduct = mock(async () => ({}))

mock.module('../services/dynamodb', () => ({
  putItem: async () => undefined,
  getItem: async () => null,
  deleteItem: async () => undefined,
  scanTable: async () => [],
  queryItems: async () => [],
  updateItem: async () => ({}),
}))

mock.module('../services/product', () => ({
  updateProduct: mockUpdateProduct,
  getAllCategories: async () => [],
  getActiveProducts: async () => [],
  adminGetProducts: async () => ({ items: [], total: 0 }),
  saveCategory: async () => undefined,
  saveProduct: async () => undefined,
  createCategory,
  createProduct,
}))

const { handler } = await import('./update.product')

describe('Update Product Handler (unit)', () => {
  beforeEach(() => {
    mockUpdateProduct.mockClear()
    process.env.JWT_SECRET = 'test-secret'
    process.env.DISABLE_AUTH = 'false'
  })

  test('returns 401 when token is missing', async () => {
    const event = {
      headers: {},
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({ title: 'Updated Title' }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(401)
    const body = JSON.parse(response.body)
    expect(body.error.message).toBe('Unauthorized')
  })

  test('returns 400 when id is missing', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: {},
      body: JSON.stringify({ title: 'Updated Title' }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.error.message).toBe('Product ID is required')
  })

  test('returns 400 when body is missing', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'test-id' },
      body: null,
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.error.message).toBe('Request body is required')
  })

  test('updates product with valid data', async () => {
    const token = generateToken({ username: 'admin' })
    const updatedProduct = createProduct({
      slug: 'updated-product',
      category: 'test-category',
      article: 'ART-002',
      brand: 'Updated Brand',
      title: 'Updated Title',
      subtitle: 'Updated Subtitle',
      price: 199,
      stock: 20,
      status: 'active',
    })

    mockUpdateProduct.mockResolvedValue(updatedProduct)

    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({
        title: 'Updated Title',
        brand: 'Updated Brand',
        price: 199,
        stock: 20,
      }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.data.title).toBe('Updated Title')
    expect(body.data.brand).toBe('Updated Brand')
    expect(body.data.price).toBe(199)
    expect(body.data.stock).toBe(20)
    expect(mockUpdateProduct).toHaveBeenCalledTimes(1)
    expect(mockUpdateProduct).toHaveBeenCalledWith('test-id', {
      title: 'Updated Title',
      brand: 'Updated Brand',
      price: 199,
      stock: 20,
    })
  })

  test('updates product status', async () => {
    const token = generateToken({ username: 'admin' })
    const updatedProduct = createProduct({
      slug: 'test-product',
      category: 'test-category',
      article: 'ART-001',
      brand: 'Test Brand',
      title: 'Test Product',
      subtitle: 'Test Subtitle',
      price: 99,
      stock: 10,
      status: 'inactive',
    })

    mockUpdateProduct.mockResolvedValue(updatedProduct)

    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({ status: 'inactive' }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.data.status).toBe('inactive')
    expect(mockUpdateProduct).toHaveBeenCalledWith('test-id', {
      status: 'inactive',
    })
  })

  test('updates product category', async () => {
    const token = generateToken({ username: 'admin' })
    const updatedProduct = createProduct({
      slug: 'test-product',
      category: 'new-category',
      article: 'ART-001',
      brand: 'Test Brand',
      title: 'Test Product',
      subtitle: 'Test Subtitle',
      price: 99,
      stock: 10,
      status: 'active',
    })

    mockUpdateProduct.mockResolvedValue(updatedProduct)

    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({ category: 'new-category' }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    expect(mockUpdateProduct).toHaveBeenCalledWith('test-id', {
      category: 'new-category',
    })
  })

  test('filters out protected fields from update', async () => {
    const token = generateToken({ username: 'admin' })
    const updatedProduct = createProduct({
      slug: 'test-product',
      category: 'test-category',
      article: 'ART-001',
      brand: 'Test Brand',
      title: 'Updated Title',
      subtitle: 'Test Subtitle',
      price: 99,
      stock: 10,
      status: 'active',
    })

    mockUpdateProduct.mockResolvedValue(updatedProduct)

    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({
        title: 'Updated Title',
        id: 'should-be-ignored',
        createdAt: 'should-be-ignored',
        updatedAt: 'should-be-ignored',
      }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    expect(mockUpdateProduct).toHaveBeenCalledWith('test-id', {
      title: 'Updated Title',
    })
  })

  test('returns 400 for invalid status value', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({ status: 'invalid-status' }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.error.message).toContain('Validation error')
  })

  test('returns 400 for negative price', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({ price: -10 }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.error.message).toContain('Validation error')
  })

  test('returns 400 for negative stock', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({ stock: -5 }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.error.message).toContain('Validation error')
  })

  test('returns 400 for unknown fields', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({
        title: 'Updated Title',
        unknownField: 'should-fail',
      }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.error.message).toContain('Validation error')
  })

  test('returns 400 for empty title', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({ title: '' }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.error.message).toContain('Validation error')
  })

  test('updates product with description array', async () => {
    const token = generateToken({ username: 'admin' })
    const updatedProduct = createProduct({
      slug: 'test-product',
      category: 'test-category',
      article: 'ART-001',
      brand: 'Test Brand',
      title: 'Test Product',
      subtitle: 'Test Subtitle',
      price: 99,
      description: ['Line 1', 'Line 2', 'Line 3'],
      stock: 10,
      status: 'active',
    })

    mockUpdateProduct.mockResolvedValue(updatedProduct)

    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({
        description: ['Line 1', 'Line 2', 'Line 3'],
      }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    expect(mockUpdateProduct).toHaveBeenCalledWith('test-id', {
      description: ['Line 1', 'Line 2', 'Line 3'],
    })
  })

  test('updates product with images array', async () => {
    const token = generateToken({ username: 'admin' })
    const updatedProduct = createProduct({
      slug: 'test-product',
      category: 'test-category',
      article: 'ART-001',
      brand: 'Test Brand',
      title: 'Test Product',
      subtitle: 'Test Subtitle',
      price: 99,
      images: ['img1.jpg', 'img2.jpg'],
      stock: 10,
      status: 'active',
    })

    mockUpdateProduct.mockResolvedValue(updatedProduct)

    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({
        images: ['img1.jpg', 'img2.jpg'],
      }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    expect(mockUpdateProduct).toHaveBeenCalledWith('test-id', {
      images: ['img1.jpg', 'img2.jpg'],
    })
  })

  test('handles service errors gracefully', async () => {
    const consoleErrorMock = mock(() => {})
    const originalConsoleError = console.error
    console.error = consoleErrorMock

    const token = generateToken({ username: 'admin' })
    mockUpdateProduct.mockRejectedValue(new Error('Database error'))

    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({ title: 'Updated Title' }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    console.error = originalConsoleError

    expect(response.statusCode).toBe(500)
    const body = JSON.parse(response.body)
    expect(body.error.message).toBe('Internal server error')
  })
})
