import { z } from 'zod';

export const OrderInformationSchema = z.object({
  name: z.string(),
  company: z.string().optional().default(''),
  address: z.string(),
  zip: z.string(),
  city: z.string(),
  email: z.string().email(),
  phone: z.string(),
});

export const OrderCartItemSchema = z.object({
  id: z.string(),
  number: z.number().int().min(1),
  slug: z.string().optional(),
  categorySlug: z.string().optional(),
  article: z.string().optional(),
  brand: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  price: z.number().optional(),
  price_reduced: z.number().optional(),
  description: z.array(z.string()).optional(),
  tag: z.string().optional(),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
});

export const OrderSchema = z.object({
  id: z.string(),
  number: z.string(),
  date: z.number(),
  date_change: z.number(),
  status: z.enum(['active', 'inactive', 'invalid']),
  delivery: z.string(),
  delivery_cost: z.number(),
  information: OrderInformationSchema,
  cart: z.array(OrderCartItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Order = z.infer<typeof OrderSchema>;
