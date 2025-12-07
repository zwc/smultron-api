import { expect, test, describe, beforeAll } from 'bun:test';

// Integration tests for order workflow: create → update → list with search/filter
// Requires API_URL and ADMIN_PASSWORD environment variables
const API_URL = process.env.API_URL || process.env.CLOUDFRONT_URL || 'https://dev.smultron.zwc.se';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD environment variable is required for integration tests');
}

let normalizedApiUrl = API_URL;
if (!normalizedApiUrl.endsWith('/v1') && !normalizedApiUrl.endsWith('/api/v1')) {
  normalizedApiUrl = normalizedApiUrl.replace(/\/$/, '') + '/v1';
}

console.log(`Running order workflow tests against: ${normalizedApiUrl}`);

let authToken: string;
let testOrderId: string;
let testOrderNumber: string;
let testCustomerName: string;
let testProductId: string;

describe('Order Workflow Integration Tests', () => {
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

    if (loginResponse.status !== 200) {
      throw new Error(`Authentication failed: ${loginResponse.status}`);
    }

    const loginData: any = await loginResponse.json();
    authToken = loginData.data.token;
    console.log('✓ Authenticated successfully');

    // Get an existing product to use in the test order
    const productsResponse = await fetch(`${normalizedApiUrl}/admin/products?status=active&limit=1`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (productsResponse.status === 200) {
      const productsResult: any = await productsResponse.json();
      const products = productsResult.data || productsResult;
      if (Array.isArray(products) && products.length > 0) {
        testProductId = products[0].id;
        console.log(`✓ Using existing product: ${testProductId}`);
      }
    }

    if (!testProductId) {
      throw new Error('No products available for testing. Please create at least one product first.');
    }
  });

  test('1. Create a new order', async () => {
    testCustomerName = `Test Customer ${Date.now()}`;
    
    const response = await fetch(`${normalizedApiUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        information: {
          name: testCustomerName,
          address: '123 Test Street',
          zip: '12345',
          city: 'Test City',
          phone: '+46701234567',
          email: `test-${Date.now()}@example.com`,
        },
        cart: [
          {
            id: testProductId,
            number: 2,
          },
        ],
        order: {
          delivery: 'standard',
          delivery_cost: 50,
        },
      }),
    });

    if (response.status !== 200 && response.status !== 201) {
      const errorData = await response.text();
      console.error(`Order creation failed (${response.status}):`, errorData);
    }

    expect([200, 201].includes(response.status)).toBe(true);
    
    const result: any = await response.json();
    
    // Handle both envelope and direct response
    const data = result.data || result;
    
    expect(data.id).toBeDefined();
    expect(data.number).toBeDefined();
    expect(data.status).toBeDefined();
    
    testOrderId = data.id;
    testOrderNumber = data.number;
    
    console.log(`✓ Order created: ${testOrderNumber} (ID: ${testOrderId})`);
  });

  test('2. Update order status', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ status: 'active' }),
    });

    expect(response.status).toBe(200);
    
    const result: any = await response.json();
    const data = result.data || result;
    
    expect(data.status).toBe('active');
    
    console.log(`✓ Order status updated to: active`);
  });

  test('3. List all orders and verify the order exists', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/orders`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    
    const result: any = await response.json();
    const orders = result.data || result;
    
    expect(Array.isArray(orders)).toBe(true);
    
    const foundOrder = orders.find((o: any) => o.id === testOrderId);
    expect(foundOrder).toBeDefined();
    expect(foundOrder.status).toBe('active');
    
    console.log(`✓ Order found in list (${orders.length} total orders)`);
  });

  test('4. Filter orders by status', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/orders?status=active`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    
    const result: any = await response.json();
    const orders = result.data || result;
    
    expect(Array.isArray(orders)).toBe(true);
    
    // All orders should have status 'active'
    orders.forEach((order: any) => {
      expect(order.status).toBe('active');
    });
    
    const foundOrder = orders.find((o: any) => o.id === testOrderId);
    expect(foundOrder).toBeDefined();
    
    console.log(`✓ Found ${orders.length} active orders (including test order)`);
  });

  test('5. Search orders by order number', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/orders?q=${encodeURIComponent(testOrderNumber)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    
    const result: any = await response.json();
    const orders = result.data || result;
    
    expect(Array.isArray(orders)).toBe(true);
    
    const foundOrder = orders.find((o: any) => o.id === testOrderId);
    expect(foundOrder).toBeDefined();
    
    console.log(`✓ Search by order number returned ${orders.length} result(s)`);
  });

  test('6. Search orders by customer name', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/orders?q=${encodeURIComponent(testCustomerName)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    
    const result: any = await response.json();
    const orders = result.data || result;
    
    expect(Array.isArray(orders)).toBe(true);
    
    const foundOrder = orders.find((o: any) => o.id === testOrderId);
    expect(foundOrder).toBeDefined();
    expect(foundOrder.information.name).toBe(testCustomerName);
    
    console.log(`✓ Search by customer name returned ${orders.length} result(s)`);
  });

  test('7. Test pagination with limit and offset', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/orders?limit=5&offset=0`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    
    const result: any = await response.json();
    
    // Check if response has meta and data (envelope format)
    if (result.meta) {
      expect(result.data).toBeDefined();
      expect(result.meta.limit).toBe(5);
      expect(result.meta.offset).toBe(0);
      expect(result.meta.total).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(5);
      
      console.log(`✓ Pagination working: ${result.data.length} items, total: ${result.meta.total}`);
    } else {
      // Fallback: if no envelope, just check array
      expect(Array.isArray(result)).toBe(true);
      console.log(`✓ Got ${result.length} orders (pagination may need envelope support)`);
    }
  });

  test('8. Test sorting orders by date (descending)', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/orders?sort=-date&limit=10`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    
    const result: any = await response.json();
    const orders = result.data || result;
    
    expect(Array.isArray(orders)).toBe(true);
    
    // Check if orders are sorted by date (descending)
    if (orders.length > 1) {
      for (let i = 0; i < orders.length - 1; i++) {
        const currentDate = orders[i].date || 0;
        const nextDate = orders[i + 1].date || 0;
        expect(currentDate).toBeGreaterThanOrEqual(nextDate);
      }
      console.log(`✓ Orders sorted by date (descending), ${orders.length} items`);
    } else {
      console.log(`✓ Sorting test passed (only ${orders.length} order(s))`);
    }
  });

  test('9. Combine status filter and search query', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/orders?status=active&q=${encodeURIComponent(testCustomerName)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    
    const result: any = await response.json();
    const orders = result.data || result;
    
    expect(Array.isArray(orders)).toBe(true);
    
    // All orders should have status 'active' and match the search
    orders.forEach((order: any) => {
      expect(order.status).toBe('active');
    });
    
    const foundOrder = orders.find((o: any) => o.id === testOrderId);
    expect(foundOrder).toBeDefined();
    
    console.log(`✓ Combined filter + search returned ${orders.length} result(s)`);
  });

  test('10. Update order status to inactive', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/orders/${testOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ status: 'inactive' }),
    });

    expect(response.status).toBe(200);
    
    const result: any = await response.json();
    const data = result.data || result;
    
    expect(data.status).toBe('inactive');
    
    console.log(`✓ Order status updated to: inactive`);
  });

  test('11. Verify order is not in active filter after status change', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/orders?status=active`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    
    const result: any = await response.json();
    const orders = result.data || result;
    
    expect(Array.isArray(orders)).toBe(true);
    
    const foundOrder = orders.find((o: any) => o.id === testOrderId);
    expect(foundOrder).toBeUndefined();
    
    console.log(`✓ Order no longer appears in active filter`);
  });

  test('12. Verify order appears in inactive filter', async () => {
    const response = await fetch(`${normalizedApiUrl}/admin/orders?status=inactive`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    
    const result: any = await response.json();
    const orders = result.data || result;
    
    expect(Array.isArray(orders)).toBe(true);
    
    const foundOrder = orders.find((o: any) => o.id === testOrderId);
    expect(foundOrder).toBeDefined();
    expect(foundOrder.status).toBe('inactive');
    
    console.log(`✓ Order appears in inactive filter`);
  });
});
