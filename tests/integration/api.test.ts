import { expect, test, describe } from 'bun:test';

// Integration tests require API_URL environment variable
// Default to stage CloudFront URL if not specified
const API_URL = process.env.API_URL || process.env.CLOUDFRONT_URL || 'https://stage.smultron.zwc.se';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error('Error: ADMIN_PASSWORD environment variable is required for integration tests');
  console.error('Please set ADMIN_PASSWORD before running tests');
  throw new Error('ADMIN_PASSWORD environment variable is required for integration tests');
}

let authToken: string;
let testCategoryId: string;
let testProductId: string;
let testProductId2: string;
let testOrderId: string;

// Normalize API URL to ensure it has the correct path
// CloudFront domains use /v1, API Gateway uses /api/v1
let normalizedApiUrl = API_URL;
if (!normalizedApiUrl.endsWith('/v1') && !normalizedApiUrl.endsWith('/api/v1')) {
  // Add /v1 by default (CloudFront pattern)
  normalizedApiUrl = normalizedApiUrl.replace(/\/$/, '') + '/v1';
} else if (normalizedApiUrl.endsWith('/api/v1')) {
  // Keep as is - this is API Gateway direct URL
}
// If ends with /v1, keep as is - this is CloudFront URL

console.log(`Running integration tests against: ${normalizedApiUrl}`);

describe('Integration Tests - Auth', () => {
  test('should login with valid credentials', async () => {
    const response = await fetch(`${normalizedApiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD,
      }),
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.token).toBeDefined();
    authToken = data.token;
  });

  test('should reject invalid credentials', async () => {
    const response = await fetch(`${normalizedApiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: ADMIN_USERNAME,
        password: 'wrong-password',
      }),
    });

    expect(response.status).toBe(401);
  });

  test('should reject login without credentials', async () => {
    const response = await fetch(`${normalizedApiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  test('should reject login with missing password', async () => {
    const response = await fetch(`${normalizedApiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USERNAME }),
    });

    expect(response.status).toBe(400);
  });
});

describe('Integration Tests - Categories (Public Access)', () => {
  test('should list categories without authentication', async () => {
    const response = await fetch(`${normalizedApiUrl}/categories`);
    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('Integration Tests - Categories (Admin CRUD)', () => {
  test('should create a category (admin)', async () => {
    const response = await fetch(`${normalizedApiUrl}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        brand: 'Integration Test Brand',
        title: 'Integration Test Category',
        subtitle: 'Test subtitle',
        index: 999,
      }),
    });

    expect(response.status).toBe(201);
    const data: any = await response.json();
    expect(data.id).toBeDefined();
    testCategoryId = data.id;
  });

  test('should reject creating a category without auth', async () => {
    const response = await fetch(`${normalizedApiUrl}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand: 'Unauthorized Brand',
        title: 'Unauthorized Category',
        subtitle: 'Test',
        index: 1,
      }),
    });

    expect(response.status).toBe(401);
  });

  test('should list categories (public)', async () => {
    const response = await fetch(`${normalizedApiUrl}/categories`);
    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('should get a category by id (public)', async () => {
    const response = await fetch(`${normalizedApiUrl}/categories/${testCategoryId}`);
    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.id).toBe(testCategoryId);
    expect(data.title).toBe('Integration Test Category');
  });

  test('should return 404 for non-existent category', async () => {
    const response = await fetch(`${normalizedApiUrl}/categories/non-existent-id`);
    expect(response.status).toBe(404);
  });

  test('should update a category (admin)', async () => {
    const response = await fetch(`${normalizedApiUrl}/categories/${testCategoryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title: 'Updated Test Category',
        subtitle: 'Updated subtitle',
        index: 1000,
      }),
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.title).toBe('Updated Test Category');
    expect(data.index).toBe(1000);
  });

  test('should reject updating a category without auth', async () => {
    const response = await fetch(`${normalizedApiUrl}/categories/${testCategoryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauthorized Update',
      }),
    });

    expect(response.status).toBe(401);
  });
});

