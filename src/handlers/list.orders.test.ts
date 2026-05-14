import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'

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
  getAllOrders: mockGetAllOrders,
  getOrder: mockGetOrder,
}))

mock.module('../middleware/auth', () => ({
  verifyAuthToken: () => true,
}))

const { handler } = await import('./list.orders')

const makeEvent = (qs: Record<string, string> = {}): APIGatewayProxyEvent =>
  ({
    queryStringParameters: qs,
    headers: { authorization: 'Bearer test-token' },
    pathParameters: null,
    requestContext: { domainName: 'api.example.com', path: '/admin/orders' },
  }) as unknown as APIGatewayProxyEvent

describe('List Orders Handler', () => {
  beforeEach(() => {
    mockGetAllOrders.mockClear()
    mockGetOrder.mockClear()
  })

  test('defaults to active (paid) orders only — unpaid orders not shown', async () => {
    const response = await handler(makeEvent())
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)

    // Verify only active (paid) orders are returned by default
    expect(mockGetAllOrders).toHaveBeenCalledWith('active')
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe('order-paid')
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
    mock.module('../middleware/auth', () => ({
      verifyAuthToken: () => false,
    }))
    // Re-import to pick up updated mock
    const { handler: h } = await import('./list.orders')
    const response = await h(makeEvent())
    expect(response.statusCode).toBe(401)
  })
})
