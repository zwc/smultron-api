import { expect, test, describe, beforeAll, afterAll } from 'bun:test';
import { handler as adminListProductsHandler } from '../src/handlers/admin.list.products';
import { handler as createProductHandler } from '../src/handlers/create.product';
import { handler as deleteProductHandler } from '../src/handlers/delete.product';
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

describe('Admin Products Index Sorting Tests', () => {
  let authToken: string;
  let testProductIds: string[] = [];

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

    // Create test products with specific index values
    const testProducts = [
      { title: 'Product C', index: 30 },
      { title: 'Product A', index: 10 },
      { title: 'Product D', index: 40 },
      { title: 'Product B', index: 20 },
    ];

    for (const product of testProducts) {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/v1/products',
        body: JSON.stringify({
          categorySlug: 'test-category',
          article: `TEST-INDEX-${Date.now()}-${Math.random()}`,
          brand: 'Test Brand',
          title: product.title,
          subtitle: 'Test product for index sorting',
          price: 99.99,
          price_reduced: 79.99,
          description: ['Test feature'],
          tag: 'test',
          index: product.index,
          stock: 10,
          max_order: 5,
          image: 'https://example.com/image.jpg',
          images: ['https://example.com/image1.jpg'],
        }),
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const response = await createProductHandler(event);
      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      testProductIds.push(data.id);
    }
  });

  test('should sort products by index (ascending)', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/products',
      queryStringParameters: {
        sort: 'index',
        limit: '20',
        offset: '0',
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await adminListProductsHandler(event);
    expect(response.statusCode).toBe(200);
    
    const data = JSON.parse(response.body);
    expect(data.data).toBeDefined();
    
    // Filter to our test products only
    const testProducts = data.data.filter((p: any) => testProductIds.includes(p.id));
    
    // Verify they are sorted by index (ascending: 10, 20, 30, 40)
    const indices = testProducts.map((p: any) => p.index);
    expect(indices).toEqual([10, 20, 30, 40]);
    
    const titles = testProducts.map((p: any) => p.title);
    console.log('Products sorted by index (ascending):', titles);
    console.log('Indices:', indices);
  });

  test('should sort products by index (descending)', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/products',
      queryStringParameters: {
        sort: '-index',
        limit: '20',
        offset: '0',
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await adminListProductsHandler(event);
    expect(response.statusCode).toBe(200);
    
    const data = JSON.parse(response.body);
    expect(data.data).toBeDefined();
    
    // Filter to our test products only
    const testProducts = data.data.filter((p: any) => testProductIds.includes(p.id));
    
    // Verify they are sorted by index (descending: 40, 30, 20, 10)
    const indices = testProducts.map((p: any) => p.index);
    expect(indices).toEqual([40, 30, 20, 10]);
    
    const titles = testProducts.map((p: any) => p.title);
    console.log('Products sorted by index (descending):', titles);
    console.log('Indices:', indices);
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

      const response = await deleteProductHandler(event);
      expect([200, 204].includes(response.statusCode)).toBe(true);
    }
  });
});
