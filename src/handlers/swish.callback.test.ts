import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { productMockDefaults } from '../test-helpers/productMockDefaults'

const mockUpdateOrder = mock(() => Promise.resolve({}))
const mockCancelOrderReservations = mock(() => Promise.resolve())
const mockConfirmOrderReservations = mock(() => Promise.resolve())
const mockSendOrderConfirmationEmails = mock(() => Promise.resolve())
const mockAssignOrderNumber = mock(() => Promise.resolve('2605.001'))

const mockOrder = {
  id: '123',
  number: null, // null until payment confirmed
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

// payeePaymentReference is now the order ID (not order number)
const mockGetOrder = mock(() => Promise.resolve({ ...mockOrder }))

mock.module('../services/dynamodb', () => ({
  putItem: async () => undefined,
  getItem: async () => null,
  deleteItem: async () => undefined,
  scanTable: async () => [],
  queryItems: async () => [],
  updateItem: async () => ({}),
}))

mock.module('../services/product', () => ({
  ...productMockDefaults,
  getOrder: mockGetOrder,
  updateOrder: mockUpdateOrder,
  assignOrderNumber: mockAssignOrderNumber,
}))

mock.module('../services/stock-reservation', () => ({
  reserveStock: async () => [],
  confirmReservations: async () => undefined,
  confirmOrderReservations: mockConfirmOrderReservations,
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

// payeePaymentReference is now the order ID
const paidCallback = {
  id: 'SWISH-PAYMENT-ID-001',
  payeePaymentReference: '123', // order ID (not order number)
  paymentReference: 'REF123',
  callbackUrl: 'https://smultron.zwc.se/api/v1/swish/callback',
  payerAlias: '46701234567',
  payeeAlias: '1236166490',
  amount: 249,
  currency: 'SEK',
  message: 'Order 123',
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
    mockConfirmOrderReservations.mockClear()
    mockSendOrderConfirmationEmails.mockClear()
    mockAssignOrderNumber.mockClear()
    mockAssignOrderNumber.mockImplementation(() => Promise.resolve('2605.001'))
    mockGetOrder.mockClear()
    mockGetOrder.mockImplementation(() => Promise.resolve({ ...mockOrder }))
  })

  test('returns 200 when body is missing', async () => {
    const event = {
      body: null,
      headers: {},
    } as unknown as APIGatewayProxyEvent
    const response = await handler(event)
    expect(response.statusCode).toBe(200)
  })

  test('looks up order by ID (payeePaymentReference) on PAID', async () => {
    const event = makeCallbackEvent(paidCallback)
    await handler(event)

    expect(mockGetOrder).toHaveBeenCalledWith('123')
  })

  test('assigns order number only after payment is PAID', async () => {
    const event = makeCallbackEvent(paidCallback)
    await handler(event)

    expect(mockAssignOrderNumber).toHaveBeenCalledTimes(1)
    expect(mockAssignOrderNumber).toHaveBeenCalledWith('123')
  })

  test('updates order to active when payment is PAID', async () => {
    const event = makeCallbackEvent(paidCallback)
    const response = await handler(event)
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(200)
    expect(body.data.received).toBe(true)
    expect(body.data.status).toBe('PAID')

    expect(mockUpdateOrder).toHaveBeenCalledWith('123', {
      status: 'active',
    })
  })

  test('sends confirmation emails after number assigned on PAID', async () => {
    const event = makeCallbackEvent(paidCallback)
    await handler(event)

    expect(mockSendOrderConfirmationEmails).toHaveBeenCalledTimes(1)
    const emailData = mockSendOrderConfirmationEmails.mock
      .calls[0][0] as Record<string, unknown>
    // Email uses the assigned order number, not the order ID
    expect(emailData.orderId).toBe('2605.001')
    expect(emailData.paymentMethod).toBe('swish')
    expect(emailData.customerEmail).toBe('test@example.com')
  })

  test('confirms stock reservations when payment is PAID', async () => {
    const event = makeCallbackEvent(paidCallback)
    await handler(event)

    expect(mockConfirmOrderReservations).toHaveBeenCalledTimes(1)
    expect(mockConfirmOrderReservations).toHaveBeenCalledWith('123')
  })

  test('does not confirm reservations on DECLINED', async () => {
    const event = makeCallbackEvent({ ...paidCallback, status: 'DECLINED' })
    await handler(event)

    expect(mockConfirmOrderReservations).not.toHaveBeenCalled()
    expect(mockCancelOrderReservations).toHaveBeenCalledWith('123')
  })

  test('does not confirm reservations on ERROR', async () => {
    const event = makeCallbackEvent({ ...paidCallback, status: 'ERROR', errorCode: 'RF07', errorMessage: 'Declined' })
    await handler(event)

    expect(mockConfirmOrderReservations).not.toHaveBeenCalled()
    expect(mockCancelOrderReservations).toHaveBeenCalledWith('123')
  })

  test('does not confirm reservations on CANCELLED', async () => {
    const event = makeCallbackEvent({ ...paidCallback, status: 'CANCELLED' })
    await handler(event)

    expect(mockConfirmOrderReservations).not.toHaveBeenCalled()
    expect(mockCancelOrderReservations).toHaveBeenCalledWith('123')
  })

  test('never assigns order number on DECLINED', async () => {
    const event = makeCallbackEvent({ ...paidCallback, status: 'DECLINED' })
    await handler(event)

    expect(mockAssignOrderNumber).not.toHaveBeenCalled()
    expect(mockCancelOrderReservations).toHaveBeenCalledWith('123')
    expect(mockUpdateOrder).toHaveBeenCalledWith('123', {
      status: 'invalid',
    })
  })

  test('never assigns order number on ERROR', async () => {
    const event = makeCallbackEvent({
      ...paidCallback,
      status: 'ERROR',
      errorCode: 'RF07',
      errorMessage: 'Transaction declined',
    })
    await handler(event)

    expect(mockAssignOrderNumber).not.toHaveBeenCalled()
    expect(mockCancelOrderReservations).toHaveBeenCalledWith('123')
    expect(mockUpdateOrder).toHaveBeenCalledWith('123', {
      status: 'invalid',
    })
  })

  test('never assigns order number on CANCELLED', async () => {
    const event = makeCallbackEvent({ ...paidCallback, status: 'CANCELLED' })
    await handler(event)

    expect(mockAssignOrderNumber).not.toHaveBeenCalled()
    expect(mockCancelOrderReservations).toHaveBeenCalledWith('123')
    expect(mockUpdateOrder).toHaveBeenCalledWith('123', {
      status: 'invalid',
    })
  })

  test('does not send confirmation email on DECLINED', async () => {
    const event = makeCallbackEvent({ ...paidCallback, status: 'DECLINED' })
    await handler(event)

    expect(mockSendOrderConfirmationEmails).not.toHaveBeenCalled()
  })

  test('handles missing order gracefully', async () => {
    mockGetOrder.mockImplementation(() => Promise.resolve(null))

    const event = makeCallbackEvent(paidCallback)
    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    expect(mockUpdateOrder).not.toHaveBeenCalled()
    expect(mockAssignOrderNumber).not.toHaveBeenCalled()
  })

  test('does not crash on CREATED status', async () => {
    const event = makeCallbackEvent({ ...paidCallback, status: 'CREATED' })
    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    expect(mockUpdateOrder).not.toHaveBeenCalled()
    expect(mockAssignOrderNumber).not.toHaveBeenCalled()
  })
})
