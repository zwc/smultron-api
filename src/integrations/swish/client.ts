import fs from 'node:fs'
import https from 'node:https'
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
    cert: Buffer
    key: Buffer
    ca?: Buffer
  }
}

import { putItem } from '../../services/dynamodb'

const SWISH_TABLE = process.env.SWISH_REQUESTS_TABLE ?? 'smultron-swish'

export interface SwishRequestLog {
  instructionId: string
  amount: string
  currency: string
  message: string | null
  payeePaymentReference: string | null
  payerAlias: string | null
  payeeAlias: string
  callbackUrl: string
  status: string
}

export const logPaymentRequest = async (
  log: SwishRequestLog,
): Promise<void> => {
  try {
    await putItem(SWISH_TABLE, {
      id: log.instructionId,
      ...log,
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Failed to persist Swish payment request:', err)
  }
}

export function createSwishClient(config: SwishConfig): SwishClient {
  return {
    config,
    tls: {
      cert: fs.readFileSync(config.certPath),
      key: fs.readFileSync(config.keyPath),
      ...(config.caPath && { ca: fs.readFileSync(config.caPath) }),
    },
  }
}

interface SwishResponse {
  ok: boolean
  status: number
  headers: { get: (name: string) => string | null }
  json: () => Promise<unknown>
}

const swishFetch = (
  client: SwishClient,
  path: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<SwishResponse> => {
  const target = new URL(`${client.config.baseUrl}${path}`)
  return new Promise((resolve, reject) => {
    const bodyBuffer = init?.body ? Buffer.from(init.body, 'utf-8') : undefined
    const headers = {
      ...init?.headers,
      ...(bodyBuffer && { 'Content-Length': String(bodyBuffer.length) }),
    }

    const req = https.request(
      {
        hostname: target.hostname,
        port: target.port || 443,
        path: target.pathname + target.search,
        method: init?.method ?? 'GET',
        headers,
        cert: client.tls.cert,
        key: client.tls.key,
        ...(client.tls.ca && { ca: client.tls.ca }),
        rejectUnauthorized: true,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8')
          const status = res.statusCode ?? 0
          resolve({
            ok: status >= 200 && status < 300,
            status,
            headers: {
              get: (name: string) => {
                const val = res.headers[name.toLowerCase()]
                return Array.isArray(val) ? val[0] : (val ?? null)
              },
            },
            json: () => {
              try {
                return Promise.resolve(JSON.parse(body))
              } catch {
                return Promise.reject(new Error('Invalid JSON response'))
              }
            },
          })
        })
      },
    )
    req.on('error', reject)
    if (bodyBuffer) req.write(bodyBuffer)
    req.end()
  })
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

  try {
    await logPaymentRequest({
      instructionId,
      amount: payload.amount,
      currency: payload.currency,
      message: payload.message ?? null,
      payeePaymentReference: payload.payeePaymentReference ?? null,
      payerAlias: payload.payerAlias ?? null,
      payeeAlias: payload.payeeAlias,
      callbackUrl: payload.callbackUrl,
      status: 'CREATED',
    })
  } catch (err) {
    console.error('Failed to persist Swish payment request:', err)
  }

  console.log('Swish payment request payload:', JSON.stringify(payload))

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
