import { describe, test, expect, mock, beforeEach } from 'bun:test'

// Other handler tests mock this module; restore so we load the real implementation.
mock.restore()

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

const { confirmOrderReservations, cancelOrderReservations, reserveStock } =
  await import(`./stock-reservation?test=${Date.now()}`)

const activeReservation = {
  productId: 'prod-1',
  reservationId: 'RES-001',
  orderId: 'order-123',
  quantity: 2,
  createdAt: Date.now(),
  expiresAt: Math.floor(Date.now() / 1000) + 600,
  status: 'active' as const,
}

describe('reserveStock', () => {
  beforeEach(() => {
    mockSend.mockClear()
    mockUpdateProductStock.mockClear()
    mockUpdateProductStock.mockImplementation(async () => undefined)
  })

  test('atomically decrements stock then writes reservation', async () => {
    mockSend.mockImplementation(async () => ({}))

    const ids = await reserveStock('order-123', [{ id: 'prod-1', quantity: 2 }])

    expect(mockUpdateProductStock).toHaveBeenCalledWith('prod-1', -2)
    expect(ids).toHaveLength(1)
    expect(mockSend).toHaveBeenCalled()
  })

  test('throws and does not leave reservation when stock condition fails', async () => {
    const err = new Error(' Conditional check failed')
    err.name = 'ConditionalCheckFailedException'
    mockUpdateProductStock.mockImplementationOnce(async () => {
      throw err
    })

    await expect(
      reserveStock('order-123', [{ id: 'prod-1', quantity: 2 }]),
    ).rejects.toThrow(/Insufficient stock/)

    expect(mockSend).not.toHaveBeenCalled()
  })
})

describe('confirmOrderReservations', () => {
  beforeEach(() => {
    mockSend.mockClear()
    mockUpdateProductStock.mockClear()
  })

  test('confirms active reservations without decreasing stock again', async () => {
    mockSend.mockImplementationOnce(async () => ({
      Items: [{ ...activeReservation }],
    }))
    mockSend.mockImplementationOnce(async () => ({}))

    await confirmOrderReservations('order-123')

    expect(mockUpdateProductStock).not.toHaveBeenCalled()
  })

  test('does nothing when there are no active reservations', async () => {
    mockSend.mockImplementationOnce(async () => ({ Items: [] }))

    await confirmOrderReservations('order-123')

    expect(mockUpdateProductStock).not.toHaveBeenCalled()
  })

  test('skips already-cancelled reservations', async () => {
    mockSend.mockImplementationOnce(async () => ({
      Items: [{ ...activeReservation, status: 'cancelled' }],
    }))

    await confirmOrderReservations('order-123')

    expect(mockUpdateProductStock).not.toHaveBeenCalled()
  })

  test('confirms multiple active reservations without stock changes', async () => {
    const second = {
      ...activeReservation,
      productId: 'prod-2',
      reservationId: 'RES-002',
      quantity: 1,
    }
    mockSend.mockImplementationOnce(async () => ({
      Items: [{ ...activeReservation }, second],
    }))
    mockSend.mockImplementationOnce(async () => ({}))
    mockSend.mockImplementationOnce(async () => ({}))

    await confirmOrderReservations('order-123')

    expect(mockUpdateProductStock).not.toHaveBeenCalled()
  })
})

describe('cancelOrderReservations', () => {
  beforeEach(() => {
    mockSend.mockClear()
    mockUpdateProductStock.mockClear()
  })

  test('cancels active reservations and restores stock', async () => {
    mockSend.mockImplementationOnce(async () => ({
      Items: [{ ...activeReservation }],
    }))
    mockSend.mockImplementationOnce(async () => ({
      Items: [{ ...activeReservation }],
    }))
    mockSend.mockImplementationOnce(async () => ({}))

    await cancelOrderReservations('order-123')

    expect(mockUpdateProductStock).toHaveBeenCalledWith('prod-1', 2)
  })

  test('does nothing when there are no active reservations', async () => {
    mockSend.mockImplementationOnce(async () => ({
      Items: [{ ...activeReservation, status: 'cancelled' }],
    }))

    await cancelOrderReservations('order-123')

    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockUpdateProductStock).not.toHaveBeenCalled()
  })
})
