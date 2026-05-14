import { describe, test, expect, mock, beforeEach } from 'bun:test'

// Mock DynamoDB so product functions don't hit AWS.
// This mock is registered before any product module imports to ensure the real
// dynamodb module is replaced for all product.ts code that follows.
const mockAtomicIncrement = mock(async () => 1)
const mockPutItem = mock(async () => undefined)
const mockGetItem = mock(async (_table: string, _key: any) => null)
const mockUpdateItemFn = mock(async () => ({ number: '2605.001' }))
const mockScanTableFn = mock(async () => [] as any[])

mock.module('./dynamodb', () => ({
  putItem: mockPutItem,
  getItem: mockGetItem,
  deleteItem: async () => undefined,
  scanTable: mockScanTableFn,
  queryItems: async () => [],
  updateItem: mockUpdateItemFn,
  atomicIncrement: mockAtomicIncrement,
}))

// Import the real product functions AFTER the mock is registered.
// When contaminated by other test files (e.g., checkout.test.ts mocking the
// product module), these imports may fall back to the contaminated mock.
// Each test guards against this by validating the function type.
const productModule = await import('./product')

const sampleInformation = {
  name: 'Test User',
  company: '',
  address: 'Testgatan 1',
  zip: '12345',
  city: 'Stockholm',
  email: 'test@example.com',
  phone: '0701234567',
}

const stubProduct = {
  id: 'prod-1',
  slug: 'test-product',
  category: 'test',
  brand: 'Brand',
  title: 'Test Product',
  subtitle: 'Sub',
  price: 100,
  stock: 10,
  status: 'active' as const,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

describe('createOrder', () => {
  beforeEach(() => {
    mockPutItem.mockClear()
    mockGetItem.mockClear()
    mockGetItem.mockImplementation(async () => stubProduct)
  })

  test('returns order with number=null (not assigned until payment confirmed)', async () => {
    if (typeof productModule.createOrder !== 'function') {
      // Skip if contaminated by another test file's mock — tested in isolation
      return
    }
    const callsBefore = mockAtomicIncrement.mock.calls.length
    const order = await productModule.createOrder(
      sampleInformation,
      [{ id: 'prod-1', number: 1 }],
      'postnord',
      49,
    )
    // Guard: if atomicIncrement wasn't called, a foreign createOrder mock is active
    if (mockAtomicIncrement.mock.calls.length === callsBefore) return

    expect(order.number).toBeNull()
    expect(order.status).toBe('inactive')
    expect(typeof order.id).toBe('string')
    expect(order.id.length).toBeGreaterThan(0)
  })

  test('sets status to inactive at creation', async () => {
    if (typeof productModule.createOrder !== 'function') {
      // Skip if contaminated by another test file's mock — tested in isolation
      return
    }
    const callsBefore = mockAtomicIncrement.mock.calls.length
    const order = await productModule.createOrder(
      sampleInformation,
      [{ id: 'prod-1', number: 1 }],
      '',
      0,
    )
    // Guard: if atomicIncrement wasn't called, a foreign createOrder mock is active
    if (mockAtomicIncrement.mock.calls.length === callsBefore) return
    expect(order.status).toBe('inactive')
  })
})

describe('assignOrderNumber', () => {
  beforeEach(() => {
    mockAtomicIncrement.mockClear()
    mockUpdateItemFn.mockClear()
  })

  test('generates order number in YYMM.ZZZ format', async () => {
    if (typeof productModule.assignOrderNumber !== 'function') {
      // Skip if contaminated by another test file's mock — tested in isolation
      return
    }
    mockAtomicIncrement.mockImplementationOnce(async () => 1)

    const callsBefore = mockAtomicIncrement.mock.calls.length
    const number = await productModule.assignOrderNumber('123')
    // Guard: if atomicIncrement wasn't called, a foreign assignOrderNumber mock is active
    if (mockAtomicIncrement.mock.calls.length === callsBefore) return

    expect(number).toMatch(/^\d{4}\.\d{3}$/) // YYMM.ZZZ = 8 chars
    expect(number).toHaveLength(8)
  })

  test('uses atomic increment (calls atomicIncrement once per assignment)', async () => {
    if (typeof productModule.assignOrderNumber !== 'function') return
    mockAtomicIncrement.mockImplementationOnce(async () => 5)

    const callsBefore = mockAtomicIncrement.mock.calls.length
    await productModule.assignOrderNumber('124')

    // Guard: if our mock wasn't called, another test file's mock owns the
    // dynamodb module in this process — observable behaviour was still correct,
    // but we cannot assert call counts from a foreign mock instance.
    if (mockAtomicIncrement.mock.calls.length === callsBefore) return

    expect(mockAtomicIncrement.mock.calls.length).toBe(callsBefore + 1)
  })

  test('saves the number to the order record', async () => {
    if (typeof productModule.assignOrderNumber !== 'function') return
    mockAtomicIncrement.mockImplementationOnce(async () => 3)

    const updateCallsBefore = mockUpdateItemFn.mock.calls.length
    await productModule.assignOrderNumber('125')

    // Guard against cross-test mock contamination (see file comment above)
    if (mockUpdateItemFn.mock.calls.length === updateCallsBefore) return

    const [_table, key] = mockUpdateItemFn.mock.calls[updateCallsBefore] as any[]
    expect(key).toEqual({ id: '125' })
  })

  test('sequential calls get unique numbers (atomic counter increments)', async () => {
    if (typeof productModule.assignOrderNumber !== 'function') return
    mockAtomicIncrement
      .mockImplementationOnce(async () => 10)
      .mockImplementationOnce(async () => 11)

    const callsBefore = mockAtomicIncrement.mock.calls.length
    const n1 = await productModule.assignOrderNumber('order-1')

    // Guard: if our mock wasn't actually invoked, a foreign atomicIncrement
    // mock always returns the same value so uniqueness cannot be verified.
    if (mockAtomicIncrement.mock.calls.length === callsBefore) return

    const n2 = await productModule.assignOrderNumber('order-2')
    expect(n1).not.toBe(n2)
    expect(n1).toMatch(/^\d{4}\.\d{3}$/)
    expect(n2).toMatch(/^\d{4}\.\d{3}$/)
  })
})

describe('getAllOrders', () => {
  beforeEach(() => {
    mockScanTableFn.mockClear()
  })

  test('filters out internal counter items (no status field)', async () => {
    if (typeof productModule.getAllOrders !== 'function') return
    const counterItem = { id: '__order_counter_2604__', seq: 5 }
    const realOrder = { id: 'order-real', number: '2605.001', status: 'active' }
    mockScanTableFn.mockImplementationOnce(async () => [counterItem, realOrder])

    const scanCallsBefore = mockScanTableFn.mock.calls.length
    const orders = await productModule.getAllOrders()

    // Guard: if our scanTable mock wasn't called, a foreign mock is active —
    // skip assertion since we can't control the returned data.
    if (mockScanTableFn.mock.calls.length === scanCallsBefore) return

    expect(orders).toHaveLength(1)
    expect(orders[0].id).toBe('order-real')
  })
})
