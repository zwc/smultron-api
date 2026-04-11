import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { generateToken } from '../utils/jwt'

mock.module('../services/dynamodb', () => ({
  putItem: async () => undefined,
  getItem: async () => null,
  deleteItem: async () => undefined,
  scanTable: async () => [],
  queryItems: async () => [],
  updateItem: async () => ({}),
}))

// Inline pure implementation to avoid stale mock contamination across test files
mock.module('../services/shipment-option', () => ({
  createShipmentOption: (data: {
    name: string
    description: string
    cost: number
  }) => ({
    id: 'generated-uuid',
    name: data.name,
    description: data.description,
    cost: data.cost,
    createdAt: '2026-04-11T00:00:00.000Z',
    updatedAt: '2026-04-11T00:00:00.000Z',
  }),
  saveShipmentOption: async () => undefined,
  getAllShipmentOptions: async () => [],
  getShipmentOption: async () => null,
  getShipmentOptionByName: async () => null,
  updateShipmentOption: async () => ({}),
  deleteShipmentOption: async () => undefined,
}))

const { handler } = await import('./create.shipment-option')

describe('Create Shipment-Option Handler', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'very-secure-dev-jwt-secret'
    process.env.SHIPMENT_OPTIONS_TABLE = 'smultron-shipment-dev'
    process.env.DISABLE_AUTH = 'false'
  })

  test('returns 401 when token is missing', async () => {
    const event = {
      headers: {},
      body: JSON.stringify({ name: 'Express', description: 'Fast', cost: 99 }),
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(401)
  })

  test('returns 400 when body is missing', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      body: null,
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(400)
  })

  test('returns 400 when required fields are missing', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: '' }),
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body)
    expect(body.error).toBeDefined()
  })

  test('creates shipment option with valid data', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Standard',
        description: 'Standard shipping 3-5 days',
        cost: 49,
      }),
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.data.name).toBe('Standard')
    expect(body.data.description).toBe('Standard shipping 3-5 days')
    expect(body.data.cost).toBe(49)
    expect(body.data.id).toBeDefined()
    expect(body.data.createdAt).toBeDefined()
    expect(body.data.updatedAt).toBeDefined()
  })

  test('returns 400 when cost is negative', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Bad',
        description: 'desc',
        cost: -10,
      }),
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(400)
  })
})
