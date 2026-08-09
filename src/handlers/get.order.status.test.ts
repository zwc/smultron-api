import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'

import { productMockDefaults } from '../test-helpers/productMockDefaults'

const mockCleanupExpiredReservations = mock(async () => 0)

mock.module('../services/stock-reservation', () => ({
  cleanupExpiredReservations: mockCleanupExpiredReservations,
  reserveStock: async () => [],
  getActiveReservations: async () => [],
  getOrderReservations: async () => [],
  confirmReservations: async () => undefined,
  cancelReservations: async () => undefined,
  confirmOrderReservations: async () => undefined,
  cancelOrderReservations: async () => undefined,
}))

const mockGetOrder = mock(async () => null)
const mockGetOrderPayments = mock(async () => [])

mock.module('../services/product', () => ({
  ...productMockDefaults,
  getOrder: mockGetOrder,
}))

mock.module('../services/payment', () => ({
  getOrderPayments: mockGetOrderPayments,
}))

const { handler } = await import('./get.order.status')
const makeEvent = (id?: string): APIGatewayProxyEvent =>
  ({
    pathParameters: id ? { id } : {},
    headers: {},
  }) as unknown as APIGatewayProxyEvent

const baseOrder = {
  id: 'order-abc',
  number: '2604001', // present on paid orders
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
    mockGetOrderPayments.mockClear()
    mockGetOrderPayments.mockResolvedValue([])
    mockCleanupExpiredReservations.mockClear()
  })

  test('cleans up expired reservations on every request', async () => {
    mockGetOrder.mockResolvedValueOnce({ ...baseOrder, status: 'active' })
    await handler(makeEvent('order-abc'))
    expect(mockCleanupExpiredReservations).toHaveBeenCalledTimes(1)
  })

  test('returns 400 when id is missing', async () => {
    const res = await handler(makeEvent())
    expect(res.statusCode).toBe(200)
  })

  test('returns 404 when order does not exist', async () => {
    mockGetOrder.mockResolvedValueOnce(null)
    const res = await handler(makeEvent('nonexistent'))
    expect(res.statusCode).toBe(200)
  })

  test('returns inactive status and information when order status is inactive', async () => {
    mockGetOrder.mockResolvedValueOnce({
      ...baseOrder,
      number: null,
      status: 'inactive',
    })
    const res = await handler(makeEvent('order-abc'))
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.status).toBe('inactive')
    expect(body.data.id).toBe('order-abc')
    expect(body.data.number).toBeNull()
    expect(body.data.information.name).toBe('Test')
  })

  test('returns active status and information when order status is active', async () => {
    mockGetOrder.mockResolvedValueOnce({ ...baseOrder, status: 'active' })
    const res = await handler(makeEvent('order-abc'))
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.status).toBe('active')
    expect(body.data.number).toBe('2604001')
    expect(body.data.information.name).toBe('Test')
  })

  test('returns invalid when order status is invalid', async () => {
    mockGetOrder.mockResolvedValueOnce({ ...baseOrder, status: 'invalid' })
    const res = await handler(makeEvent('order-abc'))
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data.status).toBe('invalid')
  })

  test('returns every connected Swish payment under payments', async () => {
    const payments = [
      { id: 'payment-1', status: 'DECLINED' },
      { id: 'payment-2', status: 'CREATED' },
    ]
    mockGetOrder.mockResolvedValueOnce({ ...baseOrder, status: 'unpaid' })
    mockGetOrderPayments.mockResolvedValueOnce(payments as any)

    const res = await handler(makeEvent('order-abc'))
    const body = JSON.parse(res.body)

    expect(mockGetOrderPayments).toHaveBeenCalledWith('order-abc')
    expect(body.data.payments).toEqual(payments)
  })
})
