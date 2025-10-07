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
  items: OrderItem[];
  total: number;
  customerEmail: string;
  customerName: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

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
