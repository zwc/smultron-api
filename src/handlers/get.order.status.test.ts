import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'

const mockGetOrder = mock(async () => null)

mock.module('../services/product', () => ({
  getOrder: mockGetOrder,
}))

const { handler } = await import('./get.order.status')

const makeEvent = (id?: string): APIGatewayProxyEvent =>
  ({
    pathParameters: id ? { id } : {},
    headers: {},
  }) as unknown as APIGatewayProxyEvent

const baseOrder = {
  id: 'order-abc',
  number: '2604.001',
  date: 0,
  date_change: 0,
  delivery: 'postnord',
  delivery_cost: 82,
  information: {
    name: 'Test',
    company: '',
    email: 't@t.se',
    phone: '46700000000',
  },
  cart: [],
  createdAt: '2026-04-11T00:00:00.000Z',
  updatedAt: '2026-04-11T00:00:00.000Z',
}

describe('Get Order Status Handler', () => {
  beforeEach(() => {
    mockGetOrder.mockClear()
  })

  test('returns 400 when id is missing', async () => {
    const res = await handler(makeEvent())
    expect(res.statusCode).toBe(400)
  })

  test('returns 404 when order does not exist', async () => {
    mockGetOrder.mockResolvedValueOnce(null)
    const res = await handler(makeEvent('nonexistent'))
    expect(res.statusCode).toBe(404)
  })

  test('returns pending when order status is inactive', async () => {
    mockGetOrder.mockResolvedValueOnce({ ...baseOrder, status: 'inactive' })
    const res = await handler(makeEvent('order-abc'))
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.status).toBe('pending')
    expect(body.data.orderId).toBe('order-abc')
    expect(body.data.orderNumber).toBe('2604.001')
  })

  test('returns paid when order status is active', async () => {
    mockGetOrder.mockResolvedValueOnce({ ...baseOrder, status: 'active' })
    const res = await handler(makeEvent('order-abc'))
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.status).toBe('paid')
  })

  test('returns cancelled when order status is invalid', async () => {
    mockGetOrder.mockResolvedValueOnce({ ...baseOrder, status: 'invalid' })
    const res = await handler(makeEvent('order-abc'))
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.status).toBe('cancelled')
  })
})
