import type { APIRequestContext, Page } from '@playwright/test'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'

export const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://smultronet.nu/2025/'
export const API_URL = process.env.API_URL ?? 'https://stage.smultron.zwc.se/v1'
// Pin stage tables — repo `.env` often points PRODUCTS_TABLE at prod.
export const PRODUCTS_TABLE = 'smultron-products-stage'
export const POSTNORD_COST = 69
/** Stage Swish-enrolled payer; other numbers → ACMT03. */
export const TEST_PHONE = process.env.TEST_PHONE ?? '0706444364'
const ADMIN_USER = process.env.ADMIN_USER ?? 'linn'
const ADMIN_PASS = process.env.ADMIN_PASS ?? 'e5uu588hzfwge367'

/** Known in-stock test product on stage (also used for reservation race). */
export const TEST_PRODUCT = {
  id: '327aa63f-9d8f-4c80-a13f-8defc6b0041b',
  slug: 'forsta-testprodukten',
  category: 'skullpanda',
  price: 100,
  title: 'Testprodukt',
}

export type CatalogProduct = {
  id: string
  slug: string
  category: string
  price: number
  stock: number
  title: string
  subtitle?: string
  status: string
}

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? 'eu-north-1' }),
)

const gotoOpts = { waitUntil: 'domcontentloaded' as const, timeout: 60_000 }

export function formatSek(amount: number): string {
  const whole = Math.round(amount)
  return `${whole.toLocaleString('sv-SE')} kr`
}

export async function fetchCatalog(
  request: APIRequestContext,
): Promise<CatalogProduct[]> {
  const res = await request.get(`${API_URL}/catalog`)
  const body = await res.json()
  return (body.data?.products ?? []) as CatalogProduct[]
}

export async function getProductStockFromDb(productId: string): Promise<number> {
  const result = await ddb.send(
    new GetCommand({
      TableName: PRODUCTS_TABLE,
      Key: { id: productId },
      ProjectionExpression: 'stock',
      ConsistentRead: true,
    }),
  )
  return Number(result.Item?.stock ?? 0)
}

export async function setProductStock(
  productId: string,
  stock: number,
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: PRODUCTS_TABLE,
      Key: { id: productId },
      UpdateExpression: 'SET stock = :stock, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':stock': stock,
        ':updatedAt': new Date().toISOString(),
      },
    }),
  )
}

type AdminOrder = {
  id: string
  status?: string
  swish_payment_id?: string
  information?: { phone?: string }
}

async function adminToken(): Promise<string> {
  const res = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
  })
  const body = (await res.json()) as { data?: { token?: string } }
  if (!body.data?.token) {
    throw new Error(`admin login failed: ${res.status}`)
  }
  return body.data.token
}

