import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { productMockDefaults } from '../test-helpers/productMockDefaults'

const mockConfirmOrderReservations = mock(() => Promise.resolve())
const mockAssignOrderNumber = mock(() => Promise.resolve('2605.001'))
const mockUpdateOrder = mock(() => Promise.resolve({}))
const mockSendOrderConfirmationEmails = mock(() => Promise.resolve())

const inactiveOrder = {
  id: '42',
  number: null,
  date: Date.now(),
  date_change: Date.now(),
  status: 'inactive' as const,
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
  cart: [
    {
      id: 'prod-1',
      number: 2,
      title: 'Test Product',
      price: 100,
    },
  ],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

const mockGetOrder = mock(() => Promise.resolve({ ...inactiveOrder }))

mock.module('../services/product', () => ({
  ...productMockDefaults,
  getOrder: mockGetOrder,
  updateOrder: mockUpdateOrder,
  assignOrderNumber: mockAssignOrderNumber,
}))

mock.module('../services/stock-reservation', () => ({
  cleanupExpiredReservations: async () => 0,
  confirmOrderReservations: mockConfirmOrderReservations,
  cancelOrderReservations: async () => undefined,
  reserveStock: async () => [],
  confirmReservations: async () => undefined,
  cancelReservations: async () => undefined,
  getActiveReservations: async () => [],
  getOrderReservations: async () => [],
}))

mock.module('../services/email', () => ({
  sendOrderConfirmationEmails: mockSendOrderConfirmationEmails,
  sendCustomerOrderConfirmation: async () => undefined,
  sendAdminOrderNotification: async () => undefined,
}))

const { handler } = await import('./test.confirm-payment')

const buildEvent = (id: string | undefined): APIGatewayProxyEvent =>
  ({
    pathParameters: id ? { id } : null,
  }) as unknown as APIGatewayProxyEvent

describe('test.confirm-payment handler', () => {
  beforeEach(() => {
    mockConfirmOrderReservations.mockClear()
    mockAssignOrderNumber.mockClear()
    mockUpdateOrder.mockClear()
    mockSendOrderConfirmationEmails.mockClear()
    mockGetOrder.mockClear()
    mockGetOrder.mockImplementation(() => Promise.resolve({ ...inactiveOrder }))
    mockAssignOrderNumber.mockImplementation(() => Promise.resolve('2605.001'))
  })

  test('returns 400 when id is missing', async () => {
    const response = await handler(buildEvent(undefined))
    expect(response.statusCode).toBe(200)
  })

  test('returns 404 when order does not exist', async () => {
    mockGetOrder.mockImplementation(() => Promise.resolve(null))
    const response = await handler(buildEvent('nonexistent'))
    expect(response.statusCode).toBe(200)
  })

  test('runs the full confirmation flow for a pending order', async () => {
    const response = await handler(buildEvent('42'))
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(200)
    expect(body.data.orderId).toBe('42')
    expect(body.data.orderNumber).toBe('2605.001')

    expect(mockConfirmOrderReservations).toHaveBeenCalledTimes(1)
    expect(mockConfirmOrderReservations).toHaveBeenCalledWith('42')
    expect(mockAssignOrderNumber).toHaveBeenCalledTimes(1)
    expect(mockAssignOrderNumber).toHaveBeenCalledWith('42')
    expect(mockUpdateOrder).toHaveBeenCalledWith('42', { status: 'active' })
    expect(mockSendOrderConfirmationEmails).toHaveBeenCalledTimes(1)
  })

  test('is idempotent: already-active order returns success without side effects', async () => {
    mockGetOrder.mockImplementation(() =>
      Promise.resolve({ ...inactiveOrder, status: 'active' as const, number: '2605.001' }),
    )

    const response = await handler(buildEvent('42'))
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(200)
    expect(body.data.orderNumber).toBe('2605.001')
    expect(body.data.message).toContain('already confirmed')

    expect(mockConfirmOrderReservations).not.toHaveBeenCalled()
    expect(mockAssignOrderNumber).not.toHaveBeenCalled()
    expect(mockUpdateOrder).not.toHaveBeenCalled()
  })

  test('works on an invalid order — the whole point of the override', async () => {
    mockGetOrder.mockImplementation(() =>
      Promise.resolve({ ...inactiveOrder, status: 'invalid' as const }),
    )

    const response = await handler(buildEvent('42'))
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(200)
    expect(body.data.orderId).toBe('42')
    expect(mockConfirmOrderReservations).toHaveBeenCalledTimes(1)
    expect(mockUpdateOrder).toHaveBeenCalledWith('42', { status: 'active' })
  })

  test('sends confirmation email with the assigned order number', async () => {
    await handler(buildEvent('42'))

    expect(mockSendOrderConfirmationEmails).toHaveBeenCalledTimes(1)
    const emailData = mockSendOrderConfirmationEmails.mock.calls[0][0] as Record<string, unknown>
    expect(emailData.orderId).toBe('2605.001')
    expect(emailData.paymentReference).toBe('test-override')
    expect(emailData.customerEmail).toBe('test@example.com')
  })

  test('returns 500 on unexpected error', async () => {
    mockGetOrder.mockImplementation(() => Promise.reject(new Error('DB error')))
    const response = await handler(buildEvent('42'))
    expect(response.statusCode).toBe(200)
  })
})
