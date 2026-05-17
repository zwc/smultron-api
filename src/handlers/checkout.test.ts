import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { productMockDefaults } from '../test-helpers/productMockDefaults'

const mockCreateSwishPayment = mock(() =>
  Promise.resolve({
    id: 'MOCK-SWISH-ID-001',
    location:
      'https://mss.cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests/MOCK-SWISH-ID-001',
    status: 'CREATED',
  }),
)

const mockSaveOrder = mock(() => Promise.resolve())
const mockReserveStock = mock(() => Promise.resolve(['RES-001', 'RES-002']))
const mockCancelOrderReservations = mock(() => Promise.resolve())

const mockProduct = {
  id: 'prod-1',
  slug: 'test-product',
  category: 'test',
  brand: 'TestBrand',
  title: 'Test Product',
  subtitle: 'A test product',
  price: 100,
  stock: 10,
  status: 'active' as const,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

const mockOrder = {
  id: '123',
  number: null, // Order number is null until payment is confirmed
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
      category: 'test',
      brand: 'TestBrand',
      title: 'Test Product',
      subtitle: 'A test product',
      price: 100,
    },
  ],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

mock.module('../services/dynamodb', () => ({
  putItem: async () => undefined,
  getItem: async () => null,
  deleteItem: async () => undefined,
  scanTable: async () => [],
  queryItems: async () => [],
  updateItem: async () => ({}),
  atomicIncrement: async () => 1,
}))

mock.module('../services/product', () => ({
  ...productMockDefaults,
  getProduct: async () => ({ ...mockProduct }),
  createOrder: async () => ({ ...mockOrder }),
  saveOrder: mockSaveOrder,
  updateProduct: async () => ({}),
  updateOrder: async () => ({}),
  getOrderByNumber: async () => null,
  getOrder: async () => null,
  assignOrderNumber: async () => 'mocked-number',
}))

mock.module('../services/swish', () => ({
  createSwishPayment: mockCreateSwishPayment,
  cancelSwishPayment: mock(() => Promise.resolve()),
  getSwishPaymentStatus: mock(() => Promise.resolve(null)),
}))

mock.module('../services/stock-reservation', () => ({
  reserveStock: mockReserveStock,
  cancelOrderReservations: mockCancelOrderReservations,
  confirmReservations: async () => undefined,
  confirmOrderReservations: async () => undefined,
  cancelReservations: async () => undefined,
}))

mock.module('../services/email', () => ({
  sendOrderConfirmationEmails: async () => undefined,
  sendCustomerOrderConfirmation: async () => undefined,
  sendAdminOrderNotification: async () => undefined,
}))

mock.module('../services/shipment-option', () => ({
  getShipmentOptionByName: async (name: string) =>
    name === 'postnord'
      ? {
          id: '1',
          name: 'postnord',
          description: 'spårbart med postnord',
          cost: 49,
          createdAt: '',
          updatedAt: '',
        }
      : null,
  getAllShipmentOptions: async () => [],
  getShipmentOption: async () => null,
  createShipmentOption: () => ({}),
  saveShipmentOption: async () => undefined,
  updateShipmentOption: async () => ({}),
  deleteShipmentOption: async () => undefined,
}))

const { handler } = await import('./checkout')

const makeCheckoutEvent = (
  body: Record<string, unknown>,
): APIGatewayProxyEvent =>
  ({
    body: JSON.stringify(body),
    headers: {},
    pathParameters: null,
  }) as unknown as APIGatewayProxyEvent

const validCheckoutBody = {
  order: {
    payment: 'swish',
    delivery: 'postnord',
    name: 'Test User',
    company: '',
    address: 'Testgatan 1',
    zip: '12345',
    city: 'Stockholm',
    email: 'test@example.com',
    phone: '0701234567',
  },
  cart: [{ id: 'prod-1', number: 2 }],
}

describe('Checkout Handler', () => {
  beforeEach(() => {
    mockCreateSwishPayment.mockClear()
    mockSaveOrder.mockClear()
    mockReserveStock.mockClear()
    mockCancelOrderReservations.mockClear()
  })

  test('returns 400 when body is missing', async () => {
    const event = { body: null, headers: {} } as unknown as APIGatewayProxyEvent
    const response = await handler(event)
    expect(response.statusCode).toBe(200)
  })

  test('returns 400 when validation fails', async () => {
    const event = makeCheckoutEvent({ order: {}, cart: [] })
    const response = await handler(event)
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.error.message).toContain('Validation error')
  })

  test('creates order and initiates swish payment', async () => {
    const event = makeCheckoutEvent(validCheckoutBody)
    const response = await handler(event)
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(201)
    expect(body.data.order.id).toBe('123')
    // Order number is null at checkout — assigned only after payment is confirmed
    expect(body.data.order.number).toBeNull()
    expect(body.data.payment.method).toBe('swish')
    expect(body.data.payment.status).toBe('created')
    expect(body.data.payment.reference).toBe('MOCK-SWISH-ID-001')
  })

  test('calls createSwishPayment with order.id (not order number)', async () => {
    const event = makeCheckoutEvent(validCheckoutBody)
    await handler(event)

    expect(mockCreateSwishPayment).toHaveBeenCalledTimes(1)
    const [paymentReference, amount, phone, message] =
      mockCreateSwishPayment.mock.calls[0]
    // Payment reference is the order ID so the callback can look up the order
    expect(paymentReference).toBe('123')
    expect(amount).toBe(249) // 100 * 2 + 49 delivery
    expect(phone).toBe('0701234567')
    expect(message).toBe('Minibutik')
  })

  test('reserves stock before payment', async () => {
    const event = makeCheckoutEvent(validCheckoutBody)
    await handler(event)

    expect(mockReserveStock).toHaveBeenCalledTimes(1)
  })

  test('saves order with inactive status and no order number before payment', async () => {
    const event = makeCheckoutEvent(validCheckoutBody)
    await handler(event)

    expect(mockSaveOrder).toHaveBeenCalledTimes(1)
    const savedOrder = mockSaveOrder.mock.calls[0][0] as Record<string, unknown>
    expect(savedOrder.status).toBe('inactive')
    expect(savedOrder.number).toBeNull()
  })

  test('cancels reservations when swish payment fails', async () => {
    mockCreateSwishPayment.mockImplementationOnce(() =>
      Promise.reject(new Error('Swish unavailable')),
    )

    const event = makeCheckoutEvent(validCheckoutBody)
    const response = await handler(event)

    expect(response.statusCode).toBe(200)
    expect(mockCancelOrderReservations).toHaveBeenCalledTimes(1)
  })

  test('returns INSUFFICIENT_STOCK errorCode when stock reservation fails', async () => {
    mockReserveStock.mockImplementationOnce(() =>
      Promise.reject(new Error('Insufficient stock for product prod-1. Available: 0, Requested: 2')),
    )

    const event = makeCheckoutEvent(validCheckoutBody)
    const response = await handler(event)
    const body = JSON.parse(response.body)

    expect(response.statusCode).toBe(200)
    expect(body.error.message).toContain('Insufficient stock')
    expect(body.meta.errorCode).toBe('INSUFFICIENT_STOCK')
  })
})
