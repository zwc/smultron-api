import {
  loadSwishConfig,
  createSwishClient,
  createPaymentRequest,
  getPaymentRequest,
  type SwishClient,
} from '../integrations/swish/index'
import { putItem, updateItem } from './dynamodb'

const SWISH_ENVIRONMENT = process.env.SWISH_ENVIRONMENT || 'mock'
const SWISH_TABLE = process.env.SWISH_REQUESTS_TABLE ?? 'smultron-swish'

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

  // Persist an initial log entry for this outgoing Swish request (always)
  const logId = crypto.randomUUID().replace(/-/g, '').toUpperCase()
  const now = new Date().toISOString()
  try {
    await putItem(SWISH_TABLE, {
      id: logId,
      orderNumber,
      amount: amount.toString(),
      message: message ?? null,
      payeePaymentReference: orderNumber,
      payerAlias: payerAlias ?? null,
      status: 'PENDING',
      createdAt: now,
    })
  } catch (err) {
    console.error('Failed to persist Swish request log (initial):', err)
  }

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
    try {
      await updateItem(
        SWISH_TABLE,
        { id: logId },
        'SET instructionId = :instr, #s = :s, #loc = :loc, updatedAt = :u',
        { ':instr': mockId, ':s': 'CREATED', ':loc': location, ':u': now },
        { '#s': 'status', '#loc': 'location' },
      )
    } catch (err) {
      console.error('Failed to update Swish request log (mock):', err)
    }

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
    payeePaymentReference: orderNumber,
    message: message || `Order ${orderNumber}`,
  })

  console.log('Swish payment created:', {
    instructionId: result.instructionId,
    status: result.status,
    location: result.location,
  })

  // update persisted log with instruction id and location
  try {
    await updateItem(
      SWISH_TABLE,
      { id: logId },
      'SET instructionId = :instr, #s = :s, #loc = :loc, paymentRequestToken = :token, updatedAt = :u',
      {
        ':instr': result.instructionId,
        ':s': 'CREATED',
        ':loc': result.location ?? '',
        ':token': result.paymentRequestToken ?? null,
        ':u': new Date().toISOString(),
      },
      { '#s': 'status', '#loc': 'location' },
    )
  } catch (err) {
    console.error('Failed to update Swish request log (post-create):', err)
  }

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
