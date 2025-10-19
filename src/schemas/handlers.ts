import { z } from 'zod';
import { OrderSchema, OrderInformationSchema, OrderCartItemSchema } from './order';
import { LoginRequestSchema, LoginResponseSchema } from './auth';
import { envelope } from './common';
import { ProductSchema, PublicProductSchema } from './product';
import { CategorySchema, PublicCategorySchema } from './category';

// Orders
export const CreateOrderRequestSchema = z.object({
  information: OrderInformationSchema,
  cart: z.array(z.object({ id: z.string(), number: z.number().int().min(1) })),
  order: z.object({ delivery: z.string(), delivery_cost: z.number().min(0) }),
});

export const CreateOrderResponseSchema = envelope(OrderSchema);

export const ListOrdersResponseSchema = envelope(z.array(OrderSchema));
export const GetOrderResponseSchema = envelope(OrderSchema);

// Products
export const ListProductsResponseSchema = envelope(z.array(ProductSchema));
export const GetProductResponseSchema = envelope(ProductSchema);
export const CreateProductRequestSchema = ProductSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const CreateProductResponseSchema = envelope(ProductSchema);
export const UpdateProductRequestSchema = ProductSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });

// Categories
export const ListCategoriesResponseSchema = envelope(z.array(CategorySchema));
export const GetCategoryResponseSchema = envelope(CategorySchema);
export const CreateCategoryRequestSchema = CategorySchema.omit({ id: true, createdAt: true, updatedAt: true });
export const CreateCategoryResponseSchema = envelope(CategorySchema);
export const UpdateCategoryRequestSchema = CategorySchema.partial().omit({ id: true, createdAt: true, updatedAt: true });

// Catalog (combined)
export const ListCatalogResponseSchema = envelope(z.object({ products: z.array(ProductSchema), categories: z.array(CategorySchema) }));

// Admin products listing with meta
export const AdminProductsResponseSchema = envelope(
  z.object({
    items: z.array(ProductSchema),
    categories: z.array(z.object({ id: z.string(), slug: z.string(), title: z.string() })),
    total: z.number().int().min(0),
  })
);

// Update order status
export const UpdateOrderStatusRequestSchema = z.object({ status: z.enum(['active', 'inactive', 'invalid']) });
export const UpdateOrderStatusResponseSchema = envelope(OrderSchema);

// Auth
export const LoginRequest = LoginRequestSchema;
export const LoginResponse = LoginResponseSchema;

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
export type CreateOrderResponse = z.infer<typeof CreateOrderResponseSchema>;

export type ListOrdersResponse = z.infer<typeof ListOrdersResponseSchema>;
export type GetOrderResponse = z.infer<typeof GetOrderResponseSchema>;

export type LoginRequestT = z.infer<typeof LoginRequest>;
export type LoginResponseT = z.infer<typeof LoginResponse>;
