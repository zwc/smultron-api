import {
  loadSwishConfig,
  createSwishClient,
  createPaymentRequest,
  getPaymentRequest,
  logPaymentRequest,
  type SwishClient,
} from '../integrations/swish/index'

const SWISH_ENVIRONMENT = process.env.SWISH_ENVIRONMENT || 'production'

const formatPhoneNumber = (phone: string): string => {
  const digits = phone.replace(/[^0-9]/g, '')
  const withoutLeadingZero = digits.startsWith('0')
    ? `46${digits.substring(1)}`
    : digits
  return withoutLeadingZero.startsWith('46')
    ? withoutLeadingZero
    : `46${withoutLeadingZero}`
}

const getSwishClient = (): SwishClient => {
  const config = loadSwishConfig()
  return createSwishClient(config)
}

export const createSwishPayment = async (
  orderNumber: string,
  amount: number,
  phoneNumber?: string,
  message?: string,
): Promise<{ id: string; location: string; status: string }> => {
  const payerAlias = phoneNumber ? formatPhoneNumber(phoneNumber) : undefined
  const paymentReference = orderNumber.replace(/\./g, '')

  console.log('Creating Swish payment request:', {
    orderNumber,
    amount,
    payerAlias,
    environment: SWISH_ENVIRONMENT,
  })

  if (SWISH_ENVIRONMENT === 'mock') {
    const mockId = crypto.randomUUID().replace(/-/g, '').toUpperCase()
    console.log('Using mock Swish payment (mock mode - no API call)')
    const location = `https://mss.cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests/${mockId}`
    await logPaymentRequest({
      instructionId: mockId,
      amount: amount.toString(),
      currency: 'SEK',
      message: message ?? null,
      payeePaymentReference: paymentReference,
      payeeAlias: process.env.SWISH_PAYEE_ALIAS ?? '1236166490',
      callbackUrl: process.env.SWISH_CALLBACK_URL ?? '',
      status: 'CREATED',
    })

    return {
      id: mockId,
      location,
      status: 'CREATED',
    }
  }

  const client = getSwishClient()
  const result = await createPaymentRequest(client, {
    amount: amount.toString(),
    payerAlias,
    payeePaymentReference: paymentReference,
    message: message || `Order ${orderNumber}`,
  })

  console.log('Swish payment created:', {
    instructionId: result.instructionId,
    status: result.status,
    location: result.location,
  })

  return {
    id: result.instructionId,
    location: result.location ?? '',
    status: 'CREATED',
  }
}

export const getSwishPaymentStatus = async (
  paymentId: string,
): Promise<{ id: string; status: string } | null> => {
  console.log('Fetching Swish payment status:', paymentId)

  if (SWISH_ENVIRONMENT === 'mock') {
    return { id: paymentId, status: 'CREATED' }
  }

  const client = getSwishClient()
  const result = await getPaymentRequest(client, paymentId)
  return { id: result.id, status: result.status }
}
