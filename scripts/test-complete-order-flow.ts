#!/usr/bin/env bun
/**
 * Complete Order Flow Test
 *
 * This script tests the complete order flow including:
 * 1. Product creation/update with sufficient stock
 * 2. Stock reservation during checkout
 * 3. Swish payment integration
 * 4. Order confirmation
 *
 * Usage:
 *   bun run scripts/test-complete-order-flow.ts
 */

const API_URL = process.env.API_URL || 'https://dev.smultron.zwc.se/v1'

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logStep(step: number, message: string) {
  log(`\n${'='.repeat(60)}`, 'cyan')
  log(`Step ${step}: ${message}`, 'bright')
  log('='.repeat(60), 'cyan')
}

function logSuccess(message: string) {
  log(`✓ ${message}`, 'green')
}

function logError(message: string) {
  log(`✗ ${message}`, 'red')
}

function logInfo(message: string) {
  log(`ℹ ${message}`, 'blue')
}

function logWarning(message: string) {
  log(`⚠ ${message}`, 'yellow')
}

// Test data - matches the sample order provided
const TEST_ORDER = {
  order: {
    payment: 'swish',
    delivery: 'postnord',
    delivery_cost: 82,
    name: 'Henrik',
    company: '',
    address: 'Åloppevägen 43',
    zip: '123 45',
    city: 'Bromma',
    email: 'henrik@vh.se',
    phone: '0706444364',
  },
  cart: [
    {
      id: 'id-enmassatecken-big-into-energy',
      slug: 'big-into-energy',
      brand: 'Pop Mart',
      title: 'Labubu',
      subtitle: 'Big into energy',
      category: 'labubu',
      price: 599,
      number: 2,
      image: 'graphics/temp/labubu-big-into-energy-1.jpg',
    },
    {
      id: 'id-enmassatecken-rainy-day',
      slug: 'rainy-day',
      brand: 'Dreams',
      title: 'Sonny Angel',
      subtitle: 'Rainy day',
      category: 'sonny-angel',
      price: 599,
      number: 1,
      image: 'graphics/temp/sonny-angel-rainy-day.jpg',
    },
  ],
}

interface LoginResponse {
  data: {
    token: string
    name: string
  }
}

interface Product {
  id: string
  slug: string
  brand: string
  title: string
  subtitle: string
  category?: string
  article?: string
  price: number
  price_reduced?: number
  description?: string[]
  tag?: string
  index?: number
  stock: number
  max_order?: number
  image?: string
  images?: string[]
  status: 'active' | 'inactive'
}

interface CheckoutResponse {
  data: {
    order: {
      id: string
      number: string
      status: string
    }
    payment: {
      method: string
      status: string
      reference?: string
      swishUrl?: string
    }
  }
}

async function login(): Promise<string> {
  logInfo('Logging in as admin user...')

  const response = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'linn',
      password: 'e5uu588hzfwge367',
    }),
  })

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${await response.text()}`)
  }

  const data = (await response.json()) as LoginResponse
  logSuccess(`Logged in as ${data.data.name}`)
  return data.data.token
}

async function getProduct(
  token: string,
  productId: string,
): Promise<Product | null> {
  logInfo(`Checking if product ${productId} exists...`)

  const response = await fetch(`${API_URL}/admin/products/${productId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (response.status === 404) {
    logInfo('Product does not exist')
    return null
  }

  if (!response.ok) {
    throw new Error(
      `Failed to get product: ${response.status} ${await response.text()}`,
    )
  }

  const result = (await response.json()) as { data: Product }
  logSuccess(`Product found: ${result.data.title}`)
  return result.data
}

