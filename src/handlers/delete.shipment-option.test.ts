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

mock.module('../services/shipment-option', () => ({
  createShipmentOption: () => ({}),
  saveShipmentOption: async () => undefined,
  getAllShipmentOptions: async () => [],
  getShipmentOption: async () => null,
  getShipmentOptionByName: async () => null,
  updateShipmentOption: async () => ({}),
  deleteShipmentOption: async () => undefined,
}))

const { handler } = await import('./delete.shipment-option')

describe('Delete Shipment-Option Handler', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'very-secure-dev-jwt-secret'
    process.env.SHIPMENT_OPTIONS_TABLE = 'smultron-shipment-dev'
    process.env.DISABLE_AUTH = 'false'
  })

  test('returns 401 when token is missing', async () => {
    const event = {
      headers: {},
      pathParameters: { id: 'option-1' },
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(401)
  })

  test('returns 400 when id is missing', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: {},
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(400)
  })

  test('deletes shipment option successfully', async () => {
    const token = generateToken({ username: 'admin' })
    const event = {
      headers: { authorization: `Bearer ${token}` },
      pathParameters: { id: 'option-1' },
    } as unknown as APIGatewayProxyEvent

    const res = await handler(event)
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.id).toBe('option-1')
    expect(body.data.message).toBe('Shipment option deleted successfully')
  })
})
