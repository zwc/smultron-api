import { expect, test, describe, beforeAll } from 'bun:test';
import { handler as loginHandler } from '../src/handlers/login';
import { handler as listProductsHandler } from '../src/handlers/list.products';
import { handler as getProductHandler } from '../src/handlers/get.product';
import { handler as createProductHandler } from '../src/handlers/create.product';
import { handler as updateProductHandler } from '../src/handlers/update.product';
import { handler as deleteProductHandler } from '../src/handlers/delete.product';
import { handler as listCategoriesHandler } from '../src/handlers/admin.list.categories';
import { handler as getCategoryHandler } from '../src/handlers/get.category';
import { handler as createCategoryHandler } from '../src/handlers/create.category';
import { handler as updateCategoryHandler } from '../src/handlers/update.category';
import { handler as deleteCategoryHandler } from '../src/handlers/delete.category';
import { handler as createOrderHandler } from '../src/handlers/create.order';
import { handler as listOrdersHandler } from '../src/handlers/list.orders';
import { handler as getOrderHandler } from '../src/handlers/get.order';
import { handler as updateOrderStatusHandler } from '../src/handlers/update.order.status';
import { handler as listCatalogHandler } from '../src/handlers/list.catalog';
import { handler as adminListProductsHandler } from '../src/handlers/admin.list.products';

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

console.log(`Running local integration tests against dev resources:`);
console.log(`  PRODUCTS_TABLE: ${process.env.PRODUCTS_TABLE}`);
console.log(`  CATEGORIES_TABLE: ${process.env.CATEGORIES_TABLE}`);
console.log(`  ORDERS_TABLE: ${process.env.ORDERS_TABLE}`);

let authToken: string;
let testCategoryId: string;
let testProductId: string;
let testProductId2: string;
let testOrderId: string;

// Helper to create mock API Gateway event
function createEvent(options: {
  httpMethod: string;
  path: string;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  body?: any;
  headers?: Record<string, string>;
}): any {
  return {
    httpMethod: options.httpMethod,
    path: options.path,
    pathParameters: options.pathParameters || null,
    queryStringParameters: options.queryStringParameters || null,
    body: options.body ? JSON.stringify(options.body) : null,
    headers: options.headers || {},
    requestContext: {
      requestId: 'test-request-id',
      domainName: 'localhost',
      path: options.path,
    },
    isBase64Encoded: false,
  };
}

describe('Local Integration Tests - Auth', () => {
  test('should login with valid credentials', async () => {
    const event = createEvent({
      httpMethod: 'POST',
  path: '/v1/admin/login',
      body: {
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
      },
    });

    const response = await loginHandler(event);
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.token).toBeDefined();
    authToken = data.token;
  });

  test('should reject invalid credentials', async () => {
    const event = createEvent({
      httpMethod: 'POST',
  path: '/v1/admin/login',
      body: {
        username: 'wrong',
        password: 'wrong',
      },
    });

    const response = await loginHandler(event);
    expect(response.statusCode).toBe(401);
  });
});

describe('Local Integration Tests - Categories', () => {
  test('should create a category', async () => {
    const event = createEvent({
      httpMethod: 'POST',
      path: '/v1/categories',
      body: {
        brand: 'Test Brand',
        title: 'Test Category',
        subtitle: 'Local Test',
        index: 99,
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await createCategoryHandler(event);
    
    expect(response.statusCode).toBe(201);
    const data = JSON.parse(response.body);
    expect(data.id).toBeDefined();
    testCategoryId = data.id;
  });

  test('should list categories', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/categories',
    });

    const response = await listCategoriesHandler(event);
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(Array.isArray(data)).toBe(true);
  });

  test('should get category by id', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: `/v1/categories/${testCategoryId}`,
      pathParameters: { id: testCategoryId },
    });

    const response = await getCategoryHandler(event);
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.id).toBe(testCategoryId);
  });

  test('should update category', async () => {
    const event = createEvent({
      httpMethod: 'PUT',
      path: `/v1/categories/${testCategoryId}`,
      pathParameters: { id: testCategoryId },
      body: {
        subtitle: 'Updated subtitle',
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await updateCategoryHandler(event);
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.subtitle).toBe('Updated subtitle');
  });
});

