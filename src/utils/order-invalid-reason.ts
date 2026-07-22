/**
 * Plain-English explanation when an admin manually marks an order invalid.
 * The system must never set order.status = 'invalid' — payment failures belong
 * on the payments (Swish requests) table, not on the order.
 */
export const INVALID_ORDER_REASON = {
  ADMIN: 'Manually marked as invalid by an administrator.',
} as const
