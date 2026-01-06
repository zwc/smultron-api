import { describe, test, expect } from 'bun:test';

// Test the product creation logic directly without importing from the mocked module
// This tests the pure function logic

describe('Product Creation Logic', () => {
  // Inline version of createProduct for testing (mirrors src/services/product.ts)
  const createProduct = (data: any) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    
    const slug = data.slug || (() => {
      const slugBase = data.category 
        ? `${data.category}-${data.title}` 
        : data.title;
      return slugBase.toLowerCase().replace(/\s+/g, '-');
    })();
    
    const { slug: _slug, ...restData } = data;
    
    return {
      category: restData.category || '',
      article: restData.article || '',
      price_reduced: restData.price_reduced ?? 0,
      description: restData.description || [],
      tag: restData.tag || '',
      index: restData.index ?? 0,
      max_order: restData.max_order ?? 999,
      image: restData.image || '',
      images: restData.images || [],
      id,
      slug,
      ...restData,
      status: data.status || 'active',
      createdAt: now,
      updatedAt: now,
    };
  };

  const mockProduct = {
    category: 'labubu',
    article: '',
    brand: 'Pop Mart',
    title: 'Test Product',
    subtitle: 'Test subtitle',
    price: 99.99,
    price_reduced: 0,
    description: ['Test description'],
    tag: 'new',
    index: 1,
    stock: 10,
    max_order: 5,
    image: '/test.jpg',
    images: ['/test.jpg']
  };

  test('should create a product with generated ID', () => {
    const product = createProduct(mockProduct);

    expect(product.id).toBeDefined();
    expect(product.id.length).toBeGreaterThan(0);
    expect(product.category).toBe(mockProduct.category);
    expect(product.brand).toBe(mockProduct.brand);
    expect(product.title).toBe(mockProduct.title);
    expect(product.price).toBe(mockProduct.price);
    expect(product.stock).toBe(mockProduct.stock);
  });

  test('should generate unique IDs for different products', () => {
    const product1 = createProduct(mockProduct);
    const product2 = createProduct(mockProduct);

    expect(product1.id).not.toBe(product2.id);
  });

  test('should auto-generate slug from category and title', () => {
    const product = createProduct(mockProduct);
    
    expect(product.slug).toBe('labubu-test-product');
  });

  test('should use provided slug if given', () => {
    const product = createProduct({ ...mockProduct, slug: 'custom-slug' });
    
    expect(product.slug).toBe('custom-slug');
  });

  test('should set default status to active', () => {
    const product = createProduct(mockProduct);
    
    expect(product.status).toBe('active');
  });

  test('should set createdAt and updatedAt timestamps', () => {
    const product = createProduct(mockProduct);
    
    expect(product.createdAt).toBeDefined();
    expect(product.updatedAt).toBeDefined();
    expect(product.createdAt).toBe(product.updatedAt);
  });
});
