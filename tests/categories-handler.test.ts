import { describe, test, expect, beforeAll } from 'bun:test';
import { generateToken } from '../src/utils/jwt';
import { handler as createCategory } from '../src/handlers/create.category';
import { handler as updateCategory } from '../src/handlers/update.category';
import { handler as deleteCategory } from '../src/handlers/delete.category';

describe('Category Handlers', () => {
  let authToken: string;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key';
    authToken = generateToken({ username: 'admin' });
  });

  test('should reject create category without auth', async () => {
    const event = {
      headers: {},
      body: JSON.stringify({ brand: 'Test', title: 'Category', index: 1 }),
    } as any;

    const response = await createCategory(event);

    expect(response.statusCode).toBe(401);
  });

  test('should reject create category with missing fields', async () => {
    const event = {
      headers: { Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ title: 'Category' }),
    } as any;

    const response = await createCategory(event);

    expect(response.statusCode).toBe(400);
  });

  test('should require auth for update', async () => {
    const event = {
      headers: {},
      pathParameters: { id: '1' },
      body: JSON.stringify({ title: 'Updated' }),
    } as any;

    const response = await updateCategory(event);

    expect(response.statusCode).toBe(401);
  });

  test('should require auth for delete', async () => {
    const event = {
      headers: {},
      pathParameters: { id: '1' },
    } as any;

    const response = await deleteCategory(event);

    expect(response.statusCode).toBe(401);
  });
});
