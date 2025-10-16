import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { verifyAuthToken } from '../middleware/auth';
import { getCategoryBySlug, updateCategory } from '../services/product';
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '../utils/response';
import { stripCategoryId } from '../utils/transform';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!verifyAuthToken(event.headers)) {
      return unauthorizedResponse();
    }

    const slug = event.pathParameters?.slug;
    
    if (!slug) {
      return errorResponse('Category slug is required', 400);
    }

    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    // Get the category by slug to find its internal ID
    const category = await getCategoryBySlug(slug);
    if (!category) {
      return notFoundResponse('Category');
    }

    const body = JSON.parse(event.body);
    
    // Filter out protected fields that cannot be updated
    const { id: _id, slug: _slug, ...updates } = body;
    
    // Validate status field if provided
    if ('status' in updates && updates.status !== 'active' && updates.status !== 'inactive') {
      return errorResponse('Status must be either "active" or "inactive"', 400);
    }
    
    const updatedCategory = await updateCategory(category.id, updates);

    return successResponse({ data: stripCategoryId(updatedCategory) });
  } catch (error) {
    console.error('Update category error:', error);
    return errorResponse('Internal server error', 500);
  }
};
