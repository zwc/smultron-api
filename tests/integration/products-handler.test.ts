import { describe, test, expect, beforeAll } from 'bun:test';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { generateToken } from '../src/utils/jwt';
import { handler as createProduct } from '../src/handlers/create.product';
import { handler as getProductById } from '../src/handlers/get.product';
import { handler as updateProduct } from '../src/handlers/update.product';
import { handler as deleteProduct } from '../src/handlers/delete.product';

describe('Product Handlers', () => {
  let authToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key';
    authToken = generateToken({ username: 'admin' });
  });

  test('should reject create product without auth', () => {
    const event = {
      headers: {},
      body: JSON.stringify({ name: 'Product' }),
    } as any;

    const response = createProduct(event);

    expect(response).resolves.toMatchObject({
      statusCode: 401,
    });
  });

  test('should reject create product with missing fields', async () => {
    const event = {
      headers: { Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ title: 'Product' }),
    } as any;

    const response = await createProduct(event);

    expect(response.statusCode).toBe(400);
  });

  test('should require product ID for update', async () => {
    const event = {
      headers: { Authorization: `Bearer ${authToken}` },
      pathParameters: {},
      body: JSON.stringify({ name: 'Updated' }),
    } as any;

    const response = await updateProduct(event);

    expect(response.statusCode).toBe(400);
  });

  test('should require auth for update', async () => {
    const event = {
      headers: {},
      pathParameters: { id: '1' },
      body: JSON.stringify({ title: 'Updated' }),
    } as any;

    const response = await updateProduct(event);

    expect(response.statusCode).toBe(401);
  });

  test('should require auth for delete', async () => {
    const event = {
      headers: {},
      pathParameters: { id: '1' },
    } as any;

    const response = await deleteProduct(event);

    expect(response.statusCode).toBe(401);
  });

  test('should require product ID for delete', async () => {
    const event = {
      headers: { Authorization: `Bearer ${authToken}` },
      pathParameters: {},
    } as any;

    const response = await deleteProduct(event);

    expect(response.statusCode).toBe(400);
  });

  test('should require product ID for get', async () => {
    const event = {
      pathParameters: {},
    } as any;

    const response = await getProductById(event);

    expect(response.statusCode).toBe(400);
  });
});
