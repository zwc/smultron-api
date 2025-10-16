import { expect, test, describe, beforeAll, afterAll } from 'bun:test';
import { handler as listCategoriesHandler } from '../src/handlers/admin.list.categories';
import { handler as createCategoryHandler } from '../src/handlers/create.category';
import { handler as deleteCategoryHandler } from '../src/handlers/delete.category';
import { handler as loginHandler } from '../src/handlers/login';
import type { APIGatewayProxyEvent } from 'aws-lambda';

// Load dev environment variables
const envFile = Bun.file('.env.dev');
const envContent = await envFile.text();
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
});

// Mock API Gateway event creator
const createEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
  body: overrides.body || null,
  headers: overrides.headers || {},
  multiValueHeaders: {},
  httpMethod: overrides.httpMethod || 'GET',
  isBase64Encoded: false,
  path: overrides.path || '/',
  pathParameters: overrides.pathParameters || null,
  queryStringParameters: overrides.queryStringParameters || null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    protocol: 'HTTP/1.1',
    httpMethod: overrides.httpMethod || 'GET',
    path: overrides.path || '/',
    stage: 'test',
    requestId: 'test-request-id',
    requestTime: '09/Apr/2015:12:34:56 +0000',
    requestTimeEpoch: 1428582896000,
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: 'Custom User Agent String',
      userArn: null,
    },
    authorizer: null,
    domainName: 'test-domain.execute-api.us-east-1.amazonaws.com',
    resourceId: 'test-resource',
    resourcePath: '/{proxy+}',
  },
  resource: '/{proxy+}',
});

describe('Admin Categories Response Format Tests', () => {
  let authToken: string;
  let testCategoryId: string;

  beforeAll(async () => {
    // Login to get auth token
    const loginEvent = createEvent({
      httpMethod: 'POST',
      path: '/v1/auth/login',
      body: JSON.stringify({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      }),
    });

    const loginResponse = await loginHandler(loginEvent);
    const loginData = JSON.parse(loginResponse.body);
    authToken = loginData.token;

    // Create a test category
    const categoryEvent = createEvent({
      httpMethod: 'POST',
      path: '/v1/admin/categories',
      body: JSON.stringify({
        id: `test-format-cat-${Date.now()}`,
        brand: 'Test Brand',
        title: 'Format Test Category',
        subtitle: 'Test',
        index: 100,
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const categoryResponse = await createCategoryHandler(categoryEvent);
    const categoryData = JSON.parse(categoryResponse.body);
    testCategoryId = categoryData.id;
  });

  test('should return categories with data wrapper and meta', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/categories',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await listCategoriesHandler(event);
    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    
    // Verify response structure
    expect(body.data).toBeDefined();
    expect(body.meta).toBeDefined();
    
    // Verify data is an array
    expect(Array.isArray(body.data)).toBe(true);
    
    // Verify meta has total
    expect(body.meta.total).toBeDefined();
    expect(typeof body.meta.total).toBe('number');
    expect(body.meta.total).toBeGreaterThan(0);
    
    // Verify data length matches total
    expect(body.data.length).toBe(body.meta.total);
    
    // Verify categories have proper structure
    body.data.forEach((category: any) => {
      expect(category.id).toBeDefined();
      expect(category.title).toBeDefined();
      expect(category.brand).toBeDefined();
      expect(category.index).toBeDefined();
    });
    
    console.log('Categories response format:', {
      totalCategories: body.meta.total,
      sampleCategory: body.data[0],
    });
  });

  test('should reject without authentication', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/categories',
    });

    const response = await listCategoriesHandler(event);
    expect(response.statusCode).toBe(401);
  });

  afterAll(async () => {
    // Cleanup test category
    if (testCategoryId) {
      const event = createEvent({
        httpMethod: 'DELETE',
        path: `/v1/admin/categories/${testCategoryId}`,
        pathParameters: { id: testCategoryId },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      await deleteCategoryHandler(event);
    }
  });
});
