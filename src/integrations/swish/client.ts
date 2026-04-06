import type { SwishConfig } from './config.ts'
import type {
  PaymentRequestInput,
  PaymentRequestPayload,
  PaymentRequestResult,
  PaymentStatus,
  SwishCallbackPayload,
  SwishError,
} from './types.ts'

export interface SwishClient {
  config: SwishConfig
  tls: {
    cert: BunFile
    key: BunFile
    ca?: BunFile
  }
}

import { putItem } from '../../services/dynamodb'

const SWISH_TABLE = process.env.SWISH_REQUESTS_TABLE ?? 'smultron-swish'

export function createSwishClient(config: SwishConfig): SwishClient {
  return {
    config,
    tls: {
      cert: Bun.file(config.certPath),
      key: Bun.file(config.keyPath),
      ...(config.caPath && { ca: Bun.file(config.caPath) }),
    },
  }
}

async function swishFetch(
  client: SwishClient,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${client.config.baseUrl}${path}`
  return fetch(url, {
    ...init,
    tls: client.tls,
    verbose: true,
  } as RequestInit)
}

export async function createPaymentRequest(
  client: SwishClient,
  input: PaymentRequestInput,
): Promise<PaymentRequestResult> {
  const instructionId = crypto.randomUUID().replace(/-/g, '').toUpperCase()

  const payload: PaymentRequestPayload = {
    callbackUrl: client.config.callbackUrl,
    payeeAlias: client.config.payeeAlias,
    amount: input.amount,
    currency: input.currency ?? 'SEK',
    ...(input.payerAlias && { payerAlias: input.payerAlias }),
    ...(input.payeePaymentReference && {
      payeePaymentReference: input.payeePaymentReference,
    }),
    ...(input.message && { message: input.message }),
  }

  // Logging is handled at the service layer; client performs the external request only.

  const res = await swishFetch(
    client,
    `/swish-cpcapi/api/v2/paymentrequests/${instructionId}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )

  if (!res.ok) {
    let errors: SwishError[] = []
    try {
      errors = (await res.json()) as SwishError[]
    } catch {
      // response body may not be JSON
    }
    throw new SwishPaymentError(
      `Swish payment request failed (HTTP ${res.status})`,
      instructionId,
      res.status,
      errors,
    )
  }

  return {
    instructionId,
    status: res.status,
    location: res.headers.get('location') ?? undefined,
    paymentRequestToken: res.headers.get('paymentrequesttoken') ?? undefined,
  }
}

export async function getPaymentRequest(
  client: SwishClient,
  instructionId: string,
): Promise<PaymentStatus> {
  const res = await swishFetch(
    client,
    `/swish-cpcapi/api/v1/paymentrequests/${instructionId}`,
  )

  if (!res.ok) {
    throw new Error(
      `Failed to get payment request ${instructionId}: HTTP ${res.status}`,
    )
  }

  return (await res.json()) as PaymentStatus
}

export function handleSwishCallback(payload: SwishCallbackPayload): {
  id: string
  status: SwishCallbackPayload['status']
  paymentReference: string
} {
  console.log(
    `[swish-callback] id=${payload.id} status=${payload.status} amount=${payload.amount} ${payload.currency}`,
  )

  return {
    id: payload.id,
    status: payload.status,
    paymentReference: payload.paymentReference,
  }
}

export class SwishPaymentError extends Error {
  constructor(
    message: string,
    public readonly instructionId: string,
    public readonly httpStatus: number,
    public readonly errors: SwishError[],
  ) {
    super(message)
    this.name = 'SwishPaymentError'
  }
}
