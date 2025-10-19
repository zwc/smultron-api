import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { generateToken } from '../utils/jwt';
import { successResponse, errorResponse } from '../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!event.body) {
      return errorResponse('Invalid request body', 400);
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return errorResponse('Invalid request body', 400);
    }

    const { username, password } = body;

    if (!username || !password) {
      return errorResponse('Username and password are required', 400);
    }

    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (username !== adminUsername || password !== adminPassword) {
      return errorResponse('Invalid credentials', 401);
    }

    const token = generateToken({ username });

  return successResponse({ token });
  } catch (error) {
    console.error('Auth error:', error);
    return errorResponse('Internal server error', 500);
  }
};
