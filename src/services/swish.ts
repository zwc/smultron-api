import {
  loadSwishConfig,
  createSwishClient,
  createPaymentRequest,
  getPaymentRequest,
  type SwishClient,
} from '../integrations/swish/index'

const SWISH_ENVIRONMENT = process.env.SWISH_ENVIRONMENT || 'mock'

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

  console.log('Creating Swish payment request:', {
    orderNumber,
    amount,
    payerAlias,
    environment: SWISH_ENVIRONMENT,
  })

  if (SWISH_ENVIRONMENT === 'mock') {
    const mockId = crypto.randomUUID().replace(/-/g, '').toUpperCase()
    console.log('Using mock Swish payment (mock mode - no API call)')
    return {
      id: mockId,
      location: `https://mss.cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests/${mockId}`,
      status: 'CREATED',
    }
  }

  const client = getSwishClient()
  const result = await createPaymentRequest(client, {
    amount: amount.toString(),
    payerAlias,
    payeePaymentReference: orderNumber,
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
