import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'

const mockUpdateOrder = mock(() => Promise.resolve({}))
const mockCancelOrderReservations = mock(() => Promise.resolve())
const mockSendOrderConfirmationEmails = mock(() => Promise.resolve())

const mockOrder = {
  id: 'order-123',
  number: '2604.001',
  date: Date.now(),
  date_change: Date.now(),
  status: 'inactive' as const,
  delivery: 'shipping',
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
      slug: 'test-product',
      brand: 'TestBrand',
      title: 'Test Product',
      subtitle: 'A test product',
      price: 100,
    },
  ],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

const mockGetOrderByNumber = mock(() => Promise.resolve({ ...mockOrder }))

mock.module('../services/dynamodb', () => ({
  putItem: async () => undefined,
  getItem: async () => null,
  deleteItem: async () => undefined,
  scanTable: async () => [],
  queryItems: async () => [],
  updateItem: async () => ({}),
}))

mock.module('../services/product', () => ({
  getOrderByNumber: mockGetOrderByNumber,
  updateOrder: mockUpdateOrder,
}))

mock.module('../services/stock-reservation', () => ({
  confirmReservations: async () => undefined,
  cancelOrderReservations: mockCancelOrderReservations,
  cancelReservations: async () => undefined,
}))

mock.module('../services/email', () => ({
  sendOrderConfirmationEmails: mockSendOrderConfirmationEmails,
  sendCustomerOrderConfirmation: async () => undefined,
  sendAdminOrderNotification: async () => undefined,
}))

const { handler } = await import('./swish.callback')

const makeCallbackEvent = (
  body: Record<string, unknown>,
): APIGatewayProxyEvent =>
  ({
    body: JSON.stringify(body),
    headers: {},
    pathParameters: null,
  }) as unknown as APIGatewayProxyEvent

const paidCallback = {
  id: 'SWISH-PAYMENT-ID-001',
  payeePaymentReference: '2604.001',
  paymentReference: 'REF123',
  callbackUrl: 'https://smultron.zwc.se/api/v1/swish/callback',
  payerAlias: '46701234567',
  payeeAlias: '1236166490',
  amount: 249,
  currency: 'SEK',
  message: 'Order 2604.001',
  status: 'PAID',
  dateCreated: '2025-01-01T00:00:00Z',
  datePaid: '2025-01-01T00:01:00Z',
  errorCode: null,
  errorMessage: null,
}

describe('Swish Callback Handler', () => {
  beforeEach(() => {
    mockUpdateOrder.mockClear()
    mockCancelOrderReservations.mockClear()
    mockSendOrderConfirmationEmails.mockClear()
    mockGetOrderByNumber.mockClear()
    mockGetOrderByNumber.mockImplementation(() =>
      Promise.resolve({ ...mockOrder }),
    )
  })

  test('returns 200 when body is missing', async () => {
    const event = {
      body: null,
      headers: {},
    } as unknown as APIGatewayProxyEvent
    const response = await handler(event)
    expect(response.statusCode).toBe(200)
  })

  test('updates order to active when payment is PAID', async () => {
    const event = makeCallbackEvent(paidCallback)
    const response = await handler(event)
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(200)
    expect(body.data.received).toBe(true)
    expect(body.data.status).toBe('PAID')

    expect(mockGetOrderByNumber).toHaveBeenCalledWith('2604.001')
    expect(mockUpdateOrder).toHaveBeenCalledWith('order-123', {
      status: 'active',
    })
  })

  test('sends confirmation emails on PAID', async () => {
    const event = makeCallbackEvent(paidCallback)
    await handler(event)

    expect(mockSendOrderConfirmationEmails).toHaveBeenCalledTimes(1)
    const emailData = mockSendOrderConfirmationEmails.mock
      .calls[0][0] as Record<string, unknown>
    expect(emailData.orderId).toBe('2604.001')
    expect(emailData.paymentMethod).toBe('swish')
    expect(emailData.customerEmail).toBe('test@example.com')
  })

  test('cancels reservations and marks order invalid on DECLINED', async () => {
    const event = makeCallbackEvent({ ...paidCallback, status: 'DECLINED' })
    await handler(event)

    expect(mockCancelOrderReservations).toHaveBeenCalledWith('order-123')
    expect(mockUpdateOrder).toHaveBeenCalledWith('order-123', {
      status: 'invalid',
    })
  })

  test('cancels reservations and marks order invalid on ERROR', async () => {
    const event = makeCallbackEvent({
      ...paidCallback,
      status: 'ERROR',
      errorCode: 'RF07',
      errorMessage: 'Transaction declined',
    })
    await handler(event)

    expect(mockCancelOrderReservations).toHaveBeenCalledWith('order-123')
    expect(mockUpdateOrder).toHaveBeenCalledWith('order-123', {
      status: 'invalid',
    })
  })

  test('cancels reservations and marks order invalid on CANCELLED', async () => {
    const event = makeCallbackEvent({ ...paidCallback, status: 'CANCELLED' })
    await handler(event)

    expect(mockCancelOrderReservations).toHaveBeenCalledWith('order-123')
    expect(mockUpdateOrder).toHaveBeenCalledWith('order-123', {
      status: 'invalid',
    })
  })

  test('handles missing order gracefully', async () => {
    mockGetOrderByNumber.mockImplementation(() => Promise.resolve(null))

    const event = makeCallbackEvent(paidCallback)
    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    expect(mockUpdateOrder).not.toHaveBeenCalled()
  })

  test('does not crash on CREATED status', async () => {
    const event = makeCallbackEvent({ ...paidCallback, status: 'CREATED' })
    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    expect(mockUpdateOrder).not.toHaveBeenCalled()
  })
})
