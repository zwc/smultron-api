/**
 * Plain-English explanations for payment outcomes.
 * Stored on the payment (Swish requests) record — never mirrored onto order.status.
 * Only an admin may set an order to status='invalid'.
 */
export const PAYMENT_STATUS_REASON = {
  DECLINED:
    'The customer declined the Swish payment in their banking app.',
  CANCELLED:
    'The Swish payment was cancelled before it was completed.',
  CHECKOUT_CANCELLED:
    'The checkout was cancelled before payment was completed.',
  PAID: 'The Swish payment was completed successfully.',
} as const

/** Build a reason for Swish callback status ERROR, including provider details when present. */
export function paymentErrorReason(
  errorCode?: string | null,
  errorMessage?: string | null,
): string {
  const code = typeof errorCode === 'string' ? errorCode.trim() : ''
  const message = typeof errorMessage === 'string' ? errorMessage.trim() : ''

  if (code && message) {
    return `The Swish payment failed due to an error from Swish (${code}: ${message}).`
  }
  if (code) {
    return `The Swish payment failed due to an error from Swish (error code ${code}).`
  }
  if (message) {
    return `The Swish payment failed due to an error from Swish: ${message}.`
  }
  return 'The Swish payment failed due to an error from Swish.'
}
