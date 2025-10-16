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
