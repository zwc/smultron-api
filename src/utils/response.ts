import type { APIResponse } from '../types';

type Envelope<T> = {
  data?: T | null;
  meta?: Record<string, any> | null;
  links?: Record<string, any> | null;
  error?: { message: string } | null;
};

const baseHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export const createResponse = <T>(
  statusCode: number,
  envelope: Envelope<T>,
  headers: Record<string, string> = {}
): APIResponse => ({
  statusCode,
  body: JSON.stringify(envelope),
  headers: {
    ...baseHeaders,
    ...headers,
  },
});

export const successResponse = <T>(
  data: T | null = null,
  meta: Record<string, any> | null = null,
  links: Record<string, any> | null = null,
  statusCode: number = 200
): APIResponse =>
  createResponse(statusCode, { data, meta, links, error: null });

export const errorResponse = (
  message: string,
  _statusCode: number = 200,
  meta: Record<string, any> | null = null
): APIResponse => createResponse(200, { data: null, meta, links: null, error: { message } });

export const unauthorizedResponse = (): APIResponse =>
  errorResponse('Unauthorized');

export const notFoundResponse = (resource: string = 'Resource'): APIResponse =>
  errorResponse(`${resource} not found`);
