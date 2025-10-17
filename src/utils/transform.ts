import type { Product, Category } from '../types';

/**
 * Remove internal ID from product for public API responses
 */
export const stripProductId = (product: Product): Omit<Product, 'id'> => {
  const { id, ...rest } = product;
  return rest;
};

/**
 * Remove internal ID from category for public API responses
 */
export const stripCategoryId = (category: Category): Omit<Category, 'id'> => {
  const { id, ...rest } = category;
  return rest;
};

/**
 * Remove internal IDs from array of products
 */
export const stripProductIds = (products: Product[]): Omit<Product, 'id'>[] => {
  return products.map(stripProductId);
};

/**
 * Remove internal IDs from array of categories
 */
export const stripCategoryIds = (categories: Category[]): Omit<Category, 'id'>[] => {
  return categories.map(stripCategoryId);
};

/**
 * Format product with consistent field ordering
 */
export const formatProduct = (product: Product): Product => {
  return {
    id: product.id,
    slug: product.slug,
    category: product.category,
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
  };
};

/**
 * Format products with consistent field ordering
 */
export const formatProducts = (products: Product[]): Product[] => {
  return products.map(formatProduct);
};

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
  };
};

/**
 * Format categories with consistent field ordering
 */
export const formatCategories = (categories: Category[]): Category[] => {
  return categories.map(formatCategory);
};
