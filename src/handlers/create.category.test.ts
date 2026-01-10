import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { generateToken } from '../utils/jwt'

// Mock only DynamoDB network calls
mock.module('../services/dynamodb', () => ({
  putItem: async () => undefined,
  getItem: async () => null,
  deleteItem: async () => undefined,
  scanTable: async () => [],
  queryItems: async () => [],
  updateItem: async () => ({}),
}))

const { handler } = await import('./create.category')

describe('Create Category Handler (integration)', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'very-secure-dev-jwt-secret'
    process.env.CATEGORIES_TABLE = 'smultron-categories-prod'
    process.env.DISABLE_AUTH = 'false'
  })

  test('returns 401 when token is missing', async () => {
    const event = {
      headers: {},
      body: JSON.stringify({ slug: 'test-cat', title: 'Test Category' }),
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(401)
  })

  test('returns 401 when token is invalid', async () => {
    const event = {
      headers: { authorization: 'Bearer invalid-token' },
      body: JSON.stringify({ slug: 'test-cat', title: 'Test Category' }),
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(401)
  })

  test('returns 400 when required fields missing', async () => {
    const token = generateToken({ username: 'admin' })

    const event = {
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ slug: '' }),
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body)
    expect(body.error).toBeDefined()
  })

  test('creates category with valid token and data', async () => {
    const token = generateToken({ username: 'admin' })

    const event = {
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({
        slug: 'labubu-collection',
        title: 'Labubu Collection',
        brand: 'Pop Mart',
        subtitle: 'Exclusive Labubu series',
        index: 1,
        status: 'active',
      }),
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(201)

    const body = JSON.parse(res.body)
    expect(body.data).toBeDefined()
    expect(body.data.slug).toBe('labubu-collection')
    expect(body.data.title).toBe('Labubu Collection')
    expect(body.data.brand).toBe('Pop Mart')
    expect(body.data.subtitle).toBe('Exclusive Labubu series')
    expect(body.data.index).toBe(1)
    expect(body.data.status).toBe('active')
    expect(body.data.id).toBeDefined()
    expect(body.data.createdAt).toBeDefined()
    expect(body.data.updatedAt).toBeDefined()
  })

  test('applies defaults for optional fields', async () => {
    const token = generateToken({ username: 'admin' })

    const event = {
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({
        slug: 'minimal-cat',
        title: 'Minimal Category',
      }),
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(201)

    const body = JSON.parse(res.body)
    expect(body.data.slug).toBe('minimal-cat')
    expect(body.data.title).toBe('Minimal Category')
    expect(body.data.brand).toBe('')
    expect(body.data.subtitle).toBe('')
    expect(body.data.index).toBe(999)
    expect(body.data.status).toBe('active')
  })
})
