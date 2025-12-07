import { z } from 'zod';

export const ProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  categorySlug: z.string().optional(),
  article: z.string().optional(),
  brand: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  price: z.number(),
  price_reduced: z.number().optional(),
  description: z.array(z.string()).optional(),
  tag: z.string().optional(),
  index: z.number().optional(),
  stock: z.number(),
  max_order: z.number().optional(),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PublicProductSchema = ProductSchema.omit({ id: true });

export type Product = z.infer<typeof ProductSchema>;
export type PublicProduct = z.infer<typeof PublicProductSchema>;
