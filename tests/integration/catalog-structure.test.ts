import { expect, test, describe } from 'bun:test';
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

describe('Catalog Endpoint Structure Tests', () => {
  test('catalog returns structured data with data/meta wrappers', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/catalog',
    });

    const response = await listCatalogHandler(event);
    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    
    // Verify categories structure
    expect(body.categories).toBeDefined();
    expect(body.categories.data).toBeDefined();
    expect(body.categories.meta).toBeDefined();
    expect(Array.isArray(body.categories.data)).toBe(true);
    expect(typeof body.categories.meta.total).toBe('number');
    
    // Verify products structure
    expect(body.products).toBeDefined();
    expect(body.products.data).toBeDefined();
    expect(body.products.meta).toBeDefined();
    expect(Array.isArray(body.products.data)).toBe(true);
    expect(typeof body.products.meta.total).toBe('number');
    
    console.log('Catalog response structure:', {
      categories: {
        count: body.categories.data.length,
        total: body.categories.meta.total,
      },
      products: {
        count: body.products.data.length,
        total: body.products.meta.total,
      },
    });
    
    // Verify data counts match meta totals
    expect(body.categories.data.length).toBe(body.categories.meta.total);
    expect(body.products.data.length).toBe(body.products.meta.total);
    
    // Verify all categories have required fields
    body.categories.data.forEach((cat: any) => {
      expect(cat.id).toBeDefined();
      expect(cat.title).toBeDefined();
      expect(cat.brand).toBeDefined();
      expect(cat.status).toBe('active'); // Public catalog should only show active
    });
    
    // Verify all products have required fields
    body.products.data.forEach((product: any) => {
      expect(product.id).toBeDefined();
      expect(product.title).toBeDefined();
      expect(product.brand).toBeDefined();
      expect(product.status).toBe('active'); // Public catalog should only show active
    });
  });
});
