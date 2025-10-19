import { z } from 'zod';

// Helper to wrap a data schema into the standard envelope: { data, meta, links, error }
export const envelope = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema.nullable(),
    meta: z.any().nullable(),
    links: z.any().nullable(),
    error: z
      .object({
        message: z.string(),
      })
      .nullable(),
  });

export type Envelope<T> = z.infer<ReturnType<typeof envelope>>;
