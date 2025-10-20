import { expect, test, describe, beforeAll, afterAll } from 'bun:test';
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

describe('Get Product Public Endpoint Tests', () => {
  let authToken: string;
  let testProductId: string;
  let testCategoryId1: string;
  let testCategoryId2: string;

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

    // Create test categories
    const category1Event = createEvent({
      httpMethod: 'POST',
      path: '/v1/categories',
      body: JSON.stringify({
        id: 'test-labubu',
        brand: 'Pop Mart',
        title: 'Labubu',
        subtitle: 'Cute collectibles',
        index: 1,
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const category1Response = await createCategoryHandler(category1Event);
    const category1Data = JSON.parse(category1Response.body);
    testCategoryId1 = category1Data.id;

    const category2Event = createEvent({
      httpMethod: 'POST',
      path: '/v1/categories',
      body: JSON.stringify({
        id: 'test-sonny-angel',
        brand: 'Dreams Inc.',
        title: 'Sonny Angel',
        subtitle: 'Angel collectibles',
        index: 2,
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const category2Response = await createCategoryHandler(category2Event);
    const category2Data = JSON.parse(category2Response.body);
    testCategoryId2 = category2Data.id;

    // Create a test product
    const productEvent = createEvent({
      httpMethod: 'POST',
      path: '/v1/products',
      body: JSON.stringify({
        category: testCategoryId1,
        article: 'TEST-BIG-ENERGY',
        brand: 'Pop mart',
        title: 'Labubu',
        subtitle: 'Big into energy',
        price: 599,
        price_reduced: 499,
        description: [
          'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
          'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
          'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
        ],
        tag: 'test',
        index: 1,
        stock: 3,
        max_order: 2,
        image: 'http://web.vh.se/smultronet/graphics/temp/sonny-angel-rainy-day.jpg',
        images: [
          'http://web.vh.se/smultronet/graphics/temp/sonny-angel-rainy-day.jpg',
          'http://web.vh.se/smultronet/graphics/temp/labubu-big-into-energy-1.jpg'
        ],
        status: 'active',
      }),
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const productResponse = await createProductHandler(productEvent);
    const productData = JSON.parse(productResponse.body);
    testProductId = productData.id;
  });

  test('should get product with categories', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: `/v1/admin/products/${testProductId}`,
      pathParameters: { id: testProductId },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await getProductPublicHandler(event);
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    
    // Verify response structure matches expected format
    expect(data.categories).toBeDefined();
    expect(Array.isArray(data.categories)).toBe(true);
    expect(data.categories.length).toBeGreaterThanOrEqual(2);
    
    // Verify categories have correct structure
    data.categories.forEach((cat: any) => {
      expect(cat.title).toBeDefined();
      expect(cat.id).toBeDefined();
    });
    
    // Verify product fields
    expect(data.status).toBe('active');
    expect(data.id).toBe(testProductId);
    expect(data.category).toBe(testCategoryId1);
    expect(data.title).toBe('Labubu');
    expect(data.subtitle).toBe('Big into energy');
    expect(data.brand).toBe('Pop mart');
    expect(data.price).toBe(599);
    expect(data.stock).toBe(3);
    expect(Array.isArray(data.description)).toBe(true);
    expect(data.description.length).toBe(4);
    expect(data.image).toBe('http://web.vh.se/smultronet/graphics/temp/sonny-angel-rainy-day.jpg');
    expect(Array.isArray(data.images)).toBe(true);
    expect(data.images.length).toBe(2);
    
    console.log('Product response:', JSON.stringify(data, null, 2));
  });

  test('should return 404 for non-existent product', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/products/non-existent-id',
      pathParameters: { id: 'non-existent-id' },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await getProductPublicHandler(event);
    
    expect(response.statusCode).toBe(404);
  });

  test('should return 400 when product ID is missing', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/products/',
      pathParameters: null,
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await getProductPublicHandler(event);
    
    expect(response.statusCode).toBe(400);
  });

  test('should return 401 without authentication', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: `/v1/admin/products/${testProductId}`,
      pathParameters: { id: testProductId },
    });

    const response = await getProductPublicHandler(event);
    
    expect(response.statusCode).toBe(401);
  });

  afterAll(async () => {
    // Cleanup test data
    if (testProductId) {
      const deleteProductEvent = createEvent({
        httpMethod: 'DELETE',
        path: `/v1/products/${testProductId}`,
        pathParameters: { id: testProductId },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      await deleteProductHandler(deleteProductEvent);
    }

    if (testCategoryId1) {
      const deleteCategoryEvent = createEvent({
        httpMethod: 'DELETE',
        path: `/v1/categories/${testCategoryId1}`,
        pathParameters: { id: testCategoryId1 },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      await deleteCategoryHandler(deleteCategoryEvent);
    }

    if (testCategoryId2) {
      const deleteCategoryEvent = createEvent({
        httpMethod: 'DELETE',
        path: `/v1/categories/${testCategoryId2}`,
        pathParameters: { id: testCategoryId2 },
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      await deleteCategoryHandler(deleteCategoryEvent);
    }
  });
});
