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
  brand?: string;  // Optional
  title?: string;  // Optional
  subtitle?: string;  // Optional
  category?: string;  // Optional
  image?: string;  // Optional
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
