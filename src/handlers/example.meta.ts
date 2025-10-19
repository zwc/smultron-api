import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { successResponse } from '../utils/response';
import { ExampleRequestSchema, ExampleResponseSchema } from '../schemas/meta-example';

export const requestSchema = ExampleRequestSchema;
export const responseSchema = ExampleResponseSchema;

export const method = 'POST';
export const route = '/example/{id}';

// Handler-level OpenAPI metadata
export const openapi = {
  summary: 'Example endpoint demonstrating zod .meta()',
  description: 'Shows how to attach params and headers via schema.meta()',
  tags: ['example'],
  operationId: 'exampleMeta',
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  // Very small demo handler: echo parsed input
  const body = event.body ? JSON.parse(event.body) : {};
  return successResponse({ success: true, createdId: body?.id || null });
};
