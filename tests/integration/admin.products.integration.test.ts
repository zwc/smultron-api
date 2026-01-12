import { describe, test, expect, beforeAll } from 'bun:test'

const BASE_URL = 'https://dev.smultron.zwc.se'
const API_BASE = `${BASE_URL}/v1`

let authToken: string

const getAuthToken = async (): Promise<string> => {
  const response = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'linn',
      password: 'e5uu588hzfwge367',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to authenticate: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  return data.data.token
}

describe('Admin Products Integration Tests', () => {
  beforeAll(async () => {
    authToken = await getAuthToken()
  })

  test('creates a product and lists it in admin/products', async () => {
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
    const createResponse = await fetch(`${API_BASE}/admin/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(productData),
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      throw new Error(
        `Failed to create product: ${createResponse.status} ${errorText}`,
      )
    }

    expect(createResponse.status).toBe(201)

    const createResult = await createResponse.json()
    expect(createResult.data).toBeDefined()
    expect(createResult.data.id).toBeDefined()
    expect(createResult.data.title).toBe(productData.title)
    expect(createResult.data.price).toBe(productData.price)
    expect(createResult.data.status).toBe(productData.status)

    const createdProductId = createResult.data.id

    // List products and verify it's there
    const listResponse = await fetch(
      `${API_BASE}/admin/products?limit=100&sort=-createdAt`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    )

    expect(listResponse.ok).toBe(true)
    expect(listResponse.status).toBe(200)

    const listResult = await listResponse.json()
    expect(listResult.data).toBeDefined()
    expect(Array.isArray(listResult.data)).toBe(true)

    const createdProduct = listResult.data.find(
      (p: any) => p.id === createdProductId,
    )
    expect(createdProduct).toBeDefined()
    expect(createdProduct.title).toBe(productData.title)
    expect(createdProduct.price).toBe(productData.price)

    // Verify pagination metadata
    expect(listResult.meta).toBeDefined()
    expect(listResult.meta.total).toBeGreaterThanOrEqual(1)
    expect(listResult.meta.limit).toBe(100)
    expect(listResult.meta.offset).toBe(0)
    expect(listResult.meta.sort).toBe('-createdAt')

    // Verify links
    expect(listResult.links).toBeDefined()
    expect(listResult.links.self).toBeDefined()

    // Clean up: delete the created product
    const deleteResponse = await fetch(
      `${API_BASE}/admin/products/${createdProductId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    )

    expect(deleteResponse.ok).toBe(true)
    expect(deleteResponse.status).toBe(200)
  })
})
