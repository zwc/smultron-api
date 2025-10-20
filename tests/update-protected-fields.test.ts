import { expect, test, describe, beforeAll, afterAll } from 'bun:test';
import { handler as updateProductHandler } from '../src/handlers/update.product';
import { handler as updateCategoryHandler } from '../src/handlers/update.category';
import { handler as createProductHandler } from '../src/handlers/create.product';
import { handler as createCategoryHandler } from '../src/handlers/create.category';
import { handler as getProductHandler } from '../src/handlers/get.product';
import { handler as getCategoryHandler } from '../src/handlers/get.category';
import { handler as deleteProductHandler } from '../src/handlers/delete.product';
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

describe('Update with Protected Fields Tests', () => {
  let authToken: string;
  let testProductId: string;
  let testCategoryId: string;

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
    authToken = loginData.token;

    // Create test product
    const productEvent = createEvent({
      httpMethod: 'POST',
      path: '/v1/products',
      body: JSON.stringify({
        category: 'test-category',
        article: `TEST-PROTECT-${Date.now()}`,
        brand: 'Test Brand',
        title: 'Protected Fields Test Product',
        subtitle: 'Original Subtitle',
        price: 99.99,
        description: ['Test'],
        tag: 'test',
        index: 1,
        stock: 10,
        max_order: 5,
        image: 'https://example.com/image.jpg',
        images: [],
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const productResponse = await createProductHandler(productEvent);
    const productData = JSON.parse(productResponse.body);
    testProductId = productData.id;

    // Create test category
    const categoryEvent = createEvent({
      httpMethod: 'POST',
      path: '/v1/categories',
      body: JSON.stringify({
        id: `test-protect-cat-${Date.now()}`,
        brand: 'Test Brand',
        title: 'Protected Fields Test Category',
        subtitle: 'Original Subtitle',
        index: 1,
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const categoryResponse = await createCategoryHandler(categoryEvent);
    const categoryData = JSON.parse(categoryResponse.body);
    testCategoryId = categoryData.id;
  });

  test('should update product even when id is sent in body', async () => {
    const event = createEvent({
      httpMethod: 'PUT',
      path: `/v1/products/${testProductId}`,
      pathParameters: { id: testProductId },
      body: JSON.stringify({
        id: 'should-be-ignored',  // This should be filtered out
        subtitle: 'Updated Subtitle',
        price: 149.99,
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await updateProductHandler(event);
    expect(response.statusCode).toBe(200);
    
    const data = JSON.parse(response.body);
    expect(data.id).toBe(testProductId); // Should still be the original ID
    expect(data.subtitle).toBe('Updated Subtitle');
    expect(data.price).toBe(149.99);

    console.log('Product updated successfully, id was not changed');
  });

  test('should update product even when createdAt/updatedAt are sent in body', async () => {
    const fakeDate = '2020-01-01T00:00:00.000Z';
    
    const event = createEvent({
      httpMethod: 'PUT',
      path: `/v1/products/${testProductId}`,
      pathParameters: { id: testProductId },
      body: JSON.stringify({
        createdAt: fakeDate,  // This should be filtered out
        updatedAt: fakeDate,  // This should be filtered out
        price: 199.99,
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await updateProductHandler(event);
    expect(response.statusCode).toBe(200);
    
    const data = JSON.parse(response.body);
    expect(data.price).toBe(199.99);
    // updatedAt should be a new timestamp, not the fake one
    expect(data.updatedAt).not.toBe(fakeDate);
    expect(new Date(data.updatedAt).getTime()).toBeGreaterThan(new Date(fakeDate).getTime());

    console.log('Product updated successfully, timestamps were handled correctly');
  });

  test('should update category even when id is sent in body', async () => {
    const event = createEvent({
      httpMethod: 'PUT',
      path: `/v1/categories/${testCategoryId}`,
      pathParameters: { id: testCategoryId },
      body: JSON.stringify({
        id: 'should-be-ignored',  // This should be filtered out
        subtitle: 'Updated Category Subtitle',
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await updateCategoryHandler(event);
    expect(response.statusCode).toBe(200);
    
    const data = JSON.parse(response.body);
    expect(data.id).toBe(testCategoryId); // Should still be the original ID
    expect(data.subtitle).toBe('Updated Category Subtitle');

    console.log('Category updated successfully, id was not changed');
  });

  test('should verify product changes persisted', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: `/v1/products/${testProductId}`,
      pathParameters: { id: testProductId },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await getProductHandler(event);
    expect(response.statusCode).toBe(200);
    
    const data = JSON.parse(response.body);
    expect(data.id).toBe(testProductId);
    expect(data.price).toBe(199.99);
    expect(data.subtitle).toBe('Updated Subtitle');
  });

  afterAll(async () => {
    // Cleanup test product
    if (testProductId) {
      const event = createEvent({
        httpMethod: 'DELETE',
        path: `/v1/products/${testProductId}`,
        pathParameters: { id: testProductId },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      await deleteProductHandler(event);
    }

    // Cleanup test category
    if (testCategoryId) {
      const event = createEvent({
        httpMethod: 'DELETE',
        path: `/v1/categories/${testCategoryId}`,
        pathParameters: { id: testCategoryId },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      await deleteCategoryHandler(event);
    }
  });
});
