import type { Product, Category, Order } from '../types';
import * as db from './dynamodb';

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE || 'smultron-products';
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE || 'smultron-categories';
const ORDERS_TABLE = process.env.ORDERS_TABLE || 'smultron-orders';

export const createProduct = (data: Omit<Product, 'id'>): Product => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return {
    id: `${data.category}-${data.title.toLowerCase().replace(/\s+/g, '-')}-${timestamp}-${random}`,
    ...data,
  };
};

export const saveProduct = async (product: Product): Promise<void> => {
  await db.putItem(PRODUCTS_TABLE, product);
};

export const getProduct = async (id: string): Promise<Product | null> => {
  return await db.getItem<Product>(PRODUCTS_TABLE, { id });
};

export const getAllProducts = async (): Promise<Product[]> => {
  return await db.scanTable<Product>(PRODUCTS_TABLE);
};

export const updateProduct = async (
  id: string,
  updates: Partial<Omit<Product, 'id'>>
): Promise<Product> => {
  const updateParts: string[] = [];
  const attributeValues: Record<string, any> = {};
  const attributeNames: Record<string, string> = {};

  Object.entries(updates).forEach(([key, value], index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateParts.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = value;
  });

  const updateExpression = `SET ${updateParts.join(', ')}`;

  return await db.updateItem<Product>(
    PRODUCTS_TABLE,
    { id },
    updateExpression,
    attributeValues,
    attributeNames
  );
};

export const deleteProduct = async (id: string): Promise<void> => {
  await db.deleteItem(PRODUCTS_TABLE, { id });
};

export const createCategory = (data: Omit<Category, 'id'>): Category => {
  return {
    id: data.title.toLowerCase().replace(/\s+/g, '-'),
    ...data,
  };
};

export const saveCategory = async (category: Category): Promise<void> => {
  await db.putItem(CATEGORIES_TABLE, category);
};

export const getCategory = async (id: string): Promise<Category | null> => {
  return await db.getItem<Category>(CATEGORIES_TABLE, { id });
};

export const getAllCategories = async (): Promise<Category[]> => {
  return await db.scanTable<Category>(CATEGORIES_TABLE);
};

export const updateCategory = async (
  id: string,
  updates: Partial<Omit<Category, 'id'>>
): Promise<Category> => {
  const updateParts: string[] = [];
  const attributeValues: Record<string, any> = {};
  const attributeNames: Record<string, string> = {};

  Object.entries(updates).forEach(([key, value], index) => {
    const attrName = `#attr${index}`;
    const attrValue = `:val${index}`;
    updateParts.push(`${attrName} = ${attrValue}`);
    attributeNames[attrName] = key;
    attributeValues[attrValue] = value;
  });

  const updateExpression = `SET ${updateParts.join(', ')}`;

  return await db.updateItem<Category>(
    CATEGORIES_TABLE,
    { id },
    updateExpression,
    attributeValues,
    attributeNames
  );
};

export const deleteCategory = async (id: string): Promise<void> => {
  await db.deleteItem(CATEGORIES_TABLE, { id });
};

export const createOrder = (data: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Order => {
  const now = new Date().toISOString();
  return {
    id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ...data,
    createdAt: now,
    updatedAt: now,
  };
};

export const saveOrder = async (order: Order): Promise<void> => {
  await db.putItem(ORDERS_TABLE, order);
};

export const getOrder = async (id: string): Promise<Order | null> => {
  return await db.getItem<Order>(ORDERS_TABLE, { id });
};

export const getAllOrders = async (): Promise<Order[]> => {
  return await db.scanTable<Order>(ORDERS_TABLE);
};

export const updateOrderStatus = async (
  id: string,
  status: Order['status']
): Promise<Order> => {
  return await db.updateItem<Order>(
    ORDERS_TABLE,
    { id },
    'SET #status = :status, #updatedAt = :updatedAt',
    {
      ':status': status,
      ':updatedAt': new Date().toISOString(),
    },
    {
      '#status': 'status',
      '#updatedAt': 'updatedAt',
    }
  );
};