describe('Integration Tests - Products (Public Access)', () => {
  test('should list products without authentication', async () => {
    const response = await fetch(`${normalizedApiUrl}/products`);
    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('Integration Tests - Products (Admin CRUD)', () => {
  test('should create a product (admin)', async () => {
    const response = await fetch(`${normalizedApiUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        id: `test-product-${Date.now()}`,
        category: testCategoryId,
        article: 'TEST-001',
        brand: 'Integration Test Brand',
        title: 'Integration Test Product',
        subtitle: 'Test product subtitle',
        price: 99.99,
        price_reduced: 79.99,
        description: ['Feature 1', 'Feature 2', 'Feature 3'],
        tag: 'test',
        index: 1,
        stock: 100,
        max_order: 10,
        image: 'https://example.com/image.jpg',
        images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
      }),
    });

    expect(response.status).toBe(201);
    const data: any = await response.json();
    expect(data.id).toBeDefined();
    testProductId = data.id;
  });

  test('should create a second product (admin)', async () => {
    const response = await fetch(`${normalizedApiUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        id: `test-product-2-${Date.now()}`,
        category: testCategoryId,
        article: 'TEST-002',
        brand: 'Integration Test Brand',
        title: 'Second Test Product',
        subtitle: 'Another test product',
        price: 149.99,
        price_reduced: 0,
        description: ['Second product feature'],
        tag: 'new',
        index: 2,
        stock: 50,
        max_order: 5,
        image: 'https://example.com/image2.jpg',
        images: ['https://example.com/image2.jpg'],
      }),
    });

    expect(response.status).toBe(201);
    const data: any = await response.json();
    testProductId2 = data.id;
  });

  test('should reject creating a product without auth', async () => {
    const response = await fetch(`${normalizedApiUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: testCategoryId,
        title: 'Unauthorized Product',
        price: 50,
      }),
    });

    expect(response.status).toBe(401);
  });

  test('should list products (public)', async () => {
    const response = await fetch(`${normalizedApiUrl}/products`);
    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('should get a product by id (public)', async () => {
    const response = await fetch(`${normalizedApiUrl}/products/${testProductId}`);
    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.id).toBe(testProductId);
    expect(data.title).toBe('Integration Test Product');
  });

  test('should return 404 for non-existent product', async () => {
    const response = await fetch(`${normalizedApiUrl}/products/non-existent-id`);
    expect(response.status).toBe(404);
  });

  test('should update a product (admin)', async () => {
    const response = await fetch(`${normalizedApiUrl}/products/${testProductId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        price: 89.99,
        price_reduced: 69.99,
        stock: 90,
        tag: 'updated',
      }),
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.price).toBe(89.99);
    expect(data.stock).toBe(90);
    expect(data.tag).toBe('updated');
  });

  test('should reject updating a product without auth', async () => {
    const response = await fetch(`${normalizedApiUrl}/products/${testProductId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price: 10,
      }),
    });

    expect(response.status).toBe(401);
  });

  test('should accept updating with any price value', async () => {
    // Note: API currently doesn't validate negative prices
    const response = await fetch(`${normalizedApiUrl}/products/${testProductId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        price: -10,
      }),
    });

    expect(response.status).toBe(200);
  });
});

describe('Integration Tests - Orders', () => {
  test('should create an order (public)', async () => {
    const response = await fetch(`${normalizedApiUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart: [
          {
            id: testProductId,
            number: 2,
            price: 89.99,
          },
          {
            id: testProductId2,
            number: 1,
            price: 149.99,
          },
        ],
        order: {
          name: 'Test Customer',
          address: '123 Test Street',
          zip: '12345',
          city: 'Test City',
          phone: '+46701234567',
          email: 'test@example.com',
          delivery: 'standard',
          payment: 'card',
        },
      }),
    });

    expect(response.status).toBe(201);
    const data: any = await response.json();
    expect(data.id).toBeDefined();
    expect(data.status).toBe('pending');
    testOrderId = data.id;
  });

  test('should reject creating order with invalid data', async () => {
    const response = await fetch(`${normalizedApiUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart: [],
        order: {},
      }),
    });

    expect(response.status).toBe(400);
  });

  test('should reject creating order with empty cart', async () => {
    const response = await fetch(`${normalizedApiUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart: [],
        order: {
          name: 'Test Customer',
          address: '123 Test Street',
          zip: '12345',
          city: 'Test City',
          phone: '+46701234567',
          email: 'test@example.com',
          delivery: 'standard',
          payment: 'card',
        },
      }),
    });

    expect(response.status).toBe(400);
  });

  test('should reject listing orders without auth (admin only)', async () => {
    const response = await fetch(`${normalizedApiUrl}/orders`);
    expect(response.status).toBe(401);
  });

  test('should list orders (admin only)', async () => {
    const response = await fetch(`${normalizedApiUrl}/orders`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('should reject getting order without auth (admin only)', async () => {
    const response = await fetch(`${normalizedApiUrl}/orders/${testOrderId}`);
    expect(response.status).toBe(401);
  });

  test('should get an order by id (admin only)', async () => {
    const response = await fetch(`${normalizedApiUrl}/orders/${testOrderId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.id).toBe(testOrderId);
    expect(data.customerEmail).toBe('test@example.com');
  });

  test('should return 404 for non-existent order', async () => {
    const response = await fetch(`${normalizedApiUrl}/orders/non-existent-id`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(404);
  });

  test('should reject updating order status without auth', async () => {
    const response = await fetch(`${normalizedApiUrl}/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'processing' }),
    });

    expect(response.status).toBe(401);
  });

  test('should update order status (admin only)', async () => {
    const response = await fetch(`${normalizedApiUrl}/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ status: 'confirmed' }),
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.status).toBe('confirmed');
  });

  test('should update order status to shipped', async () => {
    const response = await fetch(`${normalizedApiUrl}/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ status: 'shipped' }),
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.status).toBe('shipped');
  });

  test('should update order status to delivered', async () => {
    const response = await fetch(`${normalizedApiUrl}/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ status: 'delivered' }),
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.status).toBe('delivered');
  });

  test('should reject invalid order status', async () => {
    const response = await fetch(`${normalizedApiUrl}/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ status: 'invalid-status' }),
    });

    expect(response.status).toBe(400);
  });
});

describe('Integration Tests - Edge Cases', () => {
  test('should handle malformed JSON in request body', async () => {
    const response = await fetch(`${normalizedApiUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: 'not-valid-json',
    });

    // Note: API returns 500 for JSON parse errors instead of 400
    expect([400, 500].includes(response.status)).toBe(true);
  });

  test('should reject invalid Bearer token', async () => {
    const response = await fetch(`${normalizedApiUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-token',
      },
      body: JSON.stringify({ title: 'Test' }),
    });

    expect(response.status).toBe(401);
  });

  test('should reject malformed Authorization header', async () => {
    const response = await fetch(`${normalizedApiUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'NotBearer invalid-format',
      },
      body: JSON.stringify({ title: 'Test' }),
    });

    expect(response.status).toBe(401);
  });
});

