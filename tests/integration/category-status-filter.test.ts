import { expect, test, describe, beforeAll, afterAll } from 'bun:test';
import { handler as loginHandler } from '../src/handlers/login';
import { handler as listCategoriesHandler } from '../src/handlers/admin.list.categories';
import { handler as createCategoryHandler } from '../src/handlers/create.category';
import { handler as updateCategoryHandler } from '../src/handlers/update.category';
import { handler as deleteCategoryHandler } from '../src/handlers/delete.category';
import { handler as listCatalogHandler } from '../src/handlers/list.catalog';
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

describe('Category Status Filter Tests', () => {
  let authToken: string;
  let activeCategoryId: string;
  let inactiveCategoryId: string;

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

    // Create an active category
    const activeCategoryEvent = createEvent({
      httpMethod: 'POST',
      path: '/v1/admin/categories',
      body: JSON.stringify({
        brand: 'Test Brand',
        title: `Active Category ${Date.now()}`,
        subtitle: 'This is active',
        index: 100,
        status: 'active',
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const activeCategoryResponse = await createCategoryHandler(activeCategoryEvent);
    const activeCategoryData = JSON.parse(activeCategoryResponse.body);
    activeCategoryId = activeCategoryData.id;

    // Create an inactive category
    const inactiveCategoryEvent = createEvent({
      httpMethod: 'POST',
      path: '/v1/admin/categories',
      body: JSON.stringify({
        brand: 'Test Brand',
        title: `Inactive Category ${Date.now()}`,
        subtitle: 'This is inactive',
        index: 101,
        status: 'inactive',
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const inactiveCategoryResponse = await createCategoryHandler(inactiveCategoryEvent);
    const inactiveCategoryData = JSON.parse(inactiveCategoryResponse.body);
    inactiveCategoryId = inactiveCategoryData.id;

    console.log('Test setup complete:', {
      activeCategoryId,
      inactiveCategoryId,
    });
  });

  test('admin can list all categories without filter', async () => {
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
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    
    // Should find both active and inactive categories
    const activeFound = body.data.some((cat: any) => cat.id === activeCategoryId);
    const inactiveFound = body.data.some((cat: any) => cat.id === inactiveCategoryId);
    
    expect(activeFound).toBe(true);
    expect(inactiveFound).toBe(true);
    
    console.log('Admin sees all categories (no filter):', {
      total: body.data.length,
      activeFound,
      inactiveFound,
    });
  });

  test('admin can filter categories by status=active', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/categories',
      queryStringParameters: { status: 'active' },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await listCategoriesHandler(event);
    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    
    // Should find active category
    const activeFound = body.data.some((cat: any) => cat.id === activeCategoryId);
    expect(activeFound).toBe(true);
    
    // Should NOT find inactive category
    const inactiveFound = body.data.some((cat: any) => cat.id === inactiveCategoryId);
    expect(inactiveFound).toBe(false);
    
    // All categories should have status=active
    body.data.forEach((cat: any) => {
      expect(cat.status).toBe('active');
    });
    
    console.log('Admin filtered by status=active:', {
      total: body.data.length,
      activeFound,
      inactiveFound,
    });
  });

  test('admin can filter categories by status=inactive', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/categories',
      queryStringParameters: { status: 'inactive' },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await listCategoriesHandler(event);
    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    
    // Should find inactive category
    const inactiveFound = body.data.some((cat: any) => cat.id === inactiveCategoryId);
    expect(inactiveFound).toBe(true);
    
    // Should NOT find active category
    const activeFound = body.data.some((cat: any) => cat.id === activeCategoryId);
    expect(activeFound).toBe(false);
    
    // All categories should have status=inactive
    body.data.forEach((cat: any) => {
      expect(cat.status).toBe('inactive');
    });
    
    console.log('Admin filtered by status=inactive:', {
      total: body.data.length,
      activeFound,
      inactiveFound,
    });
  });

  test('public catalog only shows active categories by default', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/catalog',
    });

    const response = await listCatalogHandler(event);
    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.categories).toBeDefined();
    expect(body.categories.data).toBeDefined();
    expect(Array.isArray(body.categories.data)).toBe(true);
    
    // Should find active category
    const activeFound = body.categories.data.some((cat: any) => cat.id === activeCategoryId);
    expect(activeFound).toBe(true);
    
    // Should NOT find inactive category
    const inactiveFound = body.categories.data.some((cat: any) => cat.id === inactiveCategoryId);
    expect(inactiveFound).toBe(false);
    
    console.log('Public catalog shows only active categories:', {
      total: body.categories.meta.total,
      activeFound,
      inactiveFound,
    });
  });

  test('invalid status filter returns error', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/categories',
      queryStringParameters: { status: 'invalid' },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await listCategoriesHandler(event);
    expect(response.statusCode).toBe(400);
    
    const body = JSON.parse(response.body);
    expect(body.message).toContain('active');
    expect(body.message).toContain('inactive');
  });

  test('can toggle category status', async () => {
    // Update active to inactive
    const updateEvent = createEvent({
      httpMethod: 'PUT',
      path: `/v1/admin/categories/${activeCategoryId}`,
      pathParameters: { id: activeCategoryId },
      body: JSON.stringify({
        status: 'inactive',
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const updateResponse = await updateCategoryHandler(updateEvent);
    expect(updateResponse.statusCode).toBe(200);
    
    const body = JSON.parse(updateResponse.body);
    expect(body.status).toBe('inactive');
    
    // Verify it's now filtered out when status=active
    const listEvent = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/categories',
      queryStringParameters: { status: 'active' },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    
    const listResponse = await listCategoriesHandler(listEvent);
    const listBody = JSON.parse(listResponse.body);
    const found = listBody.data.some((cat: any) => cat.id === activeCategoryId);
    expect(found).toBe(false);
    
    console.log('Category hidden from active filter after toggling status');
    
    // Restore it back to active for cleanup
    await updateCategoryHandler(createEvent({
      httpMethod: 'PUT',
      path: `/v1/admin/categories/${activeCategoryId}`,
      pathParameters: { id: activeCategoryId },
      body: JSON.stringify({ status: 'active' }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }));
  });

  afterAll(async () => {
    // Cleanup test data
    if (activeCategoryId) {
      await deleteCategoryHandler(createEvent({
        httpMethod: 'DELETE',
        path: `/v1/admin/categories/${activeCategoryId}`,
        pathParameters: { id: activeCategoryId },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }));
    }

    if (inactiveCategoryId) {
      await deleteCategoryHandler(createEvent({
        httpMethod: 'DELETE',
        path: `/v1/admin/categories/${inactiveCategoryId}`,
        pathParameters: { id: inactiveCategoryId },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }));
    }

    console.log('Cleanup complete');
  });
});
