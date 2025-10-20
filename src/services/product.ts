import type { Product, Category, Order, OrderInformation, OrderCartItem } from '../types';
import * as db from './dynamodb';

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE || 'smultron-products';
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE || 'smultron-categories';
const ORDERS_TABLE = process.env.ORDERS_TABLE || 'smultron-orders';

export const createProduct = (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { slug?: string; status?: 'active' | 'inactive' }): Product => {
  const now = new Date().toISOString();
  
  // Generate GUID for id
  const id = crypto.randomUUID();
  
  // Use provided slug or auto-generate from category and title
  const slug = data.slug || (() => {
    const slugBase = data.category 
      ? `${data.category}-${data.title}` 
      : data.title;
    return slugBase.toLowerCase().replace(/\s+/g, '-');
  })();
  
  // Remove slug from data to avoid duplication
  const { slug: _slug, ...restData } = data;
  
  return {
    // Default values for optional fields
    category: restData.category || '',
    article: restData.article || '',
    price_reduced: restData.price_reduced ?? 0,
    description: restData.description || [],
    tag: restData.tag || '',
    index: restData.index ?? 0,
    max_order: restData.max_order ?? 999,
    image: restData.image || '',
    images: restData.images || [],
    // Required and computed fields
    id,
    slug,
    ...restData,
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

export const createCategory = (data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Category => {
  // Generate GUID for id
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  return {
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
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
  updates: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Category> => {
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

// Order functions
export const saveOrder = async (order: Order): Promise<void> => {
  await db.putItem(ORDERS_TABLE, order);
};

export const getOrder = async (id: string): Promise<Order | null> => {
  return await db.getItem<Order>(ORDERS_TABLE, { id });
};

export const getAllOrders = async (status?: 'active' | 'inactive' | 'invalid'): Promise<Order[]> => {
  if (status) {
    try {
      // Use GSI for efficient query when filtering by status
      return await db.queryItems<Order>(
        ORDERS_TABLE,
        'StatusIndex',
        '#status = :status',
        { ':status': status },
        { '#status': 'status' }
      );
    } catch (error) {
      // Fall back to scanning and filtering if GSI is not available
      console.warn('StatusIndex GSI not available for orders, falling back to table scan with filtering');
      const allOrders = await db.scanTable<Order>(ORDERS_TABLE);
      return allOrders.filter(order => order.status === status);
    }
  }
  // No status filter: get all orders via table scan
  return await db.scanTable<Order>(ORDERS_TABLE);
};

// Generate order number in format YYMM.XXX
const generateOrderNumber = async (): Promise<string> => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month with leading zero
  const prefix = `${year}${month}`;
  
  console.log('Getting all orders to generate number with prefix:', prefix);
  
  // Get all orders for the current month
  const allOrders = await getAllOrders();
  console.log('Total orders in database:', allOrders.length);
  
  const monthOrders = allOrders.filter(order => order.number?.startsWith(prefix));
  console.log('Orders this month:', monthOrders.length);
  
  // Find the highest number for this month
  let maxNumber = 0;
  for (const order of monthOrders) {
    const parts = order.number.split('.');
    if (parts.length === 2 && parts[1]) {
      const num = parseInt(parts[1], 10);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  }
  
  // Increment and format
  const nextNumber = (maxNumber + 1).toString().padStart(3, '0');
  const orderNumber = `${prefix}.${nextNumber}`;
  console.log('Generated order number:', orderNumber);
  return orderNumber;
};

export const createOrder = async (
  information: OrderInformation,
  cart: Array<{ id: string; number: number }>,
  delivery: string,
  delivery_cost: number
): Promise<Order> => {
  const now = new Date();
  const timestamp = now.getTime();
  const isoString = now.toISOString();
  
  // Generate unique ID and order number
  const id = crypto.randomUUID();
  console.log('Generating order number...');
  const number = await generateOrderNumber();
  console.log('Generated order number:', number);
  
  // Freeze product data from cart - copy full product details
  console.log('Freezing product data for', cart.length, 'items...');
  const frozenCart: OrderCartItem[] = await Promise.all(
    cart.map(async (item) => {
      const product = await getProduct(item.id);
      if (!product) {
        throw new Error(`Product ${item.id} not found`);
      }
      
      console.log('Frozen product:', product.id, product.title);
      
      return {
        id: product.id,
        number: item.number,
        // Freeze all product data
        slug: product.slug,
        category: product.category,
        article: product.article,
        brand: product.brand,
        title: product.title,
        subtitle: product.subtitle,
        price: product.price,
        price_reduced: product.price_reduced,
        description: product.description,
        tag: product.tag,
        image: product.image,
        images: product.images,
      };
    })
  );
  
  return {
    id,
    number,
    date: timestamp,
    date_change: timestamp,
    status: 'active',
    delivery,
    delivery_cost,
    information,
    cart: frozenCart,
    createdAt: isoString,
    updatedAt: isoString,
  };
};

export const updateOrderStatus = async (
  id: string,
  status: Order['status']
): Promise<Order> => {
  const now = new Date();
  return await db.updateItem<Order>(
    ORDERS_TABLE,
    { id },
    'SET #status = :status, #date_change = :date_change, #updatedAt = :updatedAt',
    {
      ':status': status,
      ':date_change': now.getTime(),
      ':updatedAt': now.toISOString(),
    },
    {
      '#status': 'status',
      '#date_change': 'date_change',
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
      p.brand.toLowerCase().includes(query)
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
