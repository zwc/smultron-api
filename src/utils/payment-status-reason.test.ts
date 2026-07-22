import { describe, test, expect } from 'bun:test'
import {
  PAYMENT_STATUS_REASON,
  paymentErrorReason,
} from './payment-status-reason'

describe('payment-status-reason', () => {
  test('exposes plain-English reasons for payment outcomes', () => {
    expect(PAYMENT_STATUS_REASON.DECLINED).toContain('declined')
    expect(PAYMENT_STATUS_REASON.CANCELLED).toContain('cancelled')
    expect(PAYMENT_STATUS_REASON.CHECKOUT_CANCELLED).toContain('checkout')
    expect(PAYMENT_STATUS_REASON.PAID).toContain('completed')
  })

  test('paymentErrorReason includes code and message when both present', () => {
    expect(paymentErrorReason('RF07', 'Transaction declined')).toBe(
      'The Swish payment failed due to an error from Swish (RF07: Transaction declined).',
    )
  })

  test('paymentErrorReason handles code-only and message-only', () => {
    expect(paymentErrorReason('RF07', null)).toBe(
      'The Swish payment failed due to an error from Swish (error code RF07).',
    )
    expect(paymentErrorReason(undefined, 'Timeout')).toBe(
      'The Swish payment failed due to an error from Swish: Timeout.',
    )
  })

  test('paymentErrorReason falls back when Swish sends no details', () => {
    expect(paymentErrorReason()).toBe(
      'The Swish payment failed due to an error from Swish.',
    )
  })
})
