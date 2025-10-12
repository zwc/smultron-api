export interface Product {
  id: string;
  category: string;
  article: string;
  brand: string;
  title: string;
  subtitle: string;
  price: number;
  price_reduced: number;
  description: string[];
  tag: string;
  index: number;
  stock: number;
  max_order: number;
  image: string;
  images: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductsResponse {
  data: Product[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    sort: string;
    filters: {
      status: string[] | null;
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
  brand: string;
  title: string;
  subtitle: string;
  index: number;
}

export interface Order {
  id: string;
  cart: CartItem[];
  order: OrderDetails;
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

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
