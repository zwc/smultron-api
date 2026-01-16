import { z } from 'zod'
import { OrderSchema, OrderInformationSchema } from './order'
import { LoginRequestSchema, LoginResponseSchema } from './auth'
import { envelope } from './common'
import { ProductSchema } from './product'
import { CategorySchema } from './category'

// Pagination query parameters
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

// List query parameters (pagination + filters)
export const createListQuerySchema = <TSortFields extends readonly string[]>(
  sortFields: TSortFields,
  defaultSort: TSortFields[number],
) =>
  PaginationQuerySchema.extend({
    status: z.enum(['active', 'inactive']).optional(),
    q: z.string().optional(),
    sort: z
      .enum(sortFields as any)
      .optional()
      .default(defaultSort),
  })

// Admin Categories List Query Parameters
export const AdminListCategoriesQuerySchema = createListQuerySchema(
  [
    'id',
    '-id',
    'title',
    '-title',
    'brand',
    '-brand',
    'index',
    '-index',
    'createdAt',
    '-createdAt',
    'updatedAt',
    '-updatedAt',
  ] as const,
  'title',
)

// Admin Products List Query Parameters
export const AdminListProductsQuerySchema = createListQuerySchema(
  [
    'createdAt',
    '-createdAt',
    'updatedAt',
    '-updatedAt',
    'id',
    '-id',
    'title',
    '-title',
    'index',
    '-index',
  ] as const,
  '-createdAt',
)

// Orders
export const CreateOrderRequestSchema = z.object({
  information: OrderInformationSchema,
  cart: z.array(z.object({ id: z.string(), number: z.number().int().min(1) })),
  order: z.object({ delivery: z.string(), delivery_cost: z.number().min(0) }),
})

export const CreateOrderResponseSchema = envelope(OrderSchema)

export const ListOrdersResponseSchema = envelope(z.array(OrderSchema))
export const GetOrderResponseSchema = envelope(OrderSchema)

// Products
export const ListProductsResponseSchema = envelope(z.array(ProductSchema))
export const GetProductResponseSchema = envelope(ProductSchema)
export const CreateProductRequestSchema = ProductSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export const CreateProductResponseSchema = envelope(ProductSchema)
export const UpdateProductRequestSchema = ProductSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

// Categories
export const ListCategoriesResponseSchema = envelope(z.array(CategorySchema))
export const GetCategoryResponseSchema = envelope(CategorySchema)
export const CreateCategoryRequestSchema = CategorySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export const CreateCategoryResponseSchema = envelope(CategorySchema)
export const UpdateCategoryRequestSchema = CategorySchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

// Catalog (combined)
export const ListCatalogResponseSchema = envelope(
  z.object({
    products: z.array(ProductSchema.extend({ categoryId: z.string() })),
    categories: z.array(CategorySchema),
  }),
)

// Admin products listing with meta
// Previously data contained an object with `items`. Move to return products directly in `data` as an array.
export const AdminProductsResponseSchema = envelope(z.array(ProductSchema))

// Update order status
export const UpdateOrderStatusRequestSchema = z.object({
  status: z.enum(['active', 'inactive', 'invalid']),
})
export const UpdateOrderStatusResponseSchema = envelope(OrderSchema)

// Auth
export const LoginRequest = LoginRequestSchema
export const LoginResponse = LoginResponseSchema

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>
export type CreateOrderResponse = z.infer<typeof CreateOrderResponseSchema>

export type ListOrdersResponse = z.infer<typeof ListOrdersResponseSchema>
export type GetOrderResponse = z.infer<typeof GetOrderResponseSchema>

export type LoginRequestT = z.infer<typeof LoginRequest>
export type LoginResponseT = z.infer<typeof LoginResponse>