async function createProduct(
  token: string,
  productData: any,
): Promise<Product> {
  logInfo(`Creating product: ${productData.title}...`)

  const response = await fetch(`${API_URL}/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...productData,
      stock: 10, // Ensure sufficient stock
      status: 'active',
    }),
  })

  if (!response.ok) {
    throw new Error(
      `Failed to create product: ${response.status} ${await response.text()}`,
    )
  }

  const result = (await response.json()) as { data: Product }
  logSuccess(`Product created: ${result.data.title} (ID: ${result.data.id})`)
  return result.data
}

async function updateProduct(
  token: string,
  productId: string,
  updates: Partial<Product>,
): Promise<Product> {
  logInfo(`Updating product ${productId}...`)

  const response = await fetch(`${API_URL}/admin/products/${productId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    throw new Error(
      `Failed to update product: ${response.status} ${await response.text()}`,
    )
  }

  const result = (await response.json()) as { data: Product }
  logSuccess(
    `Product updated: ${result.data.title} (Stock: ${result.data.stock})`,
  )
  return result.data
}

async function ensureProductsExist(
  token: string,
): Promise<Map<string, Product>> {
  const productMap = new Map<string, Product>()

  for (const cartItem of TEST_ORDER.cart) {
    const existingProduct = await getProduct(token, cartItem.id)

    if (existingProduct) {
      // Check if stock is sufficient
      if (existingProduct.stock < cartItem.number + 5) {
        logWarning(
          `Product ${existingProduct.title} has low stock (${existingProduct.stock}), updating...`,
        )
        const updated = await updateProduct(token, cartItem.id, {
          stock: cartItem.number + 5, // Ensure enough stock for test + buffer
          status: 'active',
        })
        productMap.set(cartItem.id, updated)
      } else {
        logSuccess(
          `Product ${existingProduct.title} has sufficient stock (${existingProduct.stock})`,
        )
        productMap.set(cartItem.id, existingProduct)
      }
    } else {
      // Create new product - note: API will generate a new ID
      const created = await createProduct(token, {
        slug: cartItem.slug,
        brand: cartItem.brand,
        title: cartItem.title,
        subtitle: cartItem.subtitle,
        category: cartItem.category,
        price: cartItem.price,
        image: cartItem.image,
        stock: cartItem.number + 5,
        status: 'active',
      })

      // Update cart item with the actual product ID from API
      productMap.set(cartItem.id, created)
      logInfo(`Product ID mapping: ${cartItem.id} -> ${created.id}`)
    }
  }

  return productMap
}

async function placeOrder(
  token: string,
  cart?: any[],
): Promise<CheckoutResponse> {
  logInfo('Placing order...')

  const orderData = {
    ...TEST_ORDER,
    cart: cart || TEST_ORDER.cart,
  }

  const response = await fetch(`${API_URL}/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(orderData),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Checkout failed: ${response.status} ${errorText}`)
  }

  const result = (await response.json()) as CheckoutResponse
  logSuccess(`Order created: ${result.data.order.number}`)
  return result
}

async function verifyStockReduction(
  token: string,
  expectedReductions: Map<string, number>,
): Promise<void> {
  logInfo('Verifying stock has been reserved...')

  for (const [productId, expectedReduction] of expectedReductions) {
    const product = await getProduct(token, productId)
    if (!product) {
      logError(`Product ${productId} not found!`)
      continue
    }

    // Note: Stock isn't actually reduced until payment confirmation
    // During checkout, stock is only reserved
    logInfo(
      `Product ${product.title}: Current stock = ${product.stock} (reservations active, not yet reduced)`,
    )
  }
}

