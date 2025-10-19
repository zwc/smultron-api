import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { createProduct, saveProduct } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response';
import { formatProduct } from '../utils/transform';

import { CreateProductRequestSchema, CreateProductResponseSchema } from '../schemas/handlers';

export const requestSchema = CreateProductRequestSchema;
export const responseSchema = CreateProductResponseSchema;

export const method = 'POST';
export const route = '/admin/products';
export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    
    // Validate required fields: title, subtitle, brand, price, stock, status
    if (!body.title || !body.subtitle || !body.brand || body.price === undefined || body.stock === undefined) {
      return errorResponse('Missing required fields: title, subtitle, brand, price, stock', 400);
    }

    // Validate status if provided
    if (body.status && body.status !== 'active' && body.status !== 'inactive') {
      return errorResponse('Status must be either "active" or "inactive"', 400);
    }

    const product = createProduct({
      slug: body.slug,
      category: body.category,
      article: body.article,
      brand: body.brand,
      title: body.title,
      subtitle: body.subtitle,
      price: body.price,
      price_reduced: body.price_reduced,
      description: body.description,
      tag: body.tag,
      index: body.index,
      stock: body.stock,
      max_order: body.max_order,
      image: body.image,
      images: body.images,
      status: body.status
    });

    await saveProduct(product);

  return successResponse(formatProduct(product), null, null, 201);
  } catch (error) {
    console.error('Create product error:', error);
    return errorResponse('Internal server error', 500);
  }
};
