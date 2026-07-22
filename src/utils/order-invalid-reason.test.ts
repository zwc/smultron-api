import { describe, test, expect } from 'bun:test'
import { INVALID_ORDER_REASON } from './order-invalid-reason'

describe('order-invalid-reason', () => {
  test('only exposes the manual admin reason', () => {
    expect(INVALID_ORDER_REASON.ADMIN).toContain('administrator')
    expect(Object.keys(INVALID_ORDER_REASON)).toEqual(['ADMIN'])
  })
})
