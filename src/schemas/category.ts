import { z } from 'zod';

export const CategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  brand: z.string().optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  index: z.number(),
  status: z.enum(['active', 'inactive']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PublicCategorySchema = CategorySchema.omit({ id: true });

export type Category = z.infer<typeof CategorySchema>;
export type PublicCategory = z.infer<typeof PublicCategorySchema>;
