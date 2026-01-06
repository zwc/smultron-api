import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { Product, Category } from '../src/types';

// Mock the product service before importing handler
const mockGetAllCategories = mock<(status?: 'active' | 'inactive') => Promise<Category[]>>(() => Promise.resolve([]));
const mockGetActiveProducts = mock<() => Promise<Product[]>>(() => Promise.resolve([]));

mock.module('../src/services/product', () => ({
  getAllCategories: mockGetAllCategories,
  getActiveProducts: mockGetActiveProducts,
}));

// Import handler after mocking
const { handler } = await import('../src/handlers/list.catalog');

// Helper to create mock API Gateway event
const createEvent = (overrides = {}) => ({
  body: null,
  headers: {},
  multiValueHeaders: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  path: '/v1/catalog',
  pathParameters: null,
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: '123456789012',
    apiId: 'test-api',
    protocol: 'HTTP/1.1',
    httpMethod: 'GET',
    path: '/v1/catalog',
    stage: 'test',
    requestId: 'test-request-id',
    requestTimeEpoch: Date.now(),
    identity: { sourceIp: '127.0.0.1', userAgent: 'test' },
    resourceId: 'test',
    resourcePath: '/catalog',
  },
  resource: '/catalog',
  ...overrides,
});

describe('List Catalog Handler', () => {
  // Sample mock data
  const mockCategories: Category[] = [
    {
      id: 'cat-uuid-1',
      slug: 'labubu',
      brand: 'Pop Mart',
      title: 'Labubu',
      subtitle: 'Cute monsters',
      index: 1,
      status: 'active',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'cat-uuid-2',
      slug: 'sonny-angel',
      brand: 'Dreams',
      title: 'Sonny Angel',
      subtitle: 'Little angels',
      index: 2,
      status: 'active',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
  ];

  const mockProducts: Product[] = [
    {
      id: 'prod-uuid-1',
      slug: 'labubu-monster',
      categorySlug: 'labubu',  // Stored as categorySlug in DB
      brand: 'Pop Mart',
      title: 'Labubu',
      subtitle: 'Monster Edition',
      price: 299,
      price_reduced: 0,
      description: ['A cute monster figure'],
      tag: 'new',
      index: 1,
      stock: 10,
      max_order: 5,
      image: '/images/labubu.jpg',
      images: ['/images/labubu.jpg'],
      status: 'active',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'prod-uuid-2',
      slug: 'sonny-angel-christmas',
      categorySlug: 'sonny-angel',  // Stored as categorySlug in DB
      brand: 'Dreams',
      title: 'Sonny Angel',
      subtitle: 'Christmas Edition',
      price: 199,
      stock: 5,
      status: 'active',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    mockGetAllCategories.mockReset();
    mockGetActiveProducts.mockReset();
  });

  test('should return catalog with products and categories', async () => {
    mockGetAllCategories.mockResolvedValue(mockCategories);
    mockGetActiveProducts.mockResolvedValue(mockProducts);

    const response = await handler(createEvent() as any);

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.data.products).toBeDefined();
    expect(body.data.categories).toBeDefined();
    expect(body.data.products.length).toBe(2);
    expect(body.data.categories.length).toBe(2);
  });

  test('should include id in categories', async () => {
    mockGetAllCategories.mockResolvedValue(mockCategories);
    mockGetActiveProducts.mockResolvedValue(mockProducts);

    const response = await handler(createEvent() as any);
    const body = JSON.parse(response.body);

    // Categories should have 'id' field
    for (const category of body.data.categories) {
      expect(category.id).toBeDefined();
      expect(category.slug).toBeDefined();
      expect(typeof category.slug).toBe('string');
    }

    // Verify specific ids and slugs are present
    const labubuCategory = body.data.categories.find((c: any) => c.slug === 'labubu');
    expect(labubuCategory).toBeDefined();
    expect(labubuCategory.id).toBe('cat-uuid-1');

    const sonnyCategory = body.data.categories.find((c: any) => c.slug === 'sonny-angel');
    expect(sonnyCategory).toBeDefined();
    expect(sonnyCategory.id).toBe('cat-uuid-2');
  });

  test('should include id in products', async () => {
    mockGetAllCategories.mockResolvedValue(mockCategories);
    mockGetActiveProducts.mockResolvedValue(mockProducts);

    const response = await handler(createEvent() as any);
    const body = JSON.parse(response.body);

    // Products should have 'id' field
    for (const product of body.data.products) {
      expect(product.id).toBeDefined();
      expect(product.slug).toBeDefined();
    }

    // Verify specific product ids
    const labubuProduct = body.data.products.find((p: any) => p.slug === 'labubu-monster');
    expect(labubuProduct.id).toBe('prod-uuid-1');

    const sonnyProduct = body.data.products.find((p: any) => p.slug === 'sonny-angel-christmas');
    expect(sonnyProduct.id).toBe('prod-uuid-2');
  });

  test('should include category slug and categoryId in products', async () => {
    mockGetAllCategories.mockResolvedValue(mockCategories);
    mockGetActiveProducts.mockResolvedValue(mockProducts);

    const response = await handler(createEvent() as any);
    const body = JSON.parse(response.body);

    // Product should have both category (slug) and categoryId
    const labubuProduct = body.data.products.find((p: any) => p.slug === 'labubu-monster');
    expect(labubuProduct).toBeDefined();
    expect(labubuProduct.category).toBe('labubu');
    expect(labubuProduct.categoryId).toBe('cat-uuid-1');

    const sonnyProduct = body.data.products.find((p: any) => p.slug === 'sonny-angel-christmas');
    expect(sonnyProduct).toBeDefined();
    expect(sonnyProduct.category).toBe('sonny-angel');
    expect(sonnyProduct.categoryId).toBe('cat-uuid-2');
  });

  test('should include meta with totals', async () => {
    mockGetAllCategories.mockResolvedValue(mockCategories);
    mockGetActiveProducts.mockResolvedValue(mockProducts);

    const response = await handler(createEvent() as any);
    const body = JSON.parse(response.body);

    expect(body.meta).toBeDefined();
    expect(body.meta.productsTotal).toBe(2);
    expect(body.meta.categoriesTotal).toBe(2);
  });

  test('should return empty arrays when no data', async () => {
    mockGetAllCategories.mockResolvedValue([]);
    mockGetActiveProducts.mockResolvedValue([]);

    const response = await handler(createEvent() as any);
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.data.products).toEqual([]);
    expect(body.data.categories).toEqual([]);
    expect(body.meta.productsTotal).toBe(0);
    expect(body.meta.categoriesTotal).toBe(0);
  });

  test('should return 500 on database error', async () => {
    mockGetAllCategories.mockRejectedValue(new Error('Database connection failed'));

    const response = await handler(createEvent() as any);

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBeDefined();
  });

  test('should include all expected product fields', async () => {
    mockGetAllCategories.mockResolvedValue(mockCategories);
    mockGetActiveProducts.mockResolvedValue(mockProducts);

    const response = await handler(createEvent() as any);
    const body = JSON.parse(response.body);

    const product = body.data.products[0];

    // Should have these public fields (including id)
    expect(product.id).toBeDefined();
    expect(product.slug).toBeDefined();
    expect(product.category).toBeDefined();
    expect(product.categoryId).toBeDefined();
    expect(product.brand).toBeDefined();
    expect(product.title).toBeDefined();
    expect(product.subtitle).toBeDefined();
    expect(product.price).toBeDefined();
    expect(product.stock).toBeDefined();
    expect(product.status).toBeDefined();
  });

  test('should include all expected category fields', async () => {
    mockGetAllCategories.mockResolvedValue(mockCategories);
    mockGetActiveProducts.mockResolvedValue(mockProducts);

    const response = await handler(createEvent() as any);
    const body = JSON.parse(response.body);

    const category = body.data.categories[0];

    // Should have these public fields (including id)
    expect(category.id).toBeDefined();
    expect(category.slug).toBeDefined();
    expect(category.brand).toBeDefined();
    expect(category.title).toBeDefined();
    expect(category.subtitle).toBeDefined();
    expect(category.index).toBeDefined();
    expect(category.status).toBeDefined();
  });
});
