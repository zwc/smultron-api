import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { generateToken } from '../utils/jwt'
import { productMockDefaults } from '../test-helpers/productMockDefaults'

// Mock DynamoDB network calls
mock.module('../services/dynamodb', () => ({
  putItem: async () => undefined,
  getItem: async () => null,
  deleteItem: async () => undefined,
  scanTable: async () => [],
  queryItems: async () => [],
  updateItem: async () => ({}),
}))

// Provide a complete product mock so all ESM live bindings are established.
// createProduct is a pure function so we inline a realistic implementation;
// saveProduct is a no-op since the handler returns the product from createProduct.
mock.module('../services/product', () => ({
  ...productMockDefaults,
  createProduct: (data: Record<string, any>) => {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const category = data.category ?? ''
    const slug =
      data.slug ??
      `${category ? category + '-' : ''}${data.title}`
        .toLowerCase()
        .replace(/\s+/g, '-')
    return {
      article: '',
      price_reduced: 0,
      description: [],
      tag: '',
      index: 0,
      max_order: 999,
      image: '',
      images: [],
      ...data,
      id,
      slug,
      category,
      status: data.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    }
  },
  saveProduct: async () => undefined,
}))

const { handler } = await import('./create.product')

describe('Create Product Handler (unit)', () => {
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

    expect(response.statusCode).toBe(200)
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

    expect(response.statusCode).toBe(200)
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

    expect(response.statusCode).toBe(200)
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

    expect(response.statusCode).toBe(200)
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
        category: 'test-category',
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
