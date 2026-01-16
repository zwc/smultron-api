import { describe, test, expect } from 'bun:test'

const BASE_URL = 'https://dev.smultron.zwc.se'
const API_BASE = `${BASE_URL}/v1`

const isDebugEnabled = (): boolean =>
  (process.env.DEBUG ?? '').toLowerCase() === 'true'

const redactHeaders = (
  headers: Record<string, string | undefined>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers)
      .filter(([, v]) => typeof v === 'string')
      .map(([k, v]) => [
        k,
        k.toLowerCase() === 'authorization' ? 'Bearer <redacted>' : (v ?? ''),
      ]),
  )

const redactBody = (body: unknown): unknown => {
  if (body === null || body === undefined) return body
  if (typeof body !== 'object') return body
  if (Array.isArray(body)) return body.map(redactBody)

  const record = body as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(record).map(([k, v]) => [
      k,
      k.toLowerCase() === 'password'
        ? '<redacted>'
        : k.toLowerCase() === 'token'
          ? '<redacted>'
          : redactBody(v),
    ]),
  )
}

const tryParseJson = (text: string): unknown | null => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const debugLog = (label: string, value: unknown): void => {
  if (!isDebugEnabled()) return
  console.log(`\n[DEBUG] ${label}`)
  console.log(
    typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  )
}

const fetchWithDebug = async (
  url: string,
  init: RequestInit,
  label: string,
): Promise<{
  ok: boolean
  status: number
  text: string
  json: unknown | null
}> => {
  const requestHeaders = (init.headers ?? {}) as Record<
    string,
    string | undefined
  >
  const requestBody =
    typeof init.body === 'string'
      ? (tryParseJson(init.body) ?? init.body)
      : init.body

  debugLog(`${label} request`, {
    url,
    method: init.method ?? 'GET',
    headers: redactHeaders(requestHeaders),
    body: redactBody(requestBody),
  })

  const response = await fetch(url, init)
  const text = await response.text()
  const json = tryParseJson(text)

  debugLog(`${label} response`, {
    status: response.status,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
    body: redactBody(json ?? text),
  })

  return {
    ok: response.ok,
    status: response.status,
    text,
    json,
  }
}

const getAuthToken = async (): Promise<string> => {
  const authResponse = await fetchWithDebug(
    `${API_BASE}/admin/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'linn',
        password: 'e5uu588hzfwge367',
      }),
    },
    'admin/login',
  )

  if (!authResponse.ok) {
    throw new Error(
      `Failed to authenticate: ${authResponse.status} ${authResponse.text}`,
    )
  }

  const token = (authResponse.json as any)?.data?.token
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(
      `Authentication succeeded but token missing: ${authResponse.text}`,
    )
  }

  return token
}

describe('Admin Products Integration Tests', () => {
  test('creates a product and lists it in admin/products', async () => {
    const authToken = await getAuthToken()
    const timestamp = Date.now()
    const productData = {
      title: `Integration Test Product ${timestamp}`,
      subtitle: 'Test Subtitle',
      brand: 'Test Brand',
      price: 99.99,
      status: 'active',
      category: 'test-category',
      stock: 10,
      description: ['Test product created by integration test'],
      images: [],
    }

    // Create the product
    const createResponse = await fetchWithDebug(
      `${API_BASE}/admin/products`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(productData),
      },
      'admin/products (create)',
    )

    if (!createResponse.ok) {
      throw new Error(
        `Failed to create product: ${createResponse.status} ${createResponse.text}`,
      )
    }

    expect(createResponse.status).toBe(201)

    const createResult = createResponse.json as any
    expect(createResult?.data).toBeDefined()
    expect(createResult?.data?.id).toBeDefined()
    expect(createResult?.data?.title).toBe(productData.title)
    expect(createResult?.data?.price).toBe(productData.price)
    expect(createResult?.data?.status).toBe(productData.status)

    const createdProductId = createResult.data.id

    // List products and verify it's there
    const listResponse = await fetchWithDebug(
      `${API_BASE}/admin/products?limit=100&sort=-createdAt`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
      'admin/products (list)',
    )

    expect(listResponse.ok).toBe(true)
    expect(listResponse.status).toBe(200)

    const listResult = listResponse.json as any
    expect(listResult?.data).toBeDefined()
    expect(Array.isArray(listResult?.data)).toBe(true)

    const createdProduct = (listResult.data as any[]).find(
      (p: any) => p.id === createdProductId,
    )
    expect(createdProduct).toBeDefined()
    expect(createdProduct.title).toBe(productData.title)
    expect(createdProduct.price).toBe(productData.price)

    // Verify pagination metadata
    expect(listResult?.meta).toBeDefined()
    expect(listResult?.meta?.total).toBeGreaterThanOrEqual(1)
    expect(listResult?.meta?.limit).toBe(100)
    expect(listResult?.meta?.offset).toBe(0)
    expect(listResult?.meta?.sort).toBe('-createdAt')

    // Verify links
    expect(listResult?.links).toBeDefined()
    expect(listResult?.links?.self).toBeDefined()

    // Clean up: delete the created product
    const deleteResponse = await fetchWithDebug(
      `${API_BASE}/admin/products/${createdProductId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
      'admin/products (delete)',
    )

    expect(deleteResponse.ok).toBe(true)
    expect(deleteResponse.status).toBe(200)
  })
})
