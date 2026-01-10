import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { generateToken } from '../utils/jwt'
import { createProduct, createCategory } from '../services/product'

// Mock DynamoDB network calls
mock.module('../services/dynamodb', () => ({
  putItem: async () => undefined,
  getItem: async () => null,
  deleteItem: async () => undefined,
  scanTable: async () => [],
  queryItems: async () => [],
  updateItem: async () => ({}),
}))

// Mock product service - use real create functions, mock only save functions
mock.module('../services/product', () => ({
  createProduct,
  createCategory,
  saveProduct: async () => undefined,
  saveCategory: async () => undefined,
  getAllCategories: async () => [],
  getActiveProducts: async () => [],
  adminGetProducts: async () => ({ items: [], total: 0 }),
}))

const { handler } = await import('./create.product')

describe('Create Product Handler (integration)', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'very-secure-dev-jwt-secret'
    process.env.PRODUCTS_TABLE = 'smultron-products-prod'
    process.env.DISABLE_AUTH = 'false'
  })

  test('returns 401 when token is missing', async () => {
    const event = {
      headers: {},
      body: JSON.stringify({
        title: 'Test Product',
        subtitle: 'Test Subtitle',
        brand: 'Test Brand',
        price: 99,
        stock: 10,
      }),
    } as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(401)
    expect(JSON.parse(response.body).error.message).toBe('Unauthorized')
  })

  test('returns 401 when token is invalid', async () => {
    const event = {
      headers: {
        authorization: 'Bearer invalid-token',
      },
      body: JSON.stringify({
        title: 'Test Product',
        subtitle: 'Test Subtitle',
        brand: 'Test Brand',
        price: 99,
        stock: 10,
      }),
    } as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(401)
    expect(JSON.parse(response.body).error.message).toBe('Unauthorized')
  })

  test('returns 400 when required fields missing', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: 'Test Product',
        // Missing subtitle, brand, price, stock
      }),
    } as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body).error.message).toContain(
      'Missing required fields',
    )
  })

  test('returns 400 when status is invalid', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: 'Test Product',
        subtitle: 'Test Subtitle',
        brand: 'Test Brand',
        price: 99,
        stock: 10,
        status: 'invalid-status',
      }),
    } as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body).error.message).toContain(
      'Status must be either',
    )
  })

  test('creates product with valid token and data', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: 'Test Product',
        subtitle: 'Test Subtitle',
        brand: 'Test Brand',
        price: 99,
        stock: 10,
        status: 'active',
        categorySlug: 'test-category',
        description: ['Test description'],
      }),
    } as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.data.title).toBe('Test Product')
    expect(body.data.subtitle).toBe('Test Subtitle')
    expect(body.data.brand).toBe('Test Brand')
    expect(body.data.price).toBe(99)
    expect(body.data.stock).toBe(10)
    expect(body.data.status).toBe('active')
    expect(body.data.category).toBe('test-category')
    expect(body.data.description).toEqual(['Test description'])
    expect(body.data.slug).toBeDefined()
    expect(body.data.createdAt).toBeDefined()
    expect(body.data.updatedAt).toBeDefined()
  })

  test('applies defaults for optional fields', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: {
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: 'Test Product',
        subtitle: 'Test Subtitle',
        brand: 'Test Brand',
        price: 99,
        stock: 10,
      }),
    } as APIGatewayProxyEvent

    const response = await handler(event)

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.data.status).toBe('active')
    expect(body.data.slug).toBeDefined()
    expect(body.data.createdAt).toBeDefined()
    expect(body.data.updatedAt).toBeDefined()
  })
})
