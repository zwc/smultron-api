import { test, expect, type Page } from '@playwright/test'
import {
  API_URL,
  TEST_PHONE,
  TEST_PRODUCT,
  clearOpenOrdersForPhone,
  getProductStockFromDb,
  prepareCheckoutReady,
  placeOrder,
  setProductStock,
} from './helpers'

/**
 * Reserve last unit via FE checkout, then prove stock is held
 * (next checkout → INSUFFICIENT_STOCK, DB stock stays 0).
 */
test.describe('stock reservation before Swish', () => {
  test.beforeEach(async () => {
    await clearOpenOrdersForPhone(TEST_PHONE)
    await setProductStock(TEST_PRODUCT.id, 1)
    expect(await getProductStockFromDb(TEST_PRODUCT.id)).toBe(1)
  })

  test.afterEach(async () => {
    await clearOpenOrdersForPhone(TEST_PHONE)
    await setProductStock(TEST_PRODUCT.id, 10)
  })

  test('FE checkout reserves last unit; next checkout is INSUFFICIENT_STOCK', async ({
    page,
    request,
  }) => {
    await prepareCheckoutReady(page, {
      delivery: 'pickup',
      name: 'Playwright Reserve FE',
      phone: TEST_PHONE,
    })

    const first = watchCheckoutResult(page)
    await placeOrder(page)
    const outcome = await first

    expect(outcome, `FE checkout: ${JSON.stringify(outcome)}`).toMatchObject({
      kind: 'reserved',
    })
    expect(await getProductStockFromDb(TEST_PRODUCT.id)).toBe(0)

    const second = await request
      .post(`${API_URL}/checkout`, {
        data: {
          order: {
            payment: 'swish',
            delivery: 'pickup',
            delivery_cost: 0,
            name: 'Playwright Reserve API',
            email: `pw-reserve-2-${Date.now()}@example.com`,
            phone: '0701234567',
          },
          cart: [
            {
              id: TEST_PRODUCT.id,
              title: TEST_PRODUCT.title,
              price: TEST_PRODUCT.price,
              number: 1,
            },
          ],
        },
      })
      .then((r) => r.json())

    expect(second?.meta?.errorCode).toBe('INSUFFICIENT_STOCK')
    expect(await getProductStockFromDb(TEST_PRODUCT.id)).toBe(0)

    await cancelOpenPayment(page)
  })

  test('two parallel checkouts with stock=1: only one reserves', async ({
    request,
  }) => {
    await setProductStock(TEST_PRODUCT.id, 1)
    expect(await getProductStockFromDb(TEST_PRODUCT.id)).toBe(1)

    const cart = [
      {
        id: TEST_PRODUCT.id,
        title: TEST_PRODUCT.title,
        price: TEST_PRODUCT.price,
        number: 1,
      },
    ]

    // Same enrolled payer on both — loser must fail at reserve (INSUFFICIENT),
    // not at Swish (RP06), when atomic decrement works.
    const [a, b] = await Promise.all([
      request
        .post(`${API_URL}/checkout`, {
          data: {
            order: {
              payment: 'swish',
              delivery: 'pickup',
              delivery_cost: 0,
              name: 'PW Race A',
              email: `pw-race-a-${Date.now()}@example.com`,
              phone: TEST_PHONE,
            },
            cart,
          },
        })
        .then((r) => r.json()),
      request
        .post(`${API_URL}/checkout`, {
          data: {
            order: {
              payment: 'swish',
              delivery: 'pickup',
              delivery_cost: 0,
              name: 'PW Race B',
              email: `pw-race-b-${Date.now()}@example.com`,
              phone: TEST_PHONE,
            },
            cart,
          },
        })
        .then((r) => r.json()),
    ])

    const outcomes = [a, b].map((body) => {
      if (body?.meta?.errorCode === 'INSUFFICIENT_STOCK') return 'insufficient'
      if (body?.data?.order?.id) return 'reserved'
      return `other:${body?.meta?.errorCode ?? 'unknown'}`
    })

    expect(
      outcomes.filter((o) => o === 'reserved'),
      `outcomes=${JSON.stringify(outcomes)}`,
    ).toHaveLength(1)
    expect(
      outcomes.filter((o) => o === 'insufficient'),
      `outcomes=${JSON.stringify(outcomes)}`,
    ).toHaveLength(1)

    for (const body of [a, b]) {
      if (body?.data?.order?.id) {
        await request.fetch(`${API_URL}/cancel/${body.data.order.id}`, {
          method: 'PATCH',
        })
      }
    }
  })
})

type CheckoutOutcome =
  | { kind: 'reserved'; orderId?: string }
  | { kind: 'insufficient' }
  | { kind: 'other'; detail: string }

function watchCheckoutResult(page: Page): Promise<CheckoutOutcome> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (outcome: CheckoutOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve(outcome)
    }

    const timeout = setTimeout(() => {
      finish({ kind: 'other', detail: 'timeout waiting for checkout response' })
    }, 45_000)

    page.on('response', async (response) => {
      if (!response.url().includes(`${API_URL}/checkout`)) return
      if (response.request().method() !== 'POST') return
      if (response.url().includes('/cancel')) return
      try {
        const body = await response.json()
        if (body?.meta?.errorCode === 'INSUFFICIENT_STOCK') {
          finish({ kind: 'insufficient' })
          return
        }
        if (body?.data?.order?.id) {
          finish({ kind: 'reserved', orderId: body.data.order.id })
          return
        }
        if (body?.meta?.errorCode) {
          finish({
            kind: 'other',
            detail: `${body.meta.errorCode}: ${body.meta.errorMessage ?? ''}`,
          })
        }
      } catch {
        // ignore
      }
    })
  })
}

async function cancelOpenPayment(page: Page): Promise<void> {
  const cancel = page.locator('.area-payment .button[data-button="cancel"] a')
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click()
    await page.waitForTimeout(1000)
  }
}
