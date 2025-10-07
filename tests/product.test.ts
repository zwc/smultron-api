import { describe, test, expect } from 'bun:test';
import type { Product } from '../src/types';

describe('Product Service', () => {
  const mockProduct: Omit<Product, 'id'> = {
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
    max_order: 0,
    image: '/test.jpg',
    images: ['/test.jpg']
  };

  test('should create a product with generated ID', () => {
    const { createProduct } = require('../src/services/product');
    const product = createProduct(mockProduct);

    expect(product.id).toBeDefined();
    expect(product.category).toBe(mockProduct.category);
    expect(product.brand).toBe(mockProduct.brand);
    expect(product.title).toBe(mockProduct.title);
    expect(product.price).toBe(mockProduct.price);
    expect(product.stock).toBe(mockProduct.stock);
  });

  test('should generate unique IDs for different products', () => {
    const { createProduct } = require('../src/services/product');
    const product1 = createProduct(mockProduct);
    const product2 = createProduct(mockProduct);

    expect(product1.id).not.toBe(product2.id);
  });
});
