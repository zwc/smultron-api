import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { createProduct, createCategory } from '../services/product'
import { generateToken } from '../utils/jwt'

const mockUpdateCategory = mock(async () => ({}))

mock.module('../services/dynamodb', () => ({
  putItem: async () => undefined,
  getItem: async () => null,
  deleteItem: async () => undefined,
  scanTable: async () => [],
  queryItems: async () => [],
  updateItem: async () => ({}),
}))

mock.module('../services/product', () => ({
  updateCategory: mockUpdateCategory,
  getAllCategories: async () => [],
  getActiveProducts: async () => [],
  adminGetProducts: async () => ({ items: [], total: 0 }),
  saveCategory: async () => undefined,
  saveProduct: async () => undefined,
  createCategory,
  createProduct,
}))

const { handler } = await import('./update.category')

describe('Update Category Handler (unit)', () => {
  beforeEach(() => {
    mockUpdateCategory.mockClear()
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
    expect(body.error.message).toBe('Category ID is required')
  })

  test('returns 400 when body is missing', async () => {
    const event = {
      headers: {
        authorization: `Bearer ${generateToken({ username: 'admin' })}`,
      },
      pathParameters: { id: 'test-id' },
      body: null,
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.error.message).toBe('Request body is required')
  })

  test('updates category with valid data', async () => {
    const updatedCategory = createCategory({
      slug: 'updated-slug',
      title: 'Updated Title',
      brand: 'Updated Brand',
      subtitle: 'Updated Subtitle',
      index: 5,
      status: 'active',
    })

    mockUpdateCategory.mockResolvedValue(updatedCategory)

    const event = {
      headers: {
        authorization: `Bearer ${generateToken({ username: 'admin' })}`,
      },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({
        title: 'Updated Title',
        brand: 'Updated Brand',
        subtitle: 'Updated Subtitle',
      }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.data.title).toBe('Updated Title')
    expect(body.data.brand).toBe('Updated Brand')
    expect(body.data.subtitle).toBe('Updated Subtitle')
    expect(mockUpdateCategory).toHaveBeenCalledTimes(1)
    expect(mockUpdateCategory).toHaveBeenCalledWith('test-id', {
      title: 'Updated Title',
      brand: 'Updated Brand',
      subtitle: 'Updated Subtitle',
    })
  })

  test('updates category status', async () => {
    const updatedCategory = createCategory({
      slug: 'test-category',
      title: 'Test Category',
      brand: 'Test Brand',
      subtitle: 'Test Subtitle',
      index: 0,
      status: 'inactive',
    })

    mockUpdateCategory.mockResolvedValue(updatedCategory)

    const event = {
      headers: {
        authorization: `Bearer ${generateToken({ username: 'admin' })}`,
      },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({ status: 'inactive' }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.data.status).toBe('inactive')
    expect(mockUpdateCategory).toHaveBeenCalledWith('test-id', {
      status: 'inactive',
    })
  })

  test('filters out protected fields from update', async () => {
    const updatedCategory = createCategory({
      slug: 'test-category',
      title: 'Updated Title',
      brand: 'Test Brand',
      subtitle: 'Test Subtitle',
      index: 0,
      status: 'active',
    })

    mockUpdateCategory.mockResolvedValue(updatedCategory)

    const event = {
      headers: {
        authorization: `Bearer ${generateToken({ username: 'admin' })}`,
      },
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
    expect(mockUpdateCategory).toHaveBeenCalledWith('test-id', {
      title: 'Updated Title',
    })
  })

  test('returns 400 for invalid status value', async () => {
    const event = {
      headers: {
        authorization: `Bearer ${generateToken({ username: 'admin' })}`,
      },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({ status: 'invalid-status' }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.error.message).toContain('Validation error')
  })

  test('returns 400 for invalid index value', async () => {
    const event = {
      headers: {
        authorization: `Bearer ${generateToken({ username: 'admin' })}`,
      },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({ index: -1 }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.error.message).toContain('Validation error')
  })

  test('returns 400 for unknown fields', async () => {
    const event = {
      headers: {
        authorization: `Bearer ${generateToken({ username: 'admin' })}`,
      },
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
    const event = {
      headers: {
        authorization: `Bearer ${generateToken({ username: 'admin' })}`,
      },
      pathParameters: { id: 'test-id' },
      body: JSON.stringify({ title: '' }),
    } as unknown as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.error.message).toContain('Validation error')
  })

  test('handles service errors gracefully', async () => {
    const consoleErrorMock = mock(() => {})
    const originalConsoleError = console.error
    console.error = consoleErrorMock

    mockUpdateCategory.mockRejectedValue(new Error('Database error'))

    const event = {
      headers: {
        authorization: `Bearer ${generateToken({ username: 'admin' })}`,
      },
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
