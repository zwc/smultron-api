import { expect, test, describe, beforeAll } from 'bun:test';

// Integration tests require API_URL environment variable
const API_URL = process.env.API_URL || process.env.CLOUDFRONT_URL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!API_URL) {
  throw new Error('API_URL or CLOUDFRONT_URL environment variable is required for integration tests');
}

if (!ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD environment variable is required for integration tests');
}

let authToken: string;
let testCategoryId: string;
let testProductId: string;
let testOrderId: string;

describe('Integration Tests - Auth', () => {
  test('should login with valid credentials', async () => {
    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.token).toBeDefined();
    authToken = data.data.token;
  });

  test('should reject invalid credentials', async () => {
    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: ADMIN_USERNAME,
        password: 'wrong-password',
      }),
    });

    expect(response.status).toBe(401);
  });
});

describe('Integration Tests - Categories', () => {
  test('should create a category (admin)', async () => {
    const response = await fetch(`${API_URL}/api/v1/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        brand: 'Integration Test Brand',
        title: 'Integration Test Category',
        subtitle: 'Test subtitle',
        index: 1,
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.id).toBeDefined();
    testCategoryId = data.data.id;
  });

  test('should list categories (public)', async () => {
    const response = await fetch(`${API_URL}/api/v1/categories`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });

  test('should get a category by id (public)', async () => {
    const response = await fetch(`${API_URL}/api/v1/categories/${testCategoryId}`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.id).toBe(testCategoryId);
  });

  test('should update a category (admin)', async () => {
    const response = await fetch(`${API_URL}/api/v1/categories/${testCategoryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        subtitle: 'Updated subtitle',
        index: 2,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.subtitle).toBe('Updated subtitle');
  });
});

describe('Integration Tests - Products', () => {
  test('should create a product (admin)', async () => {
    const response = await fetch(`${API_URL}/api/v1/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
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
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.id).toBeDefined();
    testProductId = data.data.id;
  });

  test('should list products (public)', async () => {
    const response = await fetch(`${API_URL}/api/v1/products`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });

  test('should get a product by id (public)', async () => {
    const response = await fetch(`${API_URL}/api/v1/products/${testProductId}`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.id).toBe(testProductId);
  });

  test('should update a product (admin)', async () => {
    const response = await fetch(`${API_URL}/api/v1/products/${testProductId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        price: 89.99,
        stock: 90,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.price).toBe(89.99);
  });
});

describe('Integration Tests - Orders', () => {
  test('should create an order (public)', async () => {
    const response = await fetch(`${API_URL}/api/v1/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerEmail: 'test@example.com',
        customerName: 'Test Customer',
        items: [
          {
            productId: testProductId,
            quantity: 2,
            price: 89.99,
          },
        ],
        totalAmount: 179.98,
        shippingAddress: '123 Test St, Test City, TC 12345',
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.id).toBeDefined();
    testOrderId = data.data.id;
  });

  test('should list orders (admin only)', async () => {
    const response = await fetch(`${API_URL}/api/v1/orders`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('should get an order by id (admin only)', async () => {
    const response = await fetch(`${API_URL}/api/v1/orders/${testOrderId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.id).toBe(testOrderId);
  });

  test('should update order status (admin only)', async () => {
    const response = await fetch(`${API_URL}/api/v1/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ status: 'processing' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('processing');
  });

  test('should reject order access without auth (admin only)', async () => {
    const response = await fetch(`${API_URL}/api/v1/orders`);
    expect(response.status).toBe(401);
  });
});

describe('Integration Tests - Cleanup', () => {
  test('should delete the test product (admin)', async () => {
    const response = await fetch(`${API_URL}/api/v1/products/${testProductId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('should delete the test category (admin)', async () => {
    const response = await fetch(`${API_URL}/api/v1/categories/${testCategoryId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
