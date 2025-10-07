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
    expect(JSON.parse(response.body)).toEqual(data);
    expect(response.headers?.['Content-Type']).toBe('application/json');
  });

  test('should create success response with custom status code', () => {
    const data = { id: '123' };
    const response = successResponse(data, 201);

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toEqual(data);
  });

  test('should create error response', () => {
    const response = errorResponse('Something went wrong', 500);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ error: 'Something went wrong' });
  });

  test('should create unauthorized response', () => {
    const response = unauthorizedResponse();

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual({ error: 'Unauthorized' });
  });

  test('should create not found response', () => {
    const response = notFoundResponse('Product');

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'Product not found' });
  });

  test('should include CORS headers', () => {
    const response = successResponse({ data: 'test' });

    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*');
    expect(response.headers?.['Access-Control-Allow-Methods']).toBeDefined();
  });
});
