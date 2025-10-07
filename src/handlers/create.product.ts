import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { createProduct, saveProduct } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse } from '../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const body = JSON.parse(event.body);
    const { 
      category, 
      article = '', 
      brand, 
      title, 
      subtitle = '', 
      price, 
      price_reduced = 0,
      description = [],
      tag = '',
      index,
      stock,
      max_order = 0,
      image,
      images = []
    } = body;

    if (!category || !brand || !title || price === undefined || index === undefined || stock === undefined || !image) {
      return errorResponse('Missing required fields', 400);
    }

    const product = createProduct({
      category,
      article,
      brand,
      title,
      subtitle,
      price,
      price_reduced,
      description,
      tag,
      index,
      stock,
      max_order,
      image,
      images: images.length > 0 ? images : [image]
    });

    await saveProduct(product);

    return successResponse(product, 201);
  } catch (error) {
    console.error('Create product error:', error);
    return errorResponse('Internal server error', 500);
  }
};
