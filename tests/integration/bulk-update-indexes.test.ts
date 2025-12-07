import { expect, test, describe, beforeAll, afterAll } from 'bun:test';
import { handler as adminUpdateProductIndexesHandler } from '../src/handlers/admin.update.product.indexes';
import { handler as adminUpdateCategoryIndexesHandler } from '../src/handlers/admin.update.category.indexes';
import { handler as adminListProductsHandler } from '../src/handlers/admin.list.products';
import { handler as listCategoriesHandler } from '../src/handlers/admin.list.categories';
import { handler as createProductHandler } from '../src/handlers/create.product';
import { handler as createCategoryHandler } from '../src/handlers/create.category';
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

describe('Bulk Update Indexes Tests', () => {
  let authToken: string;
  let testProductIds: string[] = [];
  let testCategoryIds: string[] = [];

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

    // Create test products
    for (let i = 1; i <= 3; i++) {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/v1/products',
        body: JSON.stringify({
          categorySlug: 'test-category',
          article: `TEST-BULK-${Date.now()}-${i}`,
          brand: 'Test Brand',
          title: `Bulk Test Product ${i}`,
          subtitle: 'Test',
          price: 99.99,
          description: ['Test'],
          tag: 'test',
          index: i * 10,
          stock: 10,
          max_order: 5,
          image: 'https://example.com/image.jpg',
          images: [],
        }),
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const response = await createProductHandler(event);
      const data = JSON.parse(response.body);
      testProductIds.push(data.id);
    }

    // Create test categories
    for (let i = 1; i <= 3; i++) {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/v1/categories',
        body: JSON.stringify({
          id: `test-bulk-cat-${Date.now()}-${i}`,
          brand: 'Test Brand',
          title: `Bulk Test Category ${i}`,
          subtitle: 'Test',
          index: i * 10,
        }),
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const response = await createCategoryHandler(event);
      const data = JSON.parse(response.body);
      testCategoryIds.push(data.id);
    }
  });

  test('should bulk update product indexes', async () => {
    const event = createEvent({
      httpMethod: 'PATCH',
      path: '/v1/admin/products/indexes',
      body: JSON.stringify({
        updates: [
          { id: testProductIds[0], index: 30 },
          { id: testProductIds[1], index: 10 },
          { id: testProductIds[2], index: 20 },
        ],
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await adminUpdateProductIndexesHandler(event);
    expect(response.statusCode).toBe(200);
    
    const data = JSON.parse(response.body);
    expect(data.updated).toBe(3);
    expect(data.message).toContain('3 product');

    // Verify the indexes were updated by fetching products sorted by index
    const listEvent = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/products',
      queryStringParameters: {
        sort: 'index',
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const listResponse = await adminListProductsHandler(listEvent);
    const listData = JSON.parse(listResponse.body);
    const testProducts = listData.data.filter((p: any) => testProductIds.includes(p.id));
    
    // Should be sorted: product[1]=10, product[2]=20, product[0]=30
    expect(testProducts[0].id).toBe(testProductIds[1]);
    expect(testProducts[0].index).toBe(10);
    expect(testProducts[1].id).toBe(testProductIds[2]);
    expect(testProducts[1].index).toBe(20);
    expect(testProducts[2].id).toBe(testProductIds[0]);
    expect(testProducts[2].index).toBe(30);

    console.log('Product indexes updated successfully');
  });

  test('should bulk update category indexes', async () => {
    const event = createEvent({
      httpMethod: 'PATCH',
      path: '/v1/admin/categories/indexes',
      body: JSON.stringify({
        updates: [
          { id: testCategoryIds[0], index: 3 },
          { id: testCategoryIds[1], index: 1 },
          { id: testCategoryIds[2], index: 2 },
        ],
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await adminUpdateCategoryIndexesHandler(event);
    expect(response.statusCode).toBe(200);
    
    const data = JSON.parse(response.body);
    expect(data.updated).toBe(3);
    expect(data.message).toContain('3 category');

    // Verify by fetching categories
    const listEvent = createEvent({
      httpMethod: 'GET',
      path: '/v1/categories',
    });

    const listResponse = await listCategoriesHandler(listEvent);
    const categories = JSON.parse(listResponse.body);
    const testCategories = categories.filter((c: any) => testCategoryIds.includes(c.id));
    
    // Verify the indexes were updated
    const category1 = testCategories.find((c: any) => c.id === testCategoryIds[1]);
    const category2 = testCategories.find((c: any) => c.id === testCategoryIds[2]);
    const category0 = testCategories.find((c: any) => c.id === testCategoryIds[0]);
    
    expect(category1.index).toBe(1);
    expect(category2.index).toBe(2);
    expect(category0.index).toBe(3);

    console.log('Category indexes updated successfully');
  });

  test('should reject without authentication', async () => {
    const event = createEvent({
      httpMethod: 'PATCH',
      path: '/v1/admin/products/indexes',
      body: JSON.stringify({
        updates: [{ id: 'test', index: 1 }],
      }),
    });

    const response = await adminUpdateProductIndexesHandler(event);
    expect(response.statusCode).toBe(401);
  });

  test('should reject invalid request body', async () => {
    const event = createEvent({
      httpMethod: 'PATCH',
      path: '/v1/admin/products/indexes',
      body: JSON.stringify({
        updates: 'invalid',
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await adminUpdateProductIndexesHandler(event);
    expect(response.statusCode).toBe(400);
  });

  afterAll(async () => {
    // Cleanup test products
    for (const productId of testProductIds) {
      const event = createEvent({
        httpMethod: 'DELETE',
        path: `/v1/products/${productId}`,
        pathParameters: { id: productId },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      await deleteProductHandler(event);
    }

    // Cleanup test categories
    for (const categoryId of testCategoryIds) {
      const event = createEvent({
        httpMethod: 'DELETE',
        path: `/v1/categories/${categoryId}`,
        pathParameters: { id: categoryId },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      await deleteCategoryHandler(event);
    }
  });
});