describe('Local Integration Tests - Products', () => {
  test('should create a product', async () => {
    const event = createEvent({
      httpMethod: 'POST',
      path: '/v1/products',
      body: {
        categorySlug: testCategoryId,
        article: 'TEST001',
        brand: 'Test Brand',
        title: 'Test Product',
        subtitle: 'Local Test',
        price: 99.99,
        price_reduced: 0,
        description: ['Test description'],
        tag: 'test',
        index: 1,
        stock: 10,
        max_order: 5,
        image: '/test.jpg',
        images: ['/test.jpg'],
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await createProductHandler(event);
    
    expect(response.statusCode).toBe(201);
    const data = JSON.parse(response.body);
    expect(data.id).toBeDefined();
    expect(data.status).toBe('active');
    expect(data.createdAt).toBeDefined();
    testProductId = data.id;
  });

  test('should create a second product', async () => {
    const event = createEvent({
      httpMethod: 'POST',
      path: '/v1/products',
      body: {
        categorySlug: testCategoryId,
        article: 'TEST002',
        brand: 'Test Brand',
        title: 'Test Product 2',
        subtitle: 'Local Test',
        price: 149.99,
        price_reduced: 0,
        description: ['Test description 2'],
        tag: 'test',
        index: 2,
        stock: 5,
        max_order: 3,
        image: '/test2.jpg',
        images: ['/test2.jpg'],
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await createProductHandler(event);
    
    expect(response.statusCode).toBe(201);
    const data = JSON.parse(response.body);
    testProductId2 = data.id;
  });

  test('should list only active products (public)', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/products',
    });

    const response = await listProductsHandler(event);
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(Array.isArray(data)).toBe(true);
    // All products should have status 'active'
    data.forEach((p: any) => expect(p.status).toBe('active'));
  });

  test('should get product by id', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: `/v1/products/${testProductId}`,
      pathParameters: { id: testProductId },
    });

    const response = await getProductHandler(event);
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.id).toBe(testProductId);
  });

  test('should update product', async () => {
    const event = createEvent({
      httpMethod: 'PUT',
      path: `/v1/products/${testProductId}`,
      pathParameters: { id: testProductId },
      body: {
        price: 89.99,
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await updateProductHandler(event);
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.price).toBe(89.99);
    expect(data.updatedAt).toBeDefined();
  });
});

describe('Local Integration Tests - Orders', () => {
  test('should create an order', async () => {
    const event = createEvent({
      httpMethod: 'POST',
      path: '/v1/orders',
      body: {
        cart: [
          {
            id: testProductId,
            number: 2,
            price: 89.99,
          },
          {
            id: testProductId2,
            number: 1,
            price: 149.99,
          },
        ],
        order: {
          name: 'Local Test Customer',
          address: '123 Test Street',
          zip: '12345',
          city: 'Test City',
          phone: '+46701234567',
          email: 'localtest@example.com',
          delivery: 'standard',
          payment: 'card',
        },
      },
    });

    const response = await createOrderHandler(event);
    
    expect(response.statusCode).toBe(201);
    const data = JSON.parse(response.body);
    expect(data.id).toBeDefined();
    expect(data.status).toBe('pending');
    testOrderId = data.id;
  });

  test('should list orders (admin)', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/orders',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await listOrdersHandler(event);
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(Array.isArray(data)).toBe(true);
  });

  test('should get order by id', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: `/v1/orders/${testOrderId}`,
      pathParameters: { id: testOrderId },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await getOrderHandler(event);
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.id).toBe(testOrderId);
  });

  test('should update order status', async () => {
    const event = createEvent({
      httpMethod: 'PUT',
      path: `/v1/orders/${testOrderId}/status`,
      pathParameters: { id: testOrderId },
      body: {
        status: 'confirmed',
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await updateOrderStatusHandler(event);
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.status).toBe('confirmed');
  });
});

describe('Local Integration Tests - Catalog', () => {
  test('should get catalog', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/catalog',
    });

    const response = await listCatalogHandler(event);
    
    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.body);
    expect(data.categories).toBeDefined();
    expect(data.products).toBeDefined();
    expect(Array.isArray(data.categories)).toBe(true);
    expect(Array.isArray(data.products)).toBe(true);
  });
});

describe('Local Integration Tests - Admin Products', () => {
  test('should list products with filters', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/products',
      queryStringParameters: {
        limit: '10',
        offset: '0',
        sort: '-createdAt',
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await adminListProductsHandler(event);
    
    expect(typeof response).toBe('object');
    if (typeof response === 'object' && response !== null && 'statusCode' in response) {
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.data).toBeDefined();
      expect(data.meta).toBeDefined();
      expect(data.links).toBeDefined();
    }
  });

  test('should filter by status', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/products',
      queryStringParameters: {
        status: 'active',
      },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await adminListProductsHandler(event);
    
    expect(typeof response).toBe('object');
    if (typeof response === 'object' && response !== null && 'statusCode' in response) {
      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.meta.filters.status).toEqual(['active']);
    }
  });

  test('should reject without auth', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/v1/admin/products',
    });

    const response = await adminListProductsHandler(event);
    
    expect(typeof response).toBe('object');
    if (typeof response === 'object' && response !== null && 'statusCode' in response) {
      expect(response.statusCode).toBe(401);
    }
  });
});

describe('Local Integration Tests - Cleanup', () => {
  test('should delete test product 1', async () => {
    const event = createEvent({
      httpMethod: 'DELETE',
      path: `/v1/products/${testProductId}`,
      pathParameters: { id: testProductId },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await deleteProductHandler(event);
    
    expect([200, 204].includes(response.statusCode)).toBe(true);
  });

  test('should delete test product 2', async () => {
    const event = createEvent({
      httpMethod: 'DELETE',
      path: `/v1/products/${testProductId2}`,
      pathParameters: { id: testProductId2 },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await deleteProductHandler(event);
    
    expect([200, 204].includes(response.statusCode)).toBe(true);
  });

  test('should delete test category', async () => {
    const event = createEvent({
      httpMethod: 'DELETE',
      path: `/v1/categories/${testCategoryId}`,
      pathParameters: { id: testCategoryId },
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const response = await deleteCategoryHandler(event);
    
    expect([200, 204].includes(response.statusCode)).toBe(true);
  });
});
