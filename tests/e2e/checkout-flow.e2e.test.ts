/**
 * End-to-End: Complete Checkout Flow
 *
 * Standalone test suite — NOT part of `bun test src/` or `bun test tests/integration/`.
 * Run with:
 *   bun test tests/e2e/
 *   API_URL=https://smultron.zwc.se/v1 bun test tests/e2e/
 *
 * Covers:
 *   - Catalog listing (categories + products)
 *   - Product lookup
 *   - Invalid basket operations (non-existent product, inactive product,
 *     out-of-stock product, bad payment method, missing required fields)
 *   - Full happy-path order flow using card payment + fake-success confirm endpoint
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

const API_URL = process.env.API_URL ?? 'https://dev.smultron.zwc.se/v1'
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'loJX0t34^sAx'

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

type JsonBody = Record<string, unknown>

const parseBody = async (res: Response): Promise<JsonBody> => {
  const text = await res.text()
  try {
    return JSON.parse(text) as JsonBody
  } catch {
    return { _raw: text } as unknown as JsonBody
  }
}

const get = async (
  path: string,
  token?: string,
): Promise<{ res: Response; body: JsonBody }> => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return { res, body: await parseBody(res) }
}

const post = async (
  path: string,
  payload: unknown,
  token?: string,
): Promise<{ res: Response; body: JsonBody }> => {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  })
  return { res, body: await parseBody(res) }
}

const del = async (
  path: string,
  token: string,
): Promise<{ res: Response; body: JsonBody }> => {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return { res, body: await parseBody(res) }
}

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

const adminLogin = async (): Promise<string> => {
  const { res, body } = await post('/admin/login', {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
  })
  if (!res.ok) throw new Error(`Admin login failed: ${res.status}`)
  const token = (body as any)?.data?.token
  if (typeof token !== 'string') throw new Error('No token in login response')
  return token
}

const createProduct = async (
  token: string,
  overrides: Partial<{
    stock: number
    status: 'active' | 'inactive'
    title: string
  }> = {},
): Promise<string> => {
  const { res, body } = await post(
    '/admin/products',
    {
      title: overrides.title ?? `E2E Test Product ${Date.now()}`,
      subtitle: 'E2E test subtitle',
      brand: 'E2E Brand',
      price: 99,
      stock: overrides.stock ?? 10,
      status: overrides.status ?? 'active',
      category: 'test',
    },
    token,
  )
  if (res.status !== 201)
    throw new Error(
      `Product creation failed: ${res.status} ${JSON.stringify(body)}`,
    )
  const id = (body as any)?.data?.id
  if (typeof id !== 'string') throw new Error('No product id returned')
  return id
}

const deleteProduct = async (token: string, id: string): Promise<void> => {
  await del(`/admin/products/${id}`, token)
}

// ---------------------------------------------------------------------------
// Shared state (populated in beforeAll)
// ---------------------------------------------------------------------------

let adminToken = ''
let validProductId = '' // active product with stock > 0
let outOfStockProductId = '' // active product with stock = 0
let inactiveProductId = '' // inactive product
const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000'

let checkoutOrderId = '' // set during the happy-path checkout test
let confirmedOrderNumber = '' // set after payment confirmation

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('E2E: Complete Checkout Flow', () => {
  // -------------------------------------------------------------------------
  // Setup & teardown
  // -------------------------------------------------------------------------

  beforeAll(async () => {
    adminToken = await adminLogin()

    // Create three test products covering the edge cases
    ;[validProductId, outOfStockProductId, inactiveProductId] =
      await Promise.all([
        createProduct(adminToken, {
          stock: 20,
          status: 'active',
          title: 'E2E Valid Product',
        }),
        createProduct(adminToken, {
          stock: 0,
          status: 'active',
          title: 'E2E Out-of-Stock Product',
        }),
        createProduct(adminToken, {
          stock: 10,
          status: 'inactive',
          title: 'E2E Inactive Product',
        }),
      ])
  })

  afterAll(async () => {
    await Promise.all([
      deleteProduct(adminToken, validProductId),
      deleteProduct(adminToken, outOfStockProductId),
      deleteProduct(adminToken, inactiveProductId),
    ])
  })

  // -------------------------------------------------------------------------
  // 1. Catalog
  // -------------------------------------------------------------------------

  describe('Catalog', () => {
    test('lists catalog with categories and products', async () => {
      const { res, body } = await get('/catalog')
      expect(res.ok).toBe(true)
      expect(res.status).toBe(200)
      const data = (body as any).data
      expect(Array.isArray(data.categories)).toBe(true)
      expect(Array.isArray(data.products)).toBe(true)
      const meta = (body as any).meta
      expect(typeof meta.categoriesTotal).toBe('number')
      expect(typeof meta.productsTotal).toBe('number')
      expect(meta.categoriesTotal).toBe(data.categories.length)
      expect(meta.productsTotal).toBe(data.products.length)
    })

    test('catalog categories have required fields', async () => {
      const { body } = await get('/catalog')
      const categories = (body as any).data.categories as any[]
      if (categories.length === 0) return // nothing to assert

      const cat = categories[0]
      expect(typeof cat.slug).toBe('string')
      expect(typeof cat.title).toBe('string')
    })

    test('catalog products have required fields', async () => {
      const { body } = await get('/catalog')
      const products = (body as any).data.products as any[]
      if (products.length === 0) return // nothing to assert

      const product = products[0]
      expect(typeof product.id).toBe('string')
      expect(typeof product.title).toBe('string')
      expect(typeof product.price).toBe('number')
    })
  })

  // -------------------------------------------------------------------------
  // 2. Product lookup via catalog
  //
  // Note: there is no standalone public GET /products/{id} route — product
  // discovery is done through GET /catalog.  The admin endpoint
  // GET /admin/products/{id} is used for authenticated product inspection.
  // -------------------------------------------------------------------------

  describe('Product lookup', () => {
    test('finds the test product in the catalog by ID', async () => {
      const { body } = await get('/catalog')
      const products = (body as any).data.products as any[]
      const found = products.find((p: any) => p.id === validProductId)
      expect(found).toBeDefined()
      expect(found.id).toBe(validProductId)
      expect(typeof found.title).toBe('string')
      expect(typeof found.price).toBe('number')
    })

    test('admin endpoint returns a product by ID', async () => {
      const { res, body } = await get(
        `/admin/products/${validProductId}`,
        adminToken,
      )
      expect(res.ok).toBe(true)
      const data = (body as any).data
      expect(data.id).toBe(validProductId)
      expect(typeof data.title).toBe('string')
      expect(typeof data.price).toBe('number')
    })

    test('admin endpoint returns not-found for non-existent product', async () => {
      const { body } = await get(
        `/admin/products/${NONEXISTENT_ID}`,
        adminToken,
      )
      // API always responds HTTP 200; error signalled via body.error
      expect((body as any).error).toBeDefined()
      expect((body as any).data).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // 3. Invalid basket / checkout operations
  // -------------------------------------------------------------------------

  describe('Invalid checkout operations', () => {
    const validOrder = {
      payment: 'card' as const,
      name: 'E2E Test Customer',
      email: 'e2e-test@example.com',
      phone: '0701234567',
    }

    test('rejects checkout when body is missing', async () => {
      const res = await fetch(`${API_URL}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const body = await parseBody(res)
      expect((body as any).error).toBeDefined()
    })

    test('rejects checkout with invalid payment method', async () => {
      const { body } = await post('/checkout', {
        order: { ...validOrder, payment: 'bitcoin' },
        cart: [{ id: validProductId, number: 1 }],
      })
      expect((body as any).error).toBeDefined()
      expect((body as any).error.message).toContain('Validation error')
    })

    test('rejects checkout with missing email', async () => {
      const { email: _email, ...orderWithoutEmail } = validOrder
      const { body } = await post('/checkout', {
        order: orderWithoutEmail,
        cart: [{ id: validProductId, number: 1 }],
      })
      expect((body as any).error).toBeDefined()
      expect((body as any).error.message).toContain('Validation error')
    })

    test('rejects checkout with missing phone', async () => {
      const { phone: _phone, ...orderWithoutPhone } = validOrder
      const { body } = await post('/checkout', {
        order: orderWithoutPhone,
        cart: [{ id: validProductId, number: 1 }],
      })
      expect((body as any).error).toBeDefined()
      expect((body as any).error.message).toContain('Validation error')
    })

    test('rejects checkout with missing name', async () => {
      const { name: _name, ...orderWithoutName } = validOrder
      const { body } = await post('/checkout', {
        order: orderWithoutName,
        cart: [{ id: validProductId, number: 1 }],
      })
      expect((body as any).error).toBeDefined()
      expect((body as any).error.message).toContain('Validation error')
    })

    test('returns PRODUCT_NOT_FOUND for non-existent product in cart', async () => {
      const { body } = await post('/checkout', {
        order: validOrder,
        cart: [{ id: NONEXISTENT_ID, number: 1 }],
      })
      expect((body as any).error).toBeDefined()
      expect((body as any).error.message).toContain('not found')
      expect((body as any).meta?.errorCode).toBe('PRODUCT_NOT_FOUND')
    })

    test('returns PRODUCT_UNAVAILABLE for inactive product in cart', async () => {
      const { body } = await post('/checkout', {
        order: validOrder,
        cart: [{ id: inactiveProductId, number: 1 }],
      })
      expect((body as any).error).toBeDefined()
      expect((body as any).error.message).toContain('not available')
      expect((body as any).meta?.errorCode).toBe('PRODUCT_UNAVAILABLE')
    })

    test('returns INSUFFICIENT_STOCK for out-of-stock product in cart', async () => {
      const { body } = await post('/checkout', {
        order: validOrder,
        cart: [{ id: outOfStockProductId, number: 1 }],
      })
      expect((body as any).error).toBeDefined()
      expect((body as any).meta?.errorCode).toBe('INSUFFICIENT_STOCK')
    })
  })

  // -------------------------------------------------------------------------
  // 4. Happy-path order flow
  // -------------------------------------------------------------------------

  describe('Happy-path order flow', () => {
    test('creates an order with card payment', async () => {
      const { res, body } = await post('/checkout', {
        order: {
          payment: 'card',
          name: 'E2E Happy Customer',
          email: 'e2e-happy@example.com',
          phone: '0709999999',
        },
        cart: [{ id: validProductId, number: 1 }],
      })

      expect(res.status).toBe(201)
      const data = (body as any).data
      expect(typeof data.order.id).toBe('string')
      expect(data.order.status).toBe('inactive')
      // Order number is null until payment is confirmed
      expect(data.order.number).toBeNull()
      expect(data.payment.method).toBe('card')
      expect(data.payment.status).toBe('pending')

      checkoutOrderId = data.order.id
    })

    test('order status is pending before payment confirmation', async () => {
      expect(checkoutOrderId).not.toBe('')

      const { res, body } = await get(`/order/status/${checkoutOrderId}`)
      expect(res.ok).toBe(true)
      const data = (body as any).data
      expect(data.orderId).toBe(checkoutOrderId)
      expect(data.status).toBe('pending')
      expect(data.orderNumber).toBeNull()
    })

    test('confirms payment via fake-success endpoint', async () => {
      expect(checkoutOrderId).not.toBe('')

      // The confirm endpoint runs: reserve → assign order number → set active →
      // send email.  In environments where SES is not configured the email step
      // throws, which is caught by the handler and turns the response into an
      // error envelope (data: null).  The DB mutations that already ran are
      // committed, so we verify the outcome through the order-status endpoint
      // rather than relying on the confirm response body.
      await post(`/test/confirm-payment/${checkoutOrderId}`, {})

      // Give the Lambda a moment to commit any async work before we poll.
      await new Promise((resolve) => setTimeout(resolve, 500))

      const { res, body } = await get(`/order/status/${checkoutOrderId}`)
      expect(res.ok).toBe(true)
      const data = (body as any).data
      expect(data.status).toBe('paid')
      expect(typeof data.orderNumber).toBe('string')
      expect(data.orderNumber.length).toBeGreaterThan(0)

      confirmedOrderNumber = data.orderNumber
    })

    test('order status is paid after confirmation', async () => {
      expect(checkoutOrderId).not.toBe('')

      const { res, body } = await get(`/order/status/${checkoutOrderId}`)
      expect(res.ok).toBe(true)
      const data = (body as any).data
      expect(data.orderId).toBe(checkoutOrderId)
      expect(data.status).toBe('paid')
    })

    test('confirmed order has an order number assigned', async () => {
      expect(checkoutOrderId).not.toBe('')
      expect(confirmedOrderNumber).not.toBe('')

      const { res, body } = await get(`/order/status/${checkoutOrderId}`)
      expect(res.ok).toBe(true)
      expect((body as any).data.orderNumber).toBe(confirmedOrderNumber)
    })

    test('fake-success confirm is idempotent on already-confirmed order', async () => {
      expect(checkoutOrderId).not.toBe('')
      expect(confirmedOrderNumber).not.toBe('')

      const { res, body } = await post(
        `/test/confirm-payment/${checkoutOrderId}`,
        {},
      )
      expect(res.ok).toBe(true)
      // The early-exit "already confirmed" path does NOT hit the email step,
      // so data is always present here.
      const data = (body as any).data
      expect(data.orderNumber).toBe(confirmedOrderNumber)
      expect((data.message as string).toLowerCase()).toContain(
        'already confirmed',
      )
    })

    test('confirm-payment returns not-found for unknown order', async () => {
      const { body } = await post(`/test/confirm-payment/${NONEXISTENT_ID}`, {})
      expect((body as any).error).toBeDefined()
      expect((body as any).error.message).toContain('not found')
    })
  })
})
