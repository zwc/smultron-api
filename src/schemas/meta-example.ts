import { z } from 'zod';

// Example request schema demonstrating .meta() usage
export const ExampleRequestSchema = z
  .object({
    id: z.string().uuid(),
    q: z.string().optional(),
  })
  .meta({
    id: 'ExampleRequest',
    // param can be used to inject request parameters (path/query/header)
    param: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
      { name: 'q', in: 'query', required: false, schema: { type: 'string' } },
    ],
    // indicate this is the input io id (optional)
    unusedIO: 'input',
  });

// Example response schema and meta demonstrating outputId and headers
export const ExampleResponseSchema = z
  .object({
    success: z.boolean(),
    createdId: z.string().uuid().optional(),
  })
  .meta({
    outputId: 'ExampleResponse',
    header: {
      'X-Example-Header': { description: 'An example header', schema: { type: 'string' } },
    },
  });
