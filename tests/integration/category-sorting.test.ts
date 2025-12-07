import { expect, test, describe, beforeAll, afterAll } from 'bun:test';
import { handler as loginHandler } from '../src/handlers/login';
import { handler as listCategoriesHandler } from '../src/handlers/admin.list.categories';
import { handler as createCategoryHandler } from '../src/handlers/create.category';
import { handler as deleteCategoryHandler } from '../src/handlers/delete.category';
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

describe('Category Sorting Tests', () => {
  let authToken: string;
  const testCategoryIds: string[] = [];

  beforeAll(async () => {
    // Login to get auth token
    const loginEvent = createEvent({
      httpMethod: 'POST',
  path: '/v1/admin/login',
      body: JSON.stringify({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      }),
    });

    const loginResponse = await loginHandler(loginEvent);
    const loginData = JSON.parse(loginResponse.body);
    authToken = loginData.data.token;

    // Create test categories with different values for sorting
    const testCategories = [
      { brand: 'Brand A', title: 'Zebra Category', index: 30 },
      { brand: 'Brand C', title: 'Apple Category', index: 10 },
      { brand: 'Brand B', title: 'Mango Category', index: 20 },
    ];

    for (const cat of testCategories) {
      const categoryEvent = createEvent({
        httpMethod: 'POST',
        path: '/v1/admin/categories',
        body: JSON.stringify({
          ...cat,
          subtitle: 'Sort test',
          status: 'active',
        }),
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const categoryResponse = await createCategoryHandler(categoryEvent);
      const categoryData = JSON.parse(categoryResponse.body);
      testCategoryIds.push(categoryData.id);
    }

    console.log('Test setup complete:', { testCategoryIds });
  });

  test('sorts by title ascending (default)', async () => {
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
    const testCats = body.data.filter((c: any) => testCategoryIds.includes(c.id));
    
    expect(testCats[0].title).toBe('Apple Category');
    expect(testCats[1].title).toBe('Mango Category');
    expect(testCats[2].title).toBe('Zebra Category');
    
    console.log('Sort by title (default):', testCats.map((c: any) => c.title));
  });

  test('sorts by title descending', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/categories',
      queryStringParameters: { sort: '-title' },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await listCategoriesHandler(event);
    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    const testCats = body.data.filter((c: any) => testCategoryIds.includes(c.id));
    
    expect(testCats[0].title).toBe('Zebra Category');
    expect(testCats[1].title).toBe('Mango Category');
    expect(testCats[2].title).toBe('Apple Category');
    
    console.log('Sort by -title:', testCats.map((c: any) => c.title));
  });

  test('sorts by brand ascending', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/categories',
      queryStringParameters: { sort: 'brand' },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await listCategoriesHandler(event);
    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    const testCats = body.data.filter((c: any) => testCategoryIds.includes(c.id));
    
    expect(testCats[0].brand).toBe('Brand A');
    expect(testCats[1].brand).toBe('Brand B');
    expect(testCats[2].brand).toBe('Brand C');
    
    console.log('Sort by brand:', testCats.map((c: any) => c.brand));
  });

  test('sorts by index ascending', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/categories',
      queryStringParameters: { sort: 'index' },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await listCategoriesHandler(event);
    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    const testCats = body.data.filter((c: any) => testCategoryIds.includes(c.id));
    
    expect(testCats[0].index).toBe(10);
    expect(testCats[1].index).toBe(20);
    expect(testCats[2].index).toBe(30);
    
    console.log('Sort by index:', testCats.map((c: any) => c.index));
  });

  test('sorts by index descending', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/categories',
      queryStringParameters: { sort: '-index' },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await listCategoriesHandler(event);
    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    const testCats = body.data.filter((c: any) => testCategoryIds.includes(c.id));
    
    expect(testCats[0].index).toBe(30);
    expect(testCats[1].index).toBe(20);
    expect(testCats[2].index).toBe(10);
    
    console.log('Sort by -index:', testCats.map((c: any) => c.index));
  });

  test('returns error for invalid sort parameter', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/categories',
      queryStringParameters: { sort: 'invalid' },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await listCategoriesHandler(event);
    expect(response.statusCode).toBe(400);
    
    const body = JSON.parse(response.body);
    expect(body.message).toContain('Invalid');
  });

  afterAll(async () => {
    // Cleanup test categories
    for (const id of testCategoryIds) {
      await deleteCategoryHandler(createEvent({
        httpMethod: 'DELETE',
        path: `/v1/admin/categories/${id}`,
        pathParameters: { id },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }));
    }

    console.log('Cleanup complete');
  });
});
