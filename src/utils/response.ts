import type { APIResponse } from '../types';

export const createResponse = <T>(
  statusCode: number,
  data: T,
  headers: Record<string, string> = {}
): APIResponse => ({
  statusCode,
  body: JSON.stringify(data),
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    ...headers,
  },
});

export const successResponse = <T>(data: T, statusCode: number = 200): APIResponse =>
  createResponse(statusCode, data);

export const errorResponse = (message: string, statusCode: number = 400): APIResponse =>
  createResponse(statusCode, { error: message });

export const unauthorizedResponse = (): APIResponse =>
  errorResponse('Unauthorized', 401);

export const notFoundResponse = (resource: string = 'Resource'): APIResponse =>
  errorResponse(`${resource} not found`, 404);
