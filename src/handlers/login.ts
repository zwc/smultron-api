import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { generateToken } from '../utils/jwt';
import { successResponse, errorResponse } from '../utils/response';
import { LoginRequest, LoginResponse } from '../schemas/handlers';

export const requestSchema = LoginRequest;
export const responseSchema = LoginResponse;

export const method = 'POST';
export const route = '/admin/login';

// Hardcoded user credentials
const USERS = [
  { name: 'Linn Forbes', username: 'linn', password: 'e5uu588hzfwge367' },
  { name: 'Josefine Montan', username: 'jossan', password: '4jjbfehwagz3wd54' },
  { name: 'Henrik Lindqvist', username: 'henrik', password: 'ap9sw7djedybkvgd' },
  { name: 'Bernhard Hettman', username: 'bernhard', password: 'kj1yus9jmq9hdz5f' },
];

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

    // Check hardcoded users first
    const user = USERS.find(u => u.username === username && u.password === password);
    if (user) {
      const token = generateToken({ username: user.username });
      return successResponse({ token, name: user.name });
    }

    // Fallback to environment variables for backward compatibility
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (username === adminUsername && password === adminPassword) {
      const token = generateToken({ username });
      return successResponse({ token, name: 'Admin' });
    }

    return errorResponse('Invalid credentials', 401);
  } catch (error) {
    console.error('Auth error:', error);
    return errorResponse('Internal server error', 500);
  }
};
