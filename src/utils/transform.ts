import type { Product, Category } from '../types'

export type PublicProduct = Omit<Product, 'id'> & { categoryId: string }
export type AdminProduct = Product

const getProductCategory = (product: Product): string =>
  product.category ||
  (product as Product & { categorySlug?: string }).categorySlug ||
  ''

/**
 * Transform product for public API responses
 * Keeps id, renames categorySlug to category, and adds categoryId
 */
export const stripProductId = (
  product: Product,
  categories: Category[],
): PublicProduct => {
  const category = getProductCategory(product)
  const categoryId = categories.find((c) => c.slug === category)?.id || ''
  const { id: _id, ...rest } = product

  return {
    ...rest,
    category,
    categoryId,
  }
}

/**
 * Remove internal IDs from array of products
 * Categories are required to look up categoryId for each product
 */
export const stripProductIds = (
  products: Product[],
  categories: Category[],
): PublicProduct[] =>
  products.map((product) => stripProductId(product, categories))

/**
 * @deprecated Use formatCategories instead - categories now include id
 * Remove internal IDs from array of categories
 */
export const stripCategoryIds = (categories: Category[]): Category[] => {
  return formatCategories(categories)
}

/**
 * Format product with consistent field ordering
 * Returns 'category' (slug value) instead of 'categorySlug' for API responses
 */
export const formatProduct = (product: Product): AdminProduct => {
  return {
    id: product.id,
    slug: product.slug,
    category: getProductCategory(product),
    article: product.article,
    brand: product.brand,
    title: product.title,
    subtitle: product.subtitle,
    price: product.price,
    price_reduced: product.price_reduced,
    description: product.description,
    tag: product.tag,
    index: product.index,
    stock: product.stock,
    max_order: product.max_order,
    image: product.image,
    images: product.images,
    status: product.status,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  }
}

/**
 * Format products with consistent field ordering
 */
export const formatProducts = (products: Product[]): AdminProduct[] => {
  return products.map(formatProduct)
}

/**
 * Format category with consistent field ordering
 */
export const formatCategory = (category: Category): Category => {
  return {
    id: category.id,
    slug: category.slug,
    brand: category.brand,
    title: category.title,
    subtitle: category.subtitle,
    status: category.status,
    index: category.index,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  }
}

/**
 * Format categories with consistent field ordering
 */
export const formatCategories = (categories: Category[]): Category[] => {
  return categories.map(formatCategory)
}
