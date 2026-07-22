export interface OrderConfirmationData {
  orderId: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  orderTotal: number
  currency: string
  cartItems: Array<{
    name: string
    quantity: number
    price: number
  }>
  deliveryMethod: string
  deliveryCost: number
  paymentMethod: string
  paymentReference?: string
  deliveryAddress?: {
    company?: string
    address: string
    zip: string
    city: string
  }
}
