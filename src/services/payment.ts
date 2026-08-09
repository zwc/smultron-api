import { getPaymentRequestsByReference } from '../integrations/swish/index'

export const getOrderPayments = (orderId: string) =>
  getPaymentRequestsByReference(orderId.replace(/-/g, ''))
