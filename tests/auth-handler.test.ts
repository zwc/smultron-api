import { describe, test, expect, beforeAll } from 'bun:test';
import type { APIGatewayProxyEvent } from 'aws-lambda';

describe('Auth Handler', () => {
  beforeAll(() => {
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'password123';
    process.env.JWT_SECRET = 'test-secret-key';
  });

  test('should login successfully with correct credentials', async () => {
    const { handler } = await import('../src/handlers/login');
    
    const event = {
      body: JSON.stringify({
        username: 'admin',
        password: 'password123',
      }),
    } as APIGatewayProxyEvent;

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
  });

  test('should fail login with incorrect username', async () => {
    const { handler } = await import('../src/handlers/login');
    
    const event = {
      body: JSON.stringify({
        username: 'wronguser',
        password: 'password123',
      }),
    } as APIGatewayProxyEvent;

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(401);
    expect(body.error).toBe('Invalid credentials');
  });

  test('should fail login with incorrect password', async () => {
    const { handler } = await import('../src/handlers/login');
    
    const event = {
      body: JSON.stringify({
        username: 'admin',
        password: 'wrongpassword',
      }),
    } as APIGatewayProxyEvent;

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(401);
    expect(body.error).toBe('Invalid credentials');
  });

  test('should fail login with missing credentials', async () => {
    const { handler } = await import('../src/handlers/login');
    
    const event = {
      body: JSON.stringify({}),
    } as APIGatewayProxyEvent;

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(400);
    expect(body.error).toBe('Username and password are required');
  });

  test('should fail login with invalid JSON', async () => {
    const { handler } = await import('../src/handlers/login');
    
    const event = {
      body: 'invalid json',
    } as APIGatewayProxyEvent;

    const response = await handler(event);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(400);
    expect(body.error).toBe('Invalid request body');
  });
});
