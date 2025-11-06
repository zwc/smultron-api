import { z } from 'zod';

// Swish payment request schema
export const SwishPaymentRequestSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default('SEK'),
  callbackUrl: z.string().url().optional(),
  payeeAlias: z.string(), // Swish merchant number
  payerAlias: z.string().optional(), // Customer phone number
  message: z.string().max(50).optional(),
  payeePaymentReference: z.string().max(35).optional(), // Order number
});

// Swish payment response schema
export const SwishPaymentResponseSchema = z.object({
  id: z.string(),
  payeePaymentReference: z.string().optional(),
  callbackUrl: z.string().optional(),
  payerAlias: z.string().optional(),
  payeeAlias: z.string(),
  amount: z.number(),
  currency: z.string(),
  message: z.string().optional(),
  status: z.enum(['CREATED', 'PAID', 'DECLINED', 'ERROR', 'CANCELLED']),
  dateCreated: z.string().optional(),
  datePaid: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type SwishPaymentRequest = z.infer<typeof SwishPaymentRequestSchema>;
export type SwishPaymentResponse = z.infer<typeof SwishPaymentResponseSchema>;
