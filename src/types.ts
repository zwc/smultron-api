export interface Product {
  id: string;
  slug: string;
  categorySlug?: string;
  article?: string;
  brand: string;
  title: string;
  subtitle: string;
  price: number;
  price_reduced?: number;
  description?: string[];
  tag?: string;
  index?: number;
  stock: number;
  max_order?: number;
  image?: string;
  images?: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

// Public product without internal ID
export type PublicProduct = Omit<Product, 'id'>;

export interface CategorySummary {
  id: string;
  slug: string;
  title: string;
}

export interface AdminProductsResponse {
  data: Product[];
  categories: CategorySummary[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    sort: string;
    filters: {
      status: 'active' | 'inactive' | null;
      q: string | null;
    };
  };
  links: {
    self: string;
    next: string | null;
    prev: string | null;
  };
}

export interface Category {
  id: string;
  slug: string;
  brand: string;
  title: string;
  subtitle: string;
  index: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

// Public category without internal ID
export type PublicCategory = Omit<Category, 'id'>;

export interface AdminCategoriesResponse {
  data: Category[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    sort: string;
    filters: {
      status: 'active' | 'inactive' | null;
    };
  };
  links: {
    self: string;
    next: string | null;
    prev: string | null;
  };
}

export interface Order {
  id: string;
  number: string; // Format: YYMM.XXX (e.g., "2510.001")
  date: number; // Timestamp
  date_change: number; // Timestamp
  status: 'active' | 'inactive' | 'invalid';
  delivery: string;
  delivery_cost: number;
  information: OrderInformation;
  cart: OrderCartItem[]; // Frozen product snapshots
  createdAt: string;
  updatedAt: string;
}

export interface OrderInformation {
  name: string;
  company: string;
  address: string;
  zip: string;
  city: string;
  email: string;
  phone: string;
}

export interface OrderCartItem {
  id: string; // Product ID reference
  number: number; // Quantity
  // Frozen product data at time of order
  slug: string;
  categorySlug?: string;
  article?: string;
  brand: string;
  title: string;
  subtitle: string;
  price: number;
  price_reduced?: number;
  description?: string[];
  tag?: string;
  image?: string;
  images?: string[];
}

// Legacy interfaces (keep for backwards compatibility if needed)
export interface CartItem {
  id: string;  // Required: product ID
  price: number;  // Required: price at time of order
  number: number;  // Required: quantity
}

export interface OrderDetails {
  name: string;
  company?: string;
  address: string;
  zip: string;
  city: string;
  phone: string;
  email?: string;
  delivery: string;
  payment: string;
}

// Legacy support
export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface AuthPayload {
  username: string;
  iat: number;
  exp: number;
}

export interface APIResponse<T = any> {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}
