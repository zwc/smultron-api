import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { getAllCategories, getActiveProducts } from '../services/product';
import { successResponse, errorResponse } from '../utils/response';
import { ListCatalogResponseSchema } from '../schemas/handlers';

export const responseSchema = ListCatalogResponseSchema;

export const method = 'GET';
export const route = '/catalog';
import { formatCategories, formatProducts } from '../utils/transform';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    // Fetch both categories and products in parallel for better performance
    // Only return active products and categories for public catalog
    const [categories, products] = await Promise.all([
      getAllCategories('active'),
      getActiveProducts()
    ]);

    const formattedCategories = formatCategories(categories);
    const formattedProducts = formatProducts(products);

    return successResponse(
      { products: formattedProducts, categories: formattedCategories },
      { productsTotal: formattedProducts.length, categoriesTotal: formattedCategories.length }
    );
  } catch (error) {
    console.error('List catalog error:', error);
    return errorResponse('Internal server error', 500);
  }
};
