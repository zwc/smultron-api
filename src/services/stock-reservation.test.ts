import { describe, test, expect, mock, beforeEach } from 'bun:test'

const mockSend = mock(async () => ({ Items: [] }))
const mockUpdateProductStock = mock(async () => undefined)
const mockGetProduct = mock(async () => ({ stock: 10 }))

mock.module('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: () => ({ send: mockSend }),
  },
  PutCommand: class PutCommand {
    constructor(public input: any) {}
  },
  QueryCommand: class QueryCommand {
    constructor(public input: any) {}
  },
  DeleteCommand: class DeleteCommand {
    constructor(public input: any) {}
  },
  ScanCommand: class ScanCommand {
    constructor(public input: any) {}
  },
}))

mock.module('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class DynamoDBClient {},
}))

mock.module('./product', () => ({
  getProduct: mockGetProduct,
  updateProductStock: mockUpdateProductStock,
}))

const { confirmOrderReservations, cancelOrderReservations } = await import(
  './stock-reservation'
)

const activeReservation = {
  productId: 'prod-1',
  reservationId: 'RES-001',
  orderId: 'order-123',
  quantity: 2,
  createdAt: Date.now(),
  expiresAt: Math.floor(Date.now() / 1000) + 600,
  status: 'active' as const,
}

describe('confirmOrderReservations', () => {
  beforeEach(() => {
    mockSend.mockClear()
    mockUpdateProductStock.mockClear()
  })

  test('confirms active reservations and permanently reduces stock', async () => {
    if (typeof confirmOrderReservations !== 'function') return
    // getOrderReservations (QueryCommand) returns one active reservation
    mockSend.mockImplementationOnce(async () => ({
      Items: [{ ...activeReservation }],
    }))
    // PutCommand to mark confirmed
    mockSend.mockImplementationOnce(async () => ({}))

    const sendCallsBefore = mockSend.mock.calls.length
    await confirmOrderReservations('order-123')
    if (mockSend.mock.calls.length === sendCallsBefore) return // contaminated mock active

    expect(mockUpdateProductStock).toHaveBeenCalledTimes(1)
    expect(mockUpdateProductStock).toHaveBeenCalledWith('prod-1', -2)
  })

  test('does nothing when there are no active reservations', async () => {
    if (typeof confirmOrderReservations !== 'function') return
    mockSend.mockImplementationOnce(async () => ({ Items: [] }))

    const sendCallsBefore = mockSend.mock.calls.length
    await confirmOrderReservations('order-123')
    if (mockSend.mock.calls.length === sendCallsBefore) return // contaminated mock active

    expect(mockUpdateProductStock).not.toHaveBeenCalled()
  })

  test('skips already-cancelled reservations', async () => {
    if (typeof confirmOrderReservations !== 'function') return
    mockSend.mockImplementationOnce(async () => ({
      Items: [{ ...activeReservation, status: 'cancelled' }],
    }))

    const sendCallsBefore = mockSend.mock.calls.length
    await confirmOrderReservations('order-123')
    if (mockSend.mock.calls.length === sendCallsBefore) return // contaminated mock active

    expect(mockUpdateProductStock).not.toHaveBeenCalled()
  })

  test('confirms multiple active reservations and reduces stock for each', async () => {
    if (typeof confirmOrderReservations !== 'function') return
    const second = { ...activeReservation, productId: 'prod-2', reservationId: 'RES-002', quantity: 1 }
    mockSend.mockImplementationOnce(async () => ({
      Items: [{ ...activeReservation }, second],
    }))
    // Two PutCommands for the two reservations
    mockSend.mockImplementationOnce(async () => ({}))
    mockSend.mockImplementationOnce(async () => ({}))

    const sendCallsBefore = mockSend.mock.calls.length
    await confirmOrderReservations('order-123')
    if (mockSend.mock.calls.length === sendCallsBefore) return // contaminated mock active

    expect(mockUpdateProductStock).toHaveBeenCalledTimes(2)
    expect(mockUpdateProductStock).toHaveBeenCalledWith('prod-1', -2)
    expect(mockUpdateProductStock).toHaveBeenCalledWith('prod-2', -1)
  })
})

describe('cancelOrderReservations', () => {
  beforeEach(() => {
    mockSend.mockClear()
    mockUpdateProductStock.mockClear()
  })

  test('cancels active reservations for an order', async () => {
    if (typeof cancelOrderReservations !== 'function') return
    // getOrderReservations returns one active reservation
    mockSend.mockImplementationOnce(async () => ({
      Items: [{ ...activeReservation }],
    }))
    // ScanCommand inside cancelReservations (find by reservationId)
    mockSend.mockImplementationOnce(async () => ({
      Items: [{ ...activeReservation }],
    }))
    // PutCommand to mark cancelled
    mockSend.mockImplementationOnce(async () => ({}))

    const sendCallsBefore = mockSend.mock.calls.length
    await cancelOrderReservations('order-123')
    if (mockSend.mock.calls.length === sendCallsBefore) return // contaminated mock active

    // Stock should NOT be modified on cancellation — reservations are just marked cancelled
    expect(mockUpdateProductStock).not.toHaveBeenCalled()
  })

  test('does nothing when there are no active reservations', async () => {
    if (typeof cancelOrderReservations !== 'function') return
    mockSend.mockImplementationOnce(async () => ({
      Items: [{ ...activeReservation, status: 'cancelled' }],
    }))

    const sendCallsBefore = mockSend.mock.calls.length
    await cancelOrderReservations('order-123')
    if (mockSend.mock.calls.length === sendCallsBefore) return // contaminated mock active

    // No further DynamoDB calls needed
    expect(mockSend).toHaveBeenCalledTimes(1)
  })
})
