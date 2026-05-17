import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { generateToken } from '../utils/jwt'
import { productMockDefaults } from '../test-helpers/productMockDefaults'

const paidOrder = {
  id: 'order-paid',
  number: '2604001',
  date: Date.now(),
  date_change: Date.now(),
  status: 'active' as const,
  delivery: 'postnord',
  delivery_cost: 49,
  information: { name: 'Paid User', company: '', email: 'paid@example.com', phone: '070' },
  cart: [],
  createdAt: '2025-01-02T00:00:00Z',
  updatedAt: '2025-01-02T00:00:00Z',
}

const unpaidOrder = {
  id: 'order-unpaid',
  number: null,
  date: Date.now(),
  date_change: Date.now(),
  status: 'inactive' as const,
  delivery: 'postnord',
  delivery_cost: 49,
  information: { name: 'Unpaid User', company: '', email: 'unpaid@example.com', phone: '070' },
  cart: [],
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

const mockGetAllOrders = mock(async (status?: string) => {
  if (status === 'active') return [paidOrder]
  if (status === 'inactive') return [unpaidOrder]
  return [paidOrder, unpaidOrder]
})

const mockGetOrder = mock(async () => null)

mock.module('../services/product', () => ({
  ...productMockDefaults,
  getAllOrders: mockGetAllOrders,
  getOrder: mockGetOrder,
}))

const { handler } = await import('./list.orders')

const makeEvent = (qs: Record<string, string> = {}, withAuth = true): APIGatewayProxyEvent =>
  ({
    queryStringParameters: qs,
    headers: withAuth
      ? { authorization: `Bearer ${generateToken({ username: 'admin' })}` }
      : {},
    pathParameters: null,
    requestContext: { domainName: 'api.example.com', path: '/admin/orders' },
  }) as unknown as APIGatewayProxyEvent

describe('List Orders Handler', () => {
  beforeEach(() => {
    mockGetAllOrders.mockClear()
    mockGetOrder.mockClear()
    process.env.JWT_SECRET = 'very-secure-dev-jwt-secret'
    process.env.DISABLE_AUTH = 'false'
  })

  test('defaults to all orders when no status filter is provided', async () => {
    const response = await handler(makeEvent())
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)

    expect(mockGetAllOrders).toHaveBeenCalledWith(undefined)
    expect(body.data).toHaveLength(2)
  })

  test('explicit status=active also returns only paid orders', async () => {
    const response = await handler(makeEvent({ status: 'active' }))
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].status).toBe('active')
  })

  test('status=inactive returns checkout attempts for debugging', async () => {
    const response = await handler(makeEvent({ status: 'inactive' }))
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)

    expect(mockGetAllOrders).toHaveBeenCalledWith('inactive')
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe('order-unpaid')
    expect(body.data[0].number).toBeNull()
  })

  test('returns 401 when auth token is missing', async () => {
    const response = await handler(makeEvent({}, false))
    expect(response.statusCode).toBe(200)
  })
})