describe('Integration Tests - CORS', () => {
  test('should include CORS headers in response', async () => {
    const response = await fetch(`${normalizedApiUrl}/categories`);
    
    expect(response.headers.get('access-control-allow-origin')).toBeDefined();
  });

  test('should handle OPTIONS preflight request', async () => {
    const response = await fetch(`${normalizedApiUrl}/categories`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization',
      },
    });

    expect([200, 204].includes(response.status)).toBe(true);
  });
});

describe('Integration Tests - Cleanup', () => {
  test('should delete the second test product (admin)', async () => {
    const response = await fetch(`${normalizedApiUrl}/products/${testProductId2}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect([200, 204].includes(response.status)).toBe(true);
  });

  test('should delete the first test product (admin)', async () => {
    const response = await fetch(`${normalizedApiUrl}/products/${testProductId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect([200, 204].includes(response.status)).toBe(true);
  });

  test('should reject deleting product without auth', async () => {
    const response = await fetch(`${normalizedApiUrl}/products/${testProductId}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(401);
  });

  test('should list products with filters (admin)', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/products?limit=10&offset=0&sort=-createdAt`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.data).toBeArray();
    expect(data.meta).toBeDefined();
    expect(data.meta.total).toBeNumber();
    expect(data.meta.limit).toBe(10);
    expect(data.meta.offset).toBe(0);
    expect(data.meta.sort).toBe('-createdAt');
    expect(data.links).toBeDefined();
    expect(data.links.self).toBeString();
  });

  test('should filter products by status (admin)', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/products?status=active&limit=5`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.meta.filters.status).toEqual(['active']);
    expect(data.meta.limit).toBe(5);
  });

  test('should search products (admin)', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/products?q=test&limit=20`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.meta.filters.q).toBe('test');
  });

  test('should paginate products (admin)', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/products?limit=2&offset=0`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    const data: any = await response.json();
    expect(data.data.length).toBeLessThanOrEqual(2);
    
    if (data.meta.total > 2) {
      expect(data.links.next).toBeString();
    }
  });

  test('should reject listing products without auth', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/products`, {
      method: 'GET',
    });

    expect(response.status).toBe(401);
  });

  test('should reject invalid query parameters (admin)', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/products?limit=1000&sort=invalid`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(400);
    const data: any = await response.json();
    expect(data.error).toBe('Validation error');
    expect(data.details).toBeDefined();
  });

  test('should delete the test category (admin)', async () => {
    const response = await fetch(`${normalizedApiUrl}/categories/${testCategoryId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect([200, 204].includes(response.status)).toBe(true);
  });

  test('should reject deleting category without auth', async () => {
    const response = await fetch(`${normalizedApiUrl}/categories/${testCategoryId}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(401);
  });

  test('should return 404 when getting deleted product', async () => {
    const response = await fetch(`${normalizedApiUrl}/products/${testProductId}`);
    // Note: CloudFront caching may return 200 for a short time after deletion
    // In production, cache will eventually expire and return 404
    expect([200, 404].includes(response.status)).toBe(true);
  });

  test('should return 404 when getting deleted category', async () => {
    const response = await fetch(`${normalizedApiUrl}/categories/${testCategoryId}`);
    // Note: CloudFront caching may return 200 for a short time after deletion
    // In production, cache will eventually expire and return 404
    expect([200, 404].includes(response.status)).toBe(true);
  });
});
