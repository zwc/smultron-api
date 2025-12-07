import { describe, test, expect } from 'bun:test';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
} from '../src/utils/response';

describe('Response Utils', () => {
  test('should create success response', () => {
    const data = { message: 'Success' };
    const response = successResponse(data);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual(data);
    expect(body.meta).toBeNull();
    expect(body.links).toBeNull();
    expect(body.error).toBeNull();
    expect(response.headers?.['Content-Type']).toBe('application/json');
  });

  test('should create success response with custom status code', () => {
    const data = { id: '123' };
    const response = successResponse(data, null, null, 201);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual(data);
  });

  test('should create success response with meta and links', () => {
    const data = { id: '123' };
    const meta = { total: 10 };
    const links = { self: '/api/resource' };
    const response = successResponse(data, meta, links);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual(data);
    expect(body.meta).toEqual(meta);
    expect(body.links).toEqual(links);
  });

  test('should create error response', () => {
    const response = errorResponse('Something went wrong', 500);

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.data).toBeNull();
    expect(body.error).toEqual({ message: 'Something went wrong' });
  });

  test('should create unauthorized response', () => {
    const response = unauthorizedResponse();

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toEqual({ message: 'Unauthorized' });
  });

  test('should create not found response', () => {
    const response = notFoundResponse('Product');

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toEqual({ message: 'Product not found' });
  });

  test('should include CORS headers', () => {
    const response = successResponse({ data: 'test' });

    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers?.['Access-Control-Allow-Methods']).toBeDefined();
  });
});