async function listOrdersByStatus(
  token: string,
  status: string,
): Promise<AdminOrder[]> {
  const res = await fetch(`${API_URL}/admin/orders?status=${status}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = (await res.json()) as { data?: AdminOrder[] | { orders?: AdminOrder[] } }
  if (Array.isArray(body.data)) return body.data
  return body.data?.orders ?? []
}

/**
 * Free the Swish payer alias used by FE tests.
 * - PATCH-cancel pending/unpaid orders (releases stock + Swish)
 * - Cancel orphan Swish payment ids still attached to active test orders
 *   (BAJS-TEST /test/confirm-payment marks paid without closing Swish → RP06)
 */
export async function clearOpenOrdersForPhone(
  phone: string = TEST_PHONE,
): Promise<number> {
  const token = await adminToken()
  let cancelled = 0

  for (const status of ['pending', 'unpaid']) {
    const orders = (await listOrdersByStatus(token, status)).filter(
      (o) => o.information?.phone === phone,
    )
    for (const order of orders) {
      const cancel = await fetch(`${API_URL}/cancel/${order.id}`, {
        method: 'PATCH',
      })
      if (cancel.ok) cancelled += 1
    }
  }

  // BAJS-TEST confirms without closing Swish — cancel recent active payment ids.
  const cutoff = Date.now() - 60 * 60 * 1000
  const active = (await listOrdersByStatus(token, 'active')).filter((o) => {
    if (o.information?.phone !== phone || !o.swish_payment_id) return false
    const updated = Date.parse((o as { updatedAt?: string }).updatedAt ?? '')
    return Number.isFinite(updated) ? updated >= cutoff : true
  })
  if (active.length > 0) {
    const { cancelSwishPayment } = await import('../../src/services/swish')
    // Newest first — only need the open payer lock released.
    active.sort(
      (a, b) =>
        Date.parse((b as { updatedAt?: string }).updatedAt ?? '') -
        Date.parse((a as { updatedAt?: string }).updatedAt ?? ''),
    )
    for (const order of active.slice(0, 3)) {
      try {
        await cancelSwishPayment(order.swish_payment_id!)
        cancelled += 1
      } catch {
        // already cancelled / expired
      }
    }
  }

  return cancelled
}

async function waitForCatalog(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      Array.isArray((window as any).global?.products) &&
      (window as any).global.products.length > 0,
    { timeout: 30_000 },
  )
}

export async function waitForShopReady(page: Page): Promise<void> {
  await page.goto(FRONTEND_URL, gotoOpts)
  await waitForCatalog(page)
}

export async function openProduct(
  page: Page,
  product: { category: string; slug: string; id?: string },
): Promise<void> {
  await page.goto(
    `${FRONTEND_URL}?product=${product.category}--${product.slug}`,
    gotoOpts,
  )
  await waitForCatalog(page)
  await page.waitForFunction(
    (id) => {
      const g = (window as any).global
      return g?.page?.name === 'product' && (!id || g.page.id === id)
    },
    product.id,
    { timeout: 30_000 },
  )
  await page.waitForSelector(
    '.button[data-button="add-to-cart"], .button[data-button="open-cart"]',
    { timeout: 30_000 },
  )
}

export async function addCurrentProductToCart(page: Page): Promise<void> {
  // Product page load often leaves global.busy=true; js_cart_add no-ops then.
  await page.evaluate(() => {
    const g = window as any
    g.js_global_busy?.(false)
    if (g.global) g.global.busy = false
  })

  const add = page.locator('.button[data-button="add-to-cart"]')
  if (await add.isVisible()) {
    await page.evaluate(() => (window as any).js_cart_add())
  } else {
    await page.evaluate(() => (window as any).js_cart_open?.())
  }

  await page.waitForFunction(
    () => {
      try {
        const cart = JSON.parse(
          window.localStorage.getItem('smultronet-cart') || '[]',
        )
        return Array.isArray(cart) && cart.length > 0
      } catch {
        return false
      }
    },
    { timeout: 15_000 },
  )
  await page.waitForSelector('.area-cart', { state: 'visible', timeout: 15_000 })
}

export async function goToCheckoutFromCart(page: Page): Promise<void> {
  // Prefer direct navigate — cart drawer click can race with full reload.
  await page.goto(`${FRONTEND_URL}?checkout`, gotoOpts)
  await waitForCatalog(page)
  await page.waitForSelector(
    '.section-area[data-section-area="summary"] .form-field[data-field="total"]',
    { timeout: 30_000 },
  )
  // Ensure summary totals render from cart + shipping choice
  await page.evaluate(() => {
    const g = window as any
    if (typeof g.js_cart_count === 'function') g.js_cart_count()
  })
}

export async function fillCheckoutForm(
  page: Page,
  opts: {
    delivery: 'postnord' | 'pickup'
    name?: string
    email?: string
    phone?: string
    address?: string
    zip?: string
    city?: string
  },
): Promise<void> {
  const form = page.locator('.section-area[data-section-area="form"] .form')

  await form
    .locator(
      `.form-field[data-field="delivery"] .form-option[data-value="${opts.delivery}"] a`,
    )
    .click()
  await page.evaluate(() => (window as any).js_cart_count())

  await form
    .locator('.form-field[data-field="name"] input')
    .fill(opts.name ?? 'Playwright Test')
  await form
    .locator('.form-field[data-field="email"] input')
    .fill(opts.email ?? `pw-${Date.now()}@example.com`)
  await form
    .locator('.form-field[data-field="phone"] input')
    .fill(opts.phone ?? TEST_PHONE)

  if (opts.delivery === 'postnord') {
    await form
      .locator('.form-field[data-field="address"] input')
      .fill(opts.address ?? 'Testgatan 1')
    await form
      .locator('.form-field[data-field="zip"] input')
      .fill(opts.zip ?? '12345')
    await form
      .locator('.form-field[data-field="city"] input')
      .fill(opts.city ?? 'Stockholm')
  }

  await form.locator('.form-field[data-field="email"] input').blur()
  await form.locator('.form-field[data-field="phone"] input').blur()
  if (opts.delivery === 'postnord') {
    await form.locator('.form-field[data-field="city"] input').blur()
  }

  await page.waitForSelector(
    '.button[data-button="place-order"][data-state="normal"]',
    { timeout: 15_000 },
  )
}

export async function readCheckoutTotals(page: Page): Promise<{
  subtotalText: string
  deliveryText: string
  totalText: string
}> {
  const summary = page.locator(
    '.section-area[data-section-area="summary"] .form',
  )
  return {
    subtotalText: (
      await summary
        .locator('.form-field[data-field="subtotal"] .form-content p')
        .innerText()
    ).trim(),
    deliveryText: (
      await summary
        .locator('.form-field[data-field="delivery"] .form-content p')
        .innerText()
    ).trim(),
    totalText: (
      await summary
        .locator('.form-field[data-field="total"] .form-content p')
        .innerText()
    ).trim(),
  }
}

export async function placeOrder(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = window as any
    g.js_global_busy?.(false)
    if (g.global) g.global.busy = false
    g.js_checkout_order_place()
  })
}

/** Prepare a browser up to the enabled place-order button. */
export async function prepareCheckoutReady(
  page: Page,
  opts: { delivery: 'postnord' | 'pickup'; name?: string; phone?: string },
): Promise<void> {
  await waitForShopReady(page)
  await openProduct(page, TEST_PRODUCT)
  await addCurrentProductToCart(page)
  await goToCheckoutFromCart(page)
  await fillCheckoutForm(page, {
    delivery: opts.delivery,
    name: opts.name,
    phone: opts.phone,
  })
}
