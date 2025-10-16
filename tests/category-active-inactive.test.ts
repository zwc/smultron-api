import { expect, test, describe, beforeAll, afterAll } from 'bun:test';
import { handler as loginHandler } from '../src/handlers/login';
import { handler as listCategoriesHandler } from '../src/handlers/admin.list.categories';
import { handler as createCategoryHandler } from '../src/handlers/create.category';
import { handler as updateCategoryHandler } from '../src/handlers/update.category';
import { handler as deleteCategoryHandler } from '../src/handlers/delete.category';
import { handler as listCatalogHandler } from '../src/handlers/list.catalog';
import { handler as createProductHandler } from '../src/handlers/create.product';
import { handler as deleteProductHandler } from '../src/handlers/delete.product';
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

describe('Category Active/Inactive Tests', () => {
  let authToken: string;
  let activeCategoryId: string;
  let inactiveCategoryId: string;
  let testProductId: string;

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

    // Create an active category
    const activeCategoryEvent = createEvent({
      httpMethod: 'POST',
      path: '/v1/admin/categories',
      body: JSON.stringify({
        id: `test-active-cat-${Date.now()}`,
        brand: 'Test Brand',
        title: 'Active Category',
        subtitle: 'This is active',
        index: 100,
        active: true,
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
        id: `test-inactive-cat-${Date.now()}`,
        brand: 'Test Brand',
        title: 'Inactive Category',
        subtitle: 'This is inactive',
        index: 101,
        active: false,
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const inactiveCategoryResponse = await createCategoryHandler(inactiveCategoryEvent);
    const inactiveCategoryData = JSON.parse(inactiveCategoryResponse.body);
    inactiveCategoryId = inactiveCategoryData.id;

    // Create a test product
    const productEvent = createEvent({
      httpMethod: 'POST',
      path: '/v1/admin/products',
      body: JSON.stringify({
        id: `test-product-${Date.now()}`,
        category: activeCategoryId,
        article: 'TEST001',
        brand: 'Test Brand',
        title: 'Test Product',
        subtitle: 'For category tests',
        price: 99.99,
        price_reduced: 79.99,
        description: ['Test description'],
        tag: 'test',
        index: 100,
        stock: 10,
        max_order: 5,
        image: 'test.jpg',
        images: ['test1.jpg', 'test2.jpg'],
        status: 'active',
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const productResponse = await createProductHandler(productEvent);
    const productData = JSON.parse(productResponse.body);
    testProductId = productData.id;

    console.log('Test setup complete:', {
      activeCategoryId,
      inactiveCategoryId,
      testProductId,
    });
  });

  test('admin should see all categories (active and inactive)', async () => {
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
    
    console.log('Admin sees all categories:', {
      total: body.data.length,
      activeFound,
      inactiveFound,
    });
  });

  test('public catalog should only show active categories', async () => {
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

  test.skip('product detail should only show active categories', async () => {
    // TODO: This test needs to be updated - products don't return categories
    // Consider removing or rewriting this test
    expect(true).toBe(true); // Placeholder
  });

  test('can create category with active=false', async () => {
    const event = createEvent({
      httpMethod: 'POST',
      path: '/v1/admin/categories',
      body: JSON.stringify({
        id: `test-inactive-new-${Date.now()}`,
        brand: 'Test Brand',
        title: 'New Inactive Category',
        subtitle: 'Created as inactive',
        index: 102,
        active: false,
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await createCategoryHandler(event);
    expect(response.statusCode).toBe(201);
    
    const body = JSON.parse(response.body);
    expect(body.active).toBe(false);
    
    // Cleanup
    await deleteCategoryHandler(createEvent({
      httpMethod: 'DELETE',
      path: `/v1/admin/categories/${body.id}`,
      pathParameters: { id: body.id },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }));
  });

  test('can update category active status', async () => {
    // Update active category to inactive
    const event = createEvent({
      httpMethod: 'PUT',
      path: `/v1/admin/categories/${activeCategoryId}`,
      pathParameters: { id: activeCategoryId },
      body: JSON.stringify({
        active: false,
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await updateCategoryHandler(event);
    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.active).toBe(false);
    
    // Verify it's no longer in public catalog
    const catalogEvent = createEvent({
      httpMethod: 'GET',
      path: '/v1/catalog',
    });
    
    const catalogResponse = await listCatalogHandler(catalogEvent);
    const catalogBody = JSON.parse(catalogResponse.body);
    const found = catalogBody.categories.some((cat: any) => cat.id === activeCategoryId);
    expect(found).toBe(false);
    
    console.log('Category hidden from public after setting active=false');
    
    // Restore it back to active for cleanup
    await updateCategoryHandler(createEvent({
      httpMethod: 'PUT',
      path: `/v1/admin/categories/${activeCategoryId}`,
      pathParameters: { id: activeCategoryId },
      body: JSON.stringify({ active: true }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }));
  });

  test('category defaults to active=true if not specified', async () => {
    const event = createEvent({
      httpMethod: 'POST',
      path: '/v1/admin/categories',
      body: JSON.stringify({
        id: `test-default-active-${Date.now()}`,
        brand: 'Test Brand',
        title: 'Default Active Category',
        subtitle: 'No active field provided',
        index: 103,
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await createCategoryHandler(event);
    expect(response.statusCode).toBe(201);
    
    const body = JSON.parse(response.body);
    expect(body.active).toBe(true);
    
    // Cleanup
    await deleteCategoryHandler(createEvent({
      httpMethod: 'DELETE',
      path: `/v1/admin/categories/${body.id}`,
      pathParameters: { id: body.id },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    }));
  });

  afterAll(async () => {
    // Cleanup test data
    if (testProductId) {
      await deleteProductHandler(createEvent({
        httpMethod: 'DELETE',
        path: `/v1/admin/products/${testProductId}`,
        pathParameters: { id: testProductId },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }));
    }

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
