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

console.log(`Running order status update integration tests against: ${normalizedApiUrl}`);

describe('Integration Tests - Order Status Update', () => {
  let authToken: string;
  let testProductId: string;
  let testOrderId: string;
  let orderNumber: string;
  let initialDate: number;
  let initialDateChange: number;

  beforeAll(async () => {
    // Login to get auth token
  const loginResponse = await fetch(`${normalizedApiUrl}/admin/login`, {
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
      slug: `test-status-product-${Date.now()}`,
      category: 'test',
      article: 'TEST-STATUS-001',
      brand: 'Test Brand',
      title: 'Test Product for Status Updates',
      subtitle: 'Integration Test Product',
      price: 199,
      price_reduced: 0,
      description: ['Test product for order status integration tests'],
      tag: 'test',
      index: 999,
      stock: 50,
      max_order: 10,
      image: 'https://example.com/test-status.jpg',
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

    // Create a test order
    const orderPayload = {
      information: {
        name: 'Status Test Customer',
        company: '',
        address: 'Status Test Street 456',
        zip: '54321',
        city: 'Status Test City',
        email: 'statustest@example.com',
        phone: '0709876543',
      },
      cart: [
        {
          id: testProductId,
          number: 1,
        },
      ],
      order: {
        delivery: 'dhl',
        delivery_cost: 99,
      },
    };

    const createResponse = await fetch(`${normalizedApiUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });

    expect(createResponse.status).toBe(201);
    const orderData: any = await createResponse.json();
    
    testOrderId = orderData.data.id;
    orderNumber = orderData.data.number;
    initialDate = orderData.data.date;
    initialDateChange = orderData.data.date_change;

    console.log(`Created test order: ${orderNumber} (ID: ${testOrderId})`);
  });

  test('should update order status from active to inactive', async () => {
    // Wait a moment to ensure date_change will be different
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await fetch(`${normalizedApiUrl}/admin/admin/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'inactive',
      }),
    });

    expect(response.status).toBe(200);
    const responseData: any = await response.json();

    console.log('Status update response:', JSON.stringify(responseData, null, 2));

    // Verify response structure
    expect(responseData.data).toBeDefined();
    const updatedOrder = responseData.data;

    // Verify order ID and number haven't changed
    expect(updatedOrder.id).toBe(testOrderId);
    expect(updatedOrder.number).toBe(orderNumber);

    // Verify status was updated
    expect(updatedOrder.status).toBe('inactive');

    // Verify date_change was updated but date stayed the same
    expect(updatedOrder.date).toBe(initialDate);
    expect(updatedOrder.date_change).toBeGreaterThan(initialDateChange);

    console.log(`Status changed from active to inactive`);
    console.log(`Original date: ${initialDate}, Original date_change: ${initialDateChange}`);
    console.log(`New date: ${updatedOrder.date}, New date_change: ${updatedOrder.date_change}`);
  });

  test('should verify status update persisted in database', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/admin/orders/${testOrderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    expect(response.status).toBe(200);
    const orderData: any = await response.json();

    console.log('Retrieved updated order:', JSON.stringify(orderData, null, 2));

    // Verify the status change persisted
    expect(orderData.id).toBe(testOrderId);
    expect(orderData.number).toBe(orderNumber);
    expect(orderData.status).toBe('inactive');

    // Verify timestamps
    expect(orderData.date).toBe(initialDate);
    expect(orderData.date_change).toBeGreaterThan(initialDateChange);

    // Verify all other data remained unchanged
    expect(orderData.information.name).toBe('Status Test Customer');
    expect(orderData.delivery).toBe('dhl');
    expect(orderData.delivery_cost).toBe(99);
    expect(orderData.cart.length).toBe(1);
    expect(orderData.cart[0].id).toBe(testProductId);
  });

  test('should update order status to invalid', async () => {
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await fetch(`${normalizedApiUrl}/admin/admin/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'invalid',
      }),
    });

    expect(response.status).toBe(200);
    const responseData: any = await response.json();

    expect(responseData.data.status).toBe('invalid');
    expect(responseData.data.date_change).toBeGreaterThan(initialDateChange);

    console.log(`Status updated to invalid`);
  });

  test('should update order status back to active', async () => {
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await fetch(`${normalizedApiUrl}/admin/admin/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'active',
      }),
    });

    expect(response.status).toBe(200);
    const responseData: any = await response.json();

    expect(responseData.data.status).toBe('active');
    expect(responseData.data.date).toBe(initialDate); // Original date unchanged
    expect(responseData.data.date_change).toBeGreaterThan(initialDateChange);

    console.log(`Status updated back to active`);
  });

  test('should reject status update without authentication', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/admin/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'inactive',
      }),
    });

    expect(response.status).toBe(401);
    const errorData: any = await response.json();
    expect(errorData.error).toBeDefined();
  });

  test('should reject status update with invalid status value', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/admin/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'pending', // Invalid - only active, inactive, invalid are allowed
      }),
    });

    expect(response.status).toBe(400);
    const errorData: any = await response.json();
    expect(errorData.error).toBeDefined();
    expect(errorData.error).toContain('Validation error');
  });

  test('should reject status update with missing status field', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/admin/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}), // Missing status field
    });

    expect(response.status).toBe(400);
    const errorData: any = await response.json();
    expect(errorData.error).toBeDefined();
  });

  test('should reject status update for non-existent order', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/admin/orders/non-existent-id/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'inactive',
      }),
    });

    expect(response.status).toBe(500);
    // DynamoDB will throw an error when trying to update a non-existent item
  });

  test('should allow multiple status changes and track date_change', async () => {
    const statusChanges = ['inactive', 'active', 'invalid', 'active'];
    let lastDateChange = initialDateChange;

    for (const newStatus of statusChanges) {
      await new Promise(resolve => setTimeout(resolve, 500));

      const response = await fetch(`${normalizedApiUrl}/admin/admin/orders/${testOrderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      expect(response.status).toBe(200);
      const data: any = await response.json();

      expect(data.data.status).toBe(newStatus);
      expect(data.data.date).toBe(initialDate); // Original date never changes
      expect(data.data.date_change).toBeGreaterThan(lastDateChange);

      lastDateChange = data.data.date_change;
      console.log(`Changed to ${newStatus}, date_change: ${lastDateChange}`);
    }
  });
});
