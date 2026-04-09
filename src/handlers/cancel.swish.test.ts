import { describe, test, expect, mock, beforeEach } from 'bun:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'

const mockCancelSwishPayment = mock(() => Promise.resolve())

mock.module('../services/swish', () => ({
  cancelSwishPayment: mockCancelSwishPayment,
}))

const { handler } = await import('./cancel.swish')

const buildEvent = (id: string | undefined): APIGatewayProxyEvent =>
  ({
    pathParameters: id ? { id } : null,
  }) as unknown as APIGatewayProxyEvent

describe('cancel.swish handler', () => {
  beforeEach(() => {
    mockCancelSwishPayment.mockClear()
  })

  test('returns 400 when id is missing', async () => {
    const response = await handler(buildEvent(undefined))
    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.error.message).toBe('Payment ID is required')
    expect(mockCancelSwishPayment).not.toHaveBeenCalled()
  })

  test('cancels payment and returns success', async () => {
    const response = await handler(
      buildEvent('5D59DA1B1632424E874DDB219AD54597'),
    )
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.data).toEqual({
      id: '5D59DA1B1632424E874DDB219AD54597',
      status: 'CANCELLED',
    })
    expect(mockCancelSwishPayment).toHaveBeenCalledTimes(1)
    expect(mockCancelSwishPayment).toHaveBeenCalledWith(
      '5D59DA1B1632424E874DDB219AD54597',
    )
  })

  test('returns 500 when cancelSwishPayment throws', async () => {
    mockCancelSwishPayment.mockImplementationOnce(() =>
      Promise.reject(new Error('Swish API error')),
    )
    const response = await handler(buildEvent('ABC123'))
    expect(response.statusCode).toBe(500)
    const body = JSON.parse(response.body)
    expect(body.error.message).toBe('Internal server error')
  })
})
