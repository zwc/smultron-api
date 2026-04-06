import {
  loadSwishConfig,
  createSwishClient,
  createPaymentRequest,
  SwishPaymentError,
} from './src/integrations/swish/index.ts'

const config = loadSwishConfig()
const client = createSwishClient(config)

try {
  const result = await createPaymentRequest(client, {
    amount: '100',
    message: 'Kingston USB Flash Drive 8 GB',
    payeePaymentReference: '0123456789',
    payerAlias: '46793513563',
  })

  console.log('Payment request created:')
  console.log('  Instruction ID:', result.instructionId)
  console.log('  HTTP status:', result.status)
  console.log('  Location:', result.location)
  console.log('  Token:', result.paymentRequestToken)
} catch (err) {
  if (err instanceof SwishPaymentError) {
    console.error('Swish error:', {
      instructionId: err.instructionId,
      httpStatus: err.httpStatus,
      errors: err.errors,
    })
  } else {
    console.error(err)
  }
}
