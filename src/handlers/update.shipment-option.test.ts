import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { generateToken } from '../utils/jwt'

const existingOption = {
  id: 'option-1',
  name: 'Standard',
  description: 'Standard shipping',
  cost: 49,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

mock.module('../services/dynamodb', () => ({
  putItem: async () => undefined,
  getItem: async () => existingOption,
  deleteItem: async () => undefined,
  scanTable: async () => [],
  queryItems: async () => [],
  updateItem: async () => ({
    ...existingOption,
    name: 'Express',
    updatedAt: '2026-04-11T00:00:00.000Z',
  }),
}))

mock.module('../services/shipment-option', () => ({
  saveShipmentOption: async () => undefined,
  getAllShipmentOptions: async () => [existingOption],
  getShipmentOption: async (id: string) =>
    id === 'option-1' ? existingOption : null,
  updateShipmentOption: async (_id: string, updates: object) => ({
    ...existingOption,
    ...updates,
    updatedAt: '2026-04-11T00:00:00.000Z',
  }),
  deleteShipmentOption: async () => undefined,
}))

const { handler } = await import('./update.shipment-option')

describe('Update Shipment-Option Handler', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'very-secure-dev-jwt-secret'
    process.env.SHIPMENT_OPTIONS_TABLE = 'smultron-shipment-dev'
    process.env.DISABLE_AUTH = 'false'
  })

  test('returns 401 when token is missing', async () => {
    const event = {
      headers: {},
      pathParameters: { id: 'option-1' },
      body: JSON.stringify({ name: 'Express' }),
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(401)
  })

  test('returns 400 when id is missing', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: {},
      body: JSON.stringify({ name: 'Express' }),
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(400)
  })

  test('returns 404 when option does not exist', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'nonexistent' },
      body: JSON.stringify({ name: 'Express' }),
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(404)
  })

  test('updates shipment option with valid data', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'option-1' },
      body: JSON.stringify({ name: 'Express' }),
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.name).toBe('Express')
  })

  test('returns 400 for unknown fields', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'option-1' },
      body: JSON.stringify({ unknownField: 'bad' }),
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(400)
  })
})
