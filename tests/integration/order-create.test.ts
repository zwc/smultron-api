import { expect, test, describe, beforeAll } from 'bun:test';

// Integration tests require API_URL environment variable
const API_URL = process.env.API_URL || process.env.CLOUDFRONT_URL || 'https://dev.smultron.zwc.se';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error('Error: ADMIN_PASSWORD environment variable is required for integration tests');
  throw new Error('ADMIN_PASSWORD environment variable is required for integration tests');
}

// Normalize API URL
let normalizedApiUrl = API_URL;
if (!normalizedApiUrl.endsWith('/v1') && !normalizedApiUrl.endsWith('/api/v1')) {
  normalizedApiUrl = normalizedApiUrl.replace(/\/$/, '') + '/v1';
}

console.log(`Running order creation integration tests against: ${normalizedApiUrl}`);

describe('Integration Tests - Order Creation', () => {
  let authToken: string;
  let testProductId: string;
  let createdOrderId: string;
  let orderNumber: string;

  beforeAll(async () => {
    // Login to get auth token
    const loginResponse = await fetch(`${normalizedApiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD,
      }),
    });

    expect(loginResponse.status).toBe(200);
    const loginData: any = await loginResponse.json();
    authToken = loginData.token;

    // Create a test product to use in orders
    const productPayload = {
      slug: `test-order-product-${Date.now()}`,
      category: 'test',
      article: 'TEST-001',
      brand: 'Test Brand',
      title: 'Test Product for Orders',
      subtitle: 'Integration Test Product',
      price: 299,
      price_reduced: 0,
      description: ['Test product for order integration tests'],
      tag: 'test',
      index: 999,
      stock: 100,
      max_order: 10,
      image: 'https://example.com/test.jpg',
      images: [],
      status: 'active',
    };

    const createProductResponse = await fetch(`${normalizedApiUrl}/admin/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productPayload),
    });

    expect(createProductResponse.status).toBe(201);
    const productData: any = await createProductResponse.json();
    testProductId = productData.data.id;
    
    console.log(`Created test product ID: ${testProductId}`);
  });

  test('should create an order with correct structure', async () => {
    const orderPayload = {
      information: {
        name: 'Test Customer',
        company: 'Test Company',
        address: 'Test Street 123',
        zip: '12345',
        city: 'Test City',
        email: 'test@example.com',
        phone: '0701234567',
      },
      cart: [
        {
          id: testProductId,
          number: 2,
        },
      ],
      order: {
        delivery: 'postnord',
        delivery_cost: 82,
      },
    };

    const response = await fetch(`${normalizedApiUrl}/orders`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    if (response.status !== 201) {
      const errorText = await response.text();
      console.error(`Order creation failed with status ${response.status}`);
      console.error('Error response:', errorText);
    }

    expect(response.status).toBe(201);
    const responseData: any = await response.json();
    
    console.log('Order creation response:', JSON.stringify(responseData, null, 2));

    // Verify response structure
    expect(responseData.data).toBeDefined();
    const order = responseData.data;

    // Verify order ID is a GUID
    expect(order.id).toBeDefined();
    expect(typeof order.id).toBe('string');
    expect(order.id.length).toBeGreaterThan(0);
    createdOrderId = order.id;

    // Verify order number format (YYMM.XXX)
    expect(order.number).toBeDefined();
    expect(order.number).toMatch(/^\d{4}\.\d{3}$/);
    orderNumber = order.number;
    console.log(`Created order number: ${orderNumber}`);

    // Verify timestamps
    expect(order.date).toBeDefined();
    expect(typeof order.date).toBe('number');
    expect(order.date_change).toBeDefined();
    expect(typeof order.date_change).toBe('number');
    expect(order.date).toBe(order.date_change); // Should be same on creation

    // Verify status
    expect(order.status).toBe('active');

    // Verify delivery information
    expect(order.delivery).toBe('postnord');
    expect(order.delivery_cost).toBe(82);

    // Verify information
    expect(order.information).toBeDefined();
    expect(order.information.name).toBe('Test Customer');
    expect(order.information.company).toBe('Test Company');
    expect(order.information.address).toBe('Test Street 123');
    expect(order.information.zip).toBe('12345');
    expect(order.information.city).toBe('Test City');
    expect(order.information.email).toBe('test@example.com');
    expect(order.information.phone).toBe('0701234567');

    // Verify cart with frozen product data
    expect(order.cart).toBeDefined();
    expect(Array.isArray(order.cart)).toBe(true);
    expect(order.cart.length).toBe(1);

    const cartItem = order.cart[0];
    expect(cartItem.id).toBe(testProductId);
    expect(cartItem.number).toBe(2);

    // Verify frozen product data is present
    expect(cartItem.slug).toBeDefined();
    expect(cartItem.brand).toBeDefined();
    expect(cartItem.title).toBeDefined();
    expect(cartItem.subtitle).toBeDefined();
    expect(cartItem.price).toBeDefined();
    expect(typeof cartItem.price).toBe('number');

    console.log(`Frozen product data: ${cartItem.title} - ${cartItem.price} SEK`);

    // Verify timestamps
    expect(order.createdAt).toBeDefined();
    expect(order.updatedAt).toBeDefined();
  });

  test('should retrieve created order from database', async () => {
    expect(createdOrderId).toBeDefined();

    const response = await fetch(`${normalizedApiUrl}/admin/orders/${createdOrderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);
    const responseData: any = await response.json();

    console.log('Retrieved order:', JSON.stringify(responseData, null, 2));

    // Verify it's the same order
    expect(responseData.id).toBe(createdOrderId);
    expect(responseData.number).toBe(orderNumber);
    expect(responseData.status).toBe('active');

    // Verify frozen product data is intact
    expect(responseData.cart).toBeDefined();
    expect(responseData.cart.length).toBe(1);
    expect(responseData.cart[0].id).toBe(testProductId);
    expect(responseData.cart[0].number).toBe(2);
    expect(responseData.cart[0].title).toBeDefined();
    expect(responseData.cart[0].price).toBeDefined();
  });

  test('should reject order with missing information fields', async () => {
    const invalidPayload = {
      information: {
        name: 'Test Customer',
        // Missing required fields: address, zip, city, email, phone
      },
      cart: [{ id: testProductId, number: 1 }],
      order: {
        delivery: 'postnord',
        delivery_cost: 82,
      },
    };

    const response = await fetch(`${normalizedApiUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload),
    });

    expect(response.status).toBe(400);
    const errorData: any = await response.json();
    expect(errorData.error).toBeDefined();
    expect(errorData.error).toContain('Validation error');
  });

  test('should reject order with invalid email', async () => {
    const invalidPayload = {
      information: {
        name: 'Test Customer',
        company: '',
        address: 'Test Street 123',
        zip: '12345',
        city: 'Test City',
        email: 'invalid-email', // Invalid email format
        phone: '0701234567',
      },
      cart: [{ id: testProductId, number: 1 }],
      order: {
        delivery: 'postnord',
        delivery_cost: 82,
      },
    };

    const response = await fetch(`${normalizedApiUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload),
    });

    expect(response.status).toBe(400);
    const errorData: any = await response.json();
    expect(errorData.error).toBeDefined();
    expect(errorData.error).toContain('Invalid email');
  });

  test('should reject order with empty cart', async () => {
    const invalidPayload = {
      information: {
        name: 'Test Customer',
        company: '',
        address: 'Test Street 123',
        zip: '12345',
        city: 'Test City',
        email: 'test@example.com',
        phone: '0701234567',
      },
      cart: [], // Empty cart
      order: {
        delivery: 'postnord',
        delivery_cost: 82,
      },
    };

    const response = await fetch(`${normalizedApiUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload),
    });

    expect(response.status).toBe(400);
    const errorData: any = await response.json();
    expect(errorData.error).toBeDefined();
    expect(errorData.error).toContain('at least one item');
  });

  test('should reject order with invalid product quantity', async () => {
    const invalidPayload = {
      information: {
        name: 'Test Customer',
        company: '',
        address: 'Test Street 123',
        zip: '12345',
        city: 'Test City',
        email: 'test@example.com',
        phone: '0701234567',
      },
      cart: [{ id: testProductId, number: 0 }], // Invalid quantity
      order: {
        delivery: 'postnord',
        delivery_cost: 82,
      },
    };

    const response = await fetch(`${normalizedApiUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload),
    });

    expect(response.status).toBe(400);
    const errorData: any = await response.json();
    expect(errorData.error).toBeDefined();
    expect(errorData.error).toContain('at least 1');
  });

  test('should reject order with non-existent product', async () => {
    const invalidPayload = {
      information: {
        name: 'Test Customer',
        company: '',
        address: 'Test Street 123',
        zip: '12345',
        city: 'Test City',
        email: 'test@example.com',
        phone: '0701234567',
      },
      cart: [{ id: 'non-existent-product-id', number: 1 }],
      order: {
        delivery: 'postnord',
        delivery_cost: 82,
      },
    };

    const response = await fetch(`${normalizedApiUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload),
    });

    expect(response.status).toBe(404);
    const errorData: any = await response.json();
    expect(errorData.error).toBeDefined();
    expect(errorData.error).toContain('not found');
  });
});
