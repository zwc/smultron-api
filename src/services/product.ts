import type { Product, Category, Order } from '../types';
import * as db from './dynamodb';

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE || 'smultron-products';
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE || 'smultron-categories';
const ORDERS_TABLE = process.env.ORDERS_TABLE || 'smultron-orders';

export const createProduct = (data: Omit<Product, 'id' | 'slug' | 'createdAt' | 'updatedAt' | 'status'> & { status?: 'active' | 'inactive' }): Product => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const now = new Date().toISOString();
  const slug = `${data.category}-${data.title.toLowerCase().replace(/\s+/g, '-')}`;
  return {
    id: `${slug}-${timestamp}-${random}`,
    slug,
    ...data,
    status: data.status || 'active',
    createdAt: now,
    updatedAt: now,
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

export const getActiveProducts = async (): Promise<Product[]> => {
  let products: Product[];
  
  try {
    // Try to use GSI for better performance
    products = await db.queryItems<Product>(
      PRODUCTS_TABLE,
      'StatusIndex',
      '#status = :status',
      { ':status': 'active' },
      { '#status': 'status' }
    );
  } catch (error) {
    // Fall back to scanning all products if GSI is not available
    console.warn('StatusIndex GSI not available, falling back to table scan');
    const allProducts = await getAllProducts();
    products = allProducts.filter(p => p.status === 'active');
  }
  
  // Sort products alphabetically by title
  return products.sort((a, b) => {
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();
    if (aTitle < bTitle) return -1;
    if (aTitle > bTitle) return 1;
    return 0;
  });
};

export const updateProduct = async (
  id: string,
  updates: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Product> => {
  const updateParts: string[] = [];
  const attributeValues: Record<string, any> = {};
  const attributeNames: Record<string, string> = {};

  // Add updatedAt timestamp
  const now = new Date().toISOString();
  const allUpdates = { ...updates, updatedAt: now };

  Object.entries(allUpdates).forEach(([key, value], index) => {
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

export const updateProductIndex = async (id: string, index: number): Promise<void> => {
  const now = new Date().toISOString();
  await db.updateItem(
    PRODUCTS_TABLE,
    { id },
    'SET #index = :index, #updatedAt = :updatedAt',
    {
      ':index': index,
      ':updatedAt': now,
    },
    {
      '#index': 'index',
      '#updatedAt': 'updatedAt',
    }
  );
};

export const deleteProduct = async (id: string): Promise<void> => {
  await db.deleteItem(PRODUCTS_TABLE, { id });
};

export const createCategory = (data: Omit<Category, 'id' | 'slug'>): Category => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const slug = data.title.toLowerCase().replace(/\s+/g, '-');
  return {
    id: `${slug}-${timestamp}-${random}`,
    slug,
    ...data,
  };
};

export const saveCategory = async (category: Category): Promise<void> => {
  await db.putItem(CATEGORIES_TABLE, category);
};

export const getCategory = async (id: string): Promise<Category | null> => {
  return await db.getItem<Category>(CATEGORIES_TABLE, { id });
};

export const getAllCategories = async (status?: 'active' | 'inactive'): Promise<Category[]> => {
  let categories: Category[];

  if (status) {
    // Query using StatusIndex GSI for better performance
    try {
      categories = await db.queryItems<Category>(
        CATEGORIES_TABLE,
        'StatusIndex',
        '#status = :status',
        { ':status': status },
        { '#status': 'status' }
      );
    } catch (error) {
      // Fallback to scan if GSI is not yet available (during deployment)
      console.warn('StatusIndex not available, falling back to scan', error);
      const allCategories = await db.scanTable<Category>(CATEGORIES_TABLE);
      categories = allCategories.filter(c => c.status === status);
    }
  } else {
    // Get all categories (for admin without filter)
    categories = await db.scanTable<Category>(CATEGORIES_TABLE);
  }
  
  // Sort categories alphabetically by title
  return categories.sort((a, b) => {
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();
    if (aTitle < bTitle) return -1;
    if (aTitle > bTitle) return 1;
    return 0;
  });
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

export const updateCategoryIndex = async (id: string, index: number): Promise<void> => {
  await db.updateItem(
    CATEGORIES_TABLE,
    { id },
    'SET #index = :index',
    {
      ':index': index,
    },
    {
      '#index': 'index',
    }
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

export const adminGetProducts = async (options: {
  status?: 'active' | 'inactive';
  searchQuery?: string;
  sortField: string;
  limit: number;
  offset: number;
}): Promise<{ items: Product[]; total: number }> => {
  let products: Product[];

  try {
    // If filtering by status, use GSI for efficient query
    if (options.status) {
      products = await db.queryItems<Product>(
        PRODUCTS_TABLE,
        'StatusIndex',
        '#status = :status',
        { ':status': options.status },
        { '#status': 'status' }
      );
    } else {
      // No status filter: get all products
      products = await getAllProducts();
    }
  } catch (error) {
    // Fall back to scanning all products if GSI is not available
    console.warn('StatusIndex GSI not available, falling back to table scan with filtering');
    const allProducts = await getAllProducts();
    
    if (options.status) {
      products = allProducts.filter(p => p.status === options.status);
    } else {
      products = allProducts;
    }
  }

  // Apply search query (search in title, subtitle, brand, description)
  if (options.searchQuery) {
    const query = options.searchQuery.toLowerCase();
    products = products.filter(p => 
      p.title.toLowerCase().includes(query) ||
      p.subtitle.toLowerCase().includes(query) ||
      p.brand.toLowerCase().includes(query) ||
      p.description.some(d => d.toLowerCase().includes(query))
    );
  }

  // Sort products
  const sortField = options.sortField.startsWith('-') 
    ? options.sortField.substring(1) 
    : options.sortField;
  const sortDirection = options.sortField.startsWith('-') ? -1 : 1;

  products.sort((a, b) => {
    let aVal: any, bVal: any;
    
    if (sortField === 'createdAt' || sortField === 'updatedAt') {
      aVal = a[sortField];
      bVal = b[sortField];
    } else if (sortField === 'title') {
      aVal = a.title.toLowerCase();
      bVal = b.title.toLowerCase();
    } else if (sortField === 'index') {
      aVal = a.index;
      bVal = b.index;
    } else {
      aVal = a.id;
      bVal = b.id;
    }

    if (aVal < bVal) return -1 * sortDirection;
    if (aVal > bVal) return 1 * sortDirection;
    return 0;
  });

  const total = products.length;
  const items = products.slice(options.offset, options.offset + options.limit);

  return { items, total };
};
