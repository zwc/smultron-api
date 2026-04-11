import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'

const seedOption = {
  id: 'abc-123',
  name: 'Standard',
  description: 'Standard shipping',
  cost: 49,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const mockGetAllShipmentOptions = mock(async () => [seedOption])

mock.module('../services/dynamodb', () => ({
  putItem: async () => undefined,
  getItem: async () => null,
  deleteItem: async () => undefined,
  scanTable: async () => [],
  queryItems: async () => [],
  updateItem: async () => ({}),
}))

mock.module('../services/shipment-option', () => ({
  getAllShipmentOptions: mockGetAllShipmentOptions,
  getShipmentOption: async () => null,
  createShipmentOption: () => seedOption,
  saveShipmentOption: async () => undefined,
  updateShipmentOption: async () => ({}),
  deleteShipmentOption: async () => undefined,
}))

const { handler } = await import('./list.shipment-options')

describe('List Shipment-Options Handler', () => {
  beforeEach(() => {
    process.env.SHIPMENT_OPTIONS_TABLE = 'smultron-shipment-dev'
    mockGetAllShipmentOptions.mockClear()
    mockGetAllShipmentOptions.mockResolvedValue([seedOption])
  })

  test('returns 200 with list of shipment options', async () => {
    const event = {} as unknown as APIGatewayProxyEvent
    const res = await handler(event)
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('Standard')
  })

  test('returns 200 with empty list when no options exist', async () => {
    mockGetAllShipmentOptions.mockResolvedValue([])
    const event = {} as unknown as APIGatewayProxyEvent
    const res = await handler(event)
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data).toHaveLength(0)
  })
})
