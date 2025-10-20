import { expect, test, describe, beforeAll } from 'bun:test';
import { handler as adminListProductsHandler } from '../src/handlers/admin.list.products';
import { handler as listProductsHandler } from '../src/handlers/list.products';
import { handler as listCatalogHandler } from '../src/handlers/list.catalog';
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
  body: overrides.body ? JSON.stringify(overrides.body) : null,
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

describe('Alphabetical Sorting Tests', () => {
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
    authToken = loginData.token;
  });

  test('should create test products with names for sorting', async () => {
    const testProducts = [
      { title: 'Zebra Product', brand: 'Test Brand' },
      { title: 'Apple Product', brand: 'Test Brand' },
      { title: 'Mountain Product', brand: 'Test Brand' },
      { title: 'Ball Product', brand: 'Test Brand' },
    ];

    for (const product of testProducts) {
      const event = createEvent({
        httpMethod: 'POST',
        path: '/v1/products',
        body: JSON.stringify({
          category: 'test-category',
          article: `TEST-${Date.now()}-${Math.random()}`,
          brand: product.brand,
          title: product.title,
          subtitle: 'Test product for sorting',
          price: 99.99,
          price_reduced: 79.99,
          description: ['Test feature'],
          tag: 'test',
          index: 1,
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

  test('should return products sorted alphabetically by title (public endpoint)', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/products',
    });

    const response = await listProductsHandler(event);
    expect(response.statusCode).toBe(200);
    
    const products = JSON.parse(response.body);
    expect(Array.isArray(products)).toBe(true);
    
    // Filter to our test products only
    const testProducts = products.filter((p: any) => testProductIds.includes(p.id));
    
    // Verify they are sorted alphabetically
    const titles = testProducts.map((p: any) => p.title);
    const sortedTitles = [...titles].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    expect(titles).toEqual(sortedTitles);
    console.log('Public products titles in order:', titles);
  });

  test('should return products sorted alphabetically by title (catalog endpoint)', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/catalog',
    });

    const response = await listCatalogHandler(event);
    expect(response.statusCode).toBe(200);
    
    const catalog = JSON.parse(response.body);
    expect(catalog.products).toBeDefined();
    expect(catalog.categories).toBeDefined();
    
    // Filter to our test products only
    const testProducts = catalog.products.filter((p: any) => testProductIds.includes(p.id));
    
    // Verify they are sorted alphabetically
    const titles = testProducts.map((p: any) => p.title);
    const sortedTitles = [...titles].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    expect(titles).toEqual(sortedTitles);
    console.log('Catalog products titles in order:', titles);
  });

  test('should support title sorting in admin endpoint', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/products',
      queryStringParameters: {
        sort: 'title',
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
    
    // Verify they are sorted alphabetically (ascending)
    const titles = testProducts.map((p: any) => p.title);
    const sortedTitles = [...titles].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    
    expect(titles).toEqual(sortedTitles);
    console.log('Admin products titles in ascending order:', titles);
  });

  test('should support reverse title sorting in admin endpoint', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/products',
      queryStringParameters: {
        sort: '-title',
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
    
    // Verify they are sorted alphabetically (descending)
    const titles = testProducts.map((p: any) => p.title);
    const sortedTitles = [...titles].sort((a, b) => b.toLowerCase().localeCompare(a.toLowerCase()));
    
    expect(titles).toEqual(sortedTitles);
    console.log('Admin products titles in descending order:', titles);
  });

  // Cleanup
  test('should cleanup test products', async () => {
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