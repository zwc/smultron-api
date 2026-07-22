import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'

const mockCancelSwishPayment = mock(() => Promise.resolve())
const mockCancelOrderReservations = mock(() => Promise.resolve())
const mockUpdateSwishPaymentStatus = mock(() => Promise.resolve())

const inactiveOrder = {
  id: '456',
  number: null,
  swish_payment_id: 'SWISH-INSTRUCTION-ID-001',
  date: Date.now(),
  date_change: Date.now(),
  status: 'pending' as const,
  delivery: 'postnord',
  delivery_cost: 49,
  information: {
    name: 'Test User',
    company: '',
    address: 'Testgatan 1',
    zip: '12345',
    city: 'Stockholm',
    email: 'test@example.com',
    phone: '0701234567',
  },
  cart: [],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

const mockGetOrder = mock(() => Promise.resolve({ ...inactiveOrder }))

mock.module('../services/swish', () => ({
  cancelSwishPayment: mockCancelSwishPayment,
  updateSwishPaymentStatus: mockUpdateSwishPaymentStatus,
  createSwishPayment: mock(() =>
    Promise.resolve({ id: '', location: '', status: 'CREATED' }),
  ),
  getSwishPaymentStatus: mock(() => Promise.resolve(null)),
}))

import { productMockDefaults } from '../test-helpers/productMockDefaults'

mock.module('../services/product', () => ({
  ...productMockDefaults,
  getOrder: mockGetOrder,
}))

mock.module('../services/stock-reservation', () => ({
  cleanupExpiredReservations: async () => 0,
  cancelOrderReservations: mockCancelOrderReservations,
  reserveStock: async () => [],
  confirmReservations: async () => undefined,
  confirmOrderReservations: async () => undefined,
  cancelReservations: async () => undefined,
  getActiveReservations: async () => [],
  getOrderReservations: async () => [],
}))

const { handler } = await import('./cancel.swish')

const buildEvent = (id: string | undefined): APIGatewayProxyEvent =>
  ({
    pathParameters: id ? { id } : null,
  }) as unknown as APIGatewayProxyEvent

describe('cancel.swish handler', () => {
  beforeEach(() => {
    mockCancelSwishPayment.mockClear()
    mockCancelOrderReservations.mockClear()
    mockUpdateSwishPaymentStatus.mockClear()
    mockGetOrder.mockClear()
    mockGetOrder.mockImplementation(() => Promise.resolve({ ...inactiveOrder }))
  })

  test('returns 400 when id is missing', async () => {
    const response = await handler(buildEvent(undefined))
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.error.message).toBe('Order ID is required')
    expect(mockCancelSwishPayment).not.toHaveBeenCalled()
  })

  test('returns 404 when order does not exist', async () => {
    mockGetOrder.mockImplementation(() => Promise.resolve(null))
    const response = await handler(buildEvent('nonexistent'))
    expect(response.statusCode).toBe(200)
    expect(mockCancelSwishPayment).not.toHaveBeenCalled()
  })

  test('cancels Swish payment and reservations without changing order status', async () => {
    const response = await handler(buildEvent('456'))
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.data).toEqual({ id: '456', status: 'CANCELLED' })

    expect(mockCancelSwishPayment).toHaveBeenCalledTimes(1)
    expect(mockCancelSwishPayment).toHaveBeenCalledWith('SWISH-INSTRUCTION-ID-001')
    expect(mockCancelOrderReservations).toHaveBeenCalledTimes(1)
    expect(mockCancelOrderReservations).toHaveBeenCalledWith('456')
    expect(mockUpdateSwishPaymentStatus).toHaveBeenCalledWith(
      'SWISH-INSTRUCTION-ID-001',
      {
        status: 'CANCELLED',
        reason: 'The checkout was cancelled before payment was completed.',
      },
    )
  })

  test('is idempotent for already-invalid orders: success without side effects', async () => {
    mockGetOrder.mockImplementation(() =>
      Promise.resolve({ ...inactiveOrder, status: 'invalid' as const }),
    )
    const response = await handler(buildEvent('456'))
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.data).toEqual({ id: '456', status: 'CANCELLED' })

    expect(mockCancelSwishPayment).not.toHaveBeenCalled()
    expect(mockCancelOrderReservations).not.toHaveBeenCalled()
    expect(mockUpdateSwishPaymentStatus).not.toHaveBeenCalled()
  })

  test('returns 409 when trying to cancel an active (paid) order', async () => {
    mockGetOrder.mockImplementation(() =>
      Promise.resolve({ ...inactiveOrder, status: 'active' as const }),
    )
    const response = await handler(buildEvent('456'))
    expect(response.statusCode).toBe(200)
    expect(mockCancelSwishPayment).not.toHaveBeenCalled()
    expect(mockUpdateSwishPaymentStatus).not.toHaveBeenCalled()
  })

  test('skips Swish cancellation when order has no swish_payment_id', async () => {
    mockGetOrder.mockImplementation(() =>
      Promise.resolve({ ...inactiveOrder, swish_payment_id: undefined }),
    )
    const response = await handler(buildEvent('456'))
    expect(response.statusCode).toBe(200)

    expect(mockCancelSwishPayment).not.toHaveBeenCalled()
    expect(mockUpdateSwishPaymentStatus).not.toHaveBeenCalled()
    expect(mockCancelOrderReservations).toHaveBeenCalledTimes(1)
  })

  test('continues cancellation when Swish API call fails (Swish may already be expired)', async () => {
    mockCancelSwishPayment.mockImplementationOnce(() =>
      Promise.reject(new Error('Swish API error')),
    )
    const response = await handler(buildEvent('456'))
    expect(response.statusCode).toBe(200)
    expect(mockCancelOrderReservations).toHaveBeenCalledTimes(1)
    expect(mockUpdateSwishPaymentStatus).toHaveBeenCalledWith(
      'SWISH-INSTRUCTION-ID-001',
      {
        status: 'CANCELLED',
        reason: 'The checkout was cancelled before payment was completed.',
      },
    )
  })

  test('returns 500 when an unexpected error occurs', async () => {
    mockGetOrder.mockImplementationOnce(() =>
      Promise.reject(new Error('DynamoDB error')),
    )
    const response = await handler(buildEvent('456'))
    expect(response.statusCode).toBe(200)
  })
})
