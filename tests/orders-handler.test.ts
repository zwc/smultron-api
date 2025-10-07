import { describe, test, expect, beforeAll } from 'bun:test';
import { generateToken } from '../src/utils/jwt';
import { handler as createOrder } from '../src/handlers/create.order';
import { handler as getOrderById } from '../src/handlers/get.order';
import { handler as listOrders } from '../src/handlers/list.orders';
import { handler as updateOrderStatus } from '../src/handlers/update.order.status';

describe('Order Handlers', () => {
  let authToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key';
    authToken = generateToken({ username: 'admin' });
  });

  test('should reject create order with missing fields', async () => {
    const event = {
      body: JSON.stringify({ items: [] }),
    } as any;

    const response = await createOrder(event);

    expect(response.statusCode).toBe(400);
  });

  test('should reject create order with empty items', async () => {
    const event = {
      body: JSON.stringify({
        items: [],
        total: 100,
        customerEmail: 'test@test.com',
        customerName: 'Test User',
      }),
    } as any;

    const response = await createOrder(event);

    expect(response.statusCode).toBe(400);
  });

  test('should require auth to list orders', async () => {
    const event = {
      headers: {},
    } as any;

    const response = await listOrders(event);

    expect(response.statusCode).toBe(401);
  });

  test('should require auth to get order', async () => {
    const event = {
      headers: {},
      pathParameters: { id: '1' },
    } as any;

    const response = await getOrderById(event);

    expect(response.statusCode).toBe(401);
  });

  test('should require auth to update order status', async () => {
    const event = {
      headers: {},
      pathParameters: { id: '1' },
      body: JSON.stringify({ status: 'confirmed' }),
    } as any;

    const response = await updateOrderStatus(event);

    expect(response.statusCode).toBe(401);
  });

  test('should reject invalid order status', async () => {
    const event = {
      headers: { Authorization: `Bearer ${authToken}` },
      pathParameters: { id: '1' },
      body: JSON.stringify({ status: 'invalid' }),
    } as any;

    const response = await updateOrderStatus(event);

    expect(response.statusCode).toBe(400);
  });
});