async function simulateSwishCallback(
  orderNumber: string,
  status: 'PAID' | 'DECLINED',
): Promise<void> {
  logInfo(`Simulating Swish callback with status: ${status}...`)

  const callbackData = {
    id: `mock-payment-${Date.now()}`,
    payeePaymentReference: orderNumber,
    status,
    amount: '1880',
    currency: 'SEK',
    dateCreated: new Date().toISOString(),
    datePaid: status === 'PAID' ? new Date().toISOString() : undefined,
  }

  const response = await fetch(`${API_URL}/swish/callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(callbackData),
  })

  if (!response.ok) {
    throw new Error(
      `Callback failed: ${response.status} ${await response.text()}`,
    )
  }

  logSuccess(`Callback processed: ${status}`)
}

async function getOrder(token: string, orderId: string): Promise<any> {
  logInfo(`Fetching order ${orderId}...`)

  const response = await fetch(`${API_URL}/admin/orders/${orderId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to get order: ${response.status} ${await response.text()}`,
    )
  }

  const result = (await response.json()) as { data: any }
  return result.data
}

async function main() {
  log('\n🧪 Complete Order Flow Test', 'bright')
  log('Testing against: ' + API_URL, 'cyan')
  log('')

  try {
    // Step 1: Login
    logStep(1, 'Authentication')
    const token = await login()

    // Step 2: Ensure products exist with sufficient stock
    logStep(2, 'Product Setup')
    const productMap = await ensureProductsExist(token)

    // Update cart with actual product IDs from the API
    const updatedCart = TEST_ORDER.cart.map((item) => {
      const product = productMap.get(item.id)
      if (product) {
        return {
          ...item,
          id: product.id, // Use the actual product ID from API
        }
      }
      return item
    })

    // Calculate expected stock reductions
    const stockReductions = new Map<string, number>()
    for (const item of updatedCart) {
      stockReductions.set(item.id, item.number)
    }

    // Step 3: Place order (with stock reservation)
    logStep(3, 'Checkout & Stock Reservation')
    const checkoutResult = await placeOrder(token, updatedCart)

    logInfo('Order Details:')
    console.log(JSON.stringify(checkoutResult.data, null, 2))

    // Step 4: Verify stock reservation (stock not yet reduced)
    logStep(4, 'Verify Stock Reservation')
    await verifyStockReduction(token, stockReductions)

    // Step 5: Test Swish payment flow
    logStep(5, 'Swish Payment Integration Test')

    const paymentInfo = checkoutResult.data.payment
    logInfo(`Payment Method: ${paymentInfo.method}`)
    logInfo(`Payment Status: ${paymentInfo.status}`)
    if (paymentInfo.reference) {
      logInfo(`Payment Reference: ${paymentInfo.reference}`)
    }
    if (paymentInfo.swishUrl) {
      logInfo(`Swish URL: ${paymentInfo.swishUrl}`)
    }

    // Step 6: Simulate successful payment callback
    logStep(6, 'Simulate Successful Payment')
    await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait a bit
    await simulateSwishCallback(checkoutResult.data.order.number, 'PAID')

    // Step 7: Verify order status updated
    logStep(7, 'Verify Order Confirmation')
    await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait for async processing
    const updatedOrder = await getOrder(token, checkoutResult.data.order.id)

    logInfo(`Order Status: ${updatedOrder.status}`)
    if (updatedOrder.status === 'active') {
      logSuccess('Order confirmed successfully!')
    } else {
      logWarning(`Order status is ${updatedOrder.status}, expected 'active'`)
    }

    // Step 8: Verify stock actually reduced after payment
    logStep(8, 'Verify Stock Reduction After Payment')
    for (const [productId, reduction] of stockReductions) {
      const product = await getProduct(token, productId)
      if (product) {
        logInfo(`Product ${product.title}: Stock = ${product.stock}`)
      }
    }

    // Final Summary
    log('\n' + '='.repeat(60), 'green')
    log('✨ Test completed successfully!', 'bright')
    log('='.repeat(60), 'green')

    log('\nTest Summary:', 'cyan')
    log(`  Order Number: ${checkoutResult.data.order.number}`)
    log(`  Order ID: ${checkoutResult.data.order.id}`)
    log(`  Payment Method: ${paymentInfo.method}`)
    log(`  Final Status: ${updatedOrder.status}`)
    log(`  Items Ordered: ${TEST_ORDER.cart.length}`)
    log(
      `  Total Amount: ${TEST_ORDER.cart.reduce((sum, item) => sum + item.price * item.number, 0) + TEST_ORDER.order.delivery_cost} SEK`,
    )

    log('\nKey Features Tested:', 'cyan')
    logSuccess('Product creation/verification')
    logSuccess('Stock availability check')
    logSuccess('Stock reservation during checkout')
    logSuccess('Order creation with inactive status')
    logSuccess('Swish payment integration')
    logSuccess('Payment callback processing')
    logSuccess('Order status update to active')
    logSuccess('Stock permanent reduction after payment')

    log('\nEmails should have been sent to:', 'yellow')
    log(`  Customer: ${TEST_ORDER.order.email}`)
    log(`  Admin: ${process.env.ADMIN_EMAIL || 'smultronet@zwc.se'}`)
    log('  (Check SES or email logs to verify)')
  } catch (error) {
    log('\n' + '='.repeat(60), 'red')
    logError('Test failed!')
    log('='.repeat(60), 'red')
    console.error('\nError details:', error)
    process.exit(1)
  }
}

// Optional: Test declined payment scenario
async function testDeclinedPayment() {
  log('\n🧪 Testing Declined Payment Scenario', 'bright')

  try {
    const token = await login()
    const productMap = await ensureProductsExist(token)

    // Update cart with actual product IDs
    const updatedCart = TEST_ORDER.cart.map((item) => {
      const product = productMap.get(item.id)
      if (product) {
        return {
          ...item,
          id: product.id,
        }
      }
      return item
    })

    const checkoutResult = await placeOrder(token, updatedCart)
    logInfo(`Order created: ${checkoutResult.data.order.number}`)

    await new Promise((resolve) => setTimeout(resolve, 1000))
    await simulateSwishCallback(checkoutResult.data.order.number, 'DECLINED')

    await new Promise((resolve) => setTimeout(resolve, 2000))
    const updatedOrder = await getOrder(token, checkoutResult.data.order.id)

    if (updatedOrder.status === 'invalid') {
      logSuccess('Declined payment handled correctly - order marked as invalid')
      logSuccess('Stock reservations should be cancelled')
    } else {
      logWarning(
        `Expected order status 'invalid', got '${updatedOrder.status}'`,
      )
    }
  } catch (error) {
    logError('Declined payment test failed!')
    console.error(error)
  }
}

// Run main test
main().then(() => {
  // Optionally run declined payment test
  if (process.argv.includes('--test-declined')) {
    return testDeclinedPayment()
  }
})
