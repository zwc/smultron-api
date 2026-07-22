import { describe, test, expect } from 'bun:test'
import {
  formatSek,
  renderOrderEmailHtml,
} from './email-template'
import type { OrderConfirmationData } from './email-types'

const sample: OrderConfirmationData = {
  orderId: '2606.007',
  customerName: 'Henrik Lindqvist',
  customerEmail: 'henrik@vh.se',
  customerPhone: '0706444364',
  orderTotal: 1267,
  currency: 'SEK',
  cartItems: [
    { name: 'Labubu – Give me some love', quantity: 2, price: 599 },
  ],
  deliveryMethod: 'postnord',
  deliveryCost: 69,
  paymentMethod: 'swish',
  deliveryAddress: {
    company: 'VH',
    address: 'Åloppevägen 43',
    zip: '168 56',
    city: 'Bromma',
  },
}

describe('formatSek', () => {
  test('formats whole kronor with space thousands separator', () => {
    expect(formatSek(1198)).toBe('1 198 kr')
    expect(formatSek(69)).toBe('69 kr')
    expect(formatSek(0)).toBe('0 kr')
  })
})

describe('renderOrderEmailHtml', () => {
  test('fills postnord template with Swish total and delivery cost', () => {
    const html = renderOrderEmailHtml(sample)
    expect(html).toContain('2606.007')
    expect(html).toContain('1 267 kr')
    expect(html).toContain('69 kr')
    expect(html).toContain('PostNord')
    expect(html).toContain('2 st')
    expect(html).toContain('1 198 kr')
    expect(html).toContain('henrik@vh.se')
    expect(html).not.toContain('{{SWISH_AMOUNT}}')
    expect(html).not.toContain('{{ORDER_NUMBER}}')
  })

  test('uses pickup template when delivery is not postnord', () => {
    const html = renderOrderEmailHtml({
      ...sample,
      deliveryMethod: 'pickup',
      deliveryCost: 0,
    })
    expect(html).toContain('Upphämtning')
    expect(html).toContain('0 kr')
    expect(html).not.toContain('PostNord-app')
  })
})
