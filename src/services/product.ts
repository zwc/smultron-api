import type {
  Product,
  Category,
  Order,
  OrderInformation,
  OrderCartItem,
} from '../types'
import * as db from './dynamodb'

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE || 'smultron-products'
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE || 'smultron-categories'
const ORDERS_TABLE = process.env.ORDERS_TABLE || 'smultron-orders'

export const createProduct = (
  data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
    slug?: string
    status?: 'active' | 'inactive'
  },
): Product => {
  const now = new Date().toISOString()

  const legacyData = data as typeof data & { categorySlug?: string }
  const category = legacyData.category || legacyData.categorySlug || ''

  // Generate GUID for id
  const id = crypto.randomUUID()

  // Use provided slug or auto-generate from category and title
  const slug =
    legacyData.slug ||
    (() => {
      const slugBase = category
        ? `${category}-${legacyData.title}`
        : legacyData.title
      return slugBase.toLowerCase().replace(/\s+/g, '-')
    })()

  // Remove slug, category, and legacy categorySlug from restData to set them explicitly
  const {
    slug: _slug,
    category: _category,
    categorySlug: _categorySlug,
    ...restData
  } = legacyData

  return {
    // Default values for optional fields
    article: restData.article || '',
    price_reduced: restData.price_reduced ?? 0,
    description: restData.description || [],
    tag: restData.tag || '',
    index: restData.index ?? 0,
    max_order: restData.max_order ?? 999,
    image: restData.image || '',
    images: restData.images || [],
    // Required and computed fields
    id,
    slug,
    category,
    ...restData,
    status: data.status || 'active',
    createdAt: now,
    updatedAt: now,
  }
}

export const saveProduct = async (product: Product): Promise<void> => {
  await db.putItem(PRODUCTS_TABLE, product)
}

export const getProduct = async (id: string): Promise<Product | null> => {
  return await db.getItem<Product>(PRODUCTS_TABLE, { id })
}

export const getAllProducts = async (): Promise<Product[]> => {
  return await db.scanTable<Product>(PRODUCTS_TABLE)
}

export const getActiveProducts = async (): Promise<Product[]> => {
  let products: Product[]

  try {
    // Try to use GSI for better performance
    products = await db.queryItems<Product>(
      PRODUCTS_TABLE,
      'StatusIndex',
      '#status = :status',
      { ':status': 'active' },
      { '#status': 'status' },
    )
  } catch (error) {
    // Fall back to scanning all products if GSI is not available
    console.warn('StatusIndex GSI not available, falling back to table scan')
    const allProducts = await getAllProducts()
    products = allProducts.filter((p) => p.status === 'active')
  }

  // Sort products alphabetically by title
  return products.sort((a, b) => {
    const aTitle = a.title.toLowerCase()
    const bTitle = b.title.toLowerCase()
    if (aTitle < bTitle) return -1
    if (aTitle > bTitle) return 1
    return 0
  })
}

export const updateProduct = async (
  id: string,
  updates: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<Product> => {
  const updateParts: string[] = []
  const attributeValues: Record<string, any> = {}
  const attributeNames: Record<string, string> = {}

  // Add updatedAt timestamp
  const now = new Date().toISOString()
  const allUpdates = { ...updates, updatedAt: now }

  Object.entries(allUpdates).forEach(([key, value], index) => {
    const attrName = `#attr${index}`
    const attrValue = `:val${index}`
    updateParts.push(`${attrName} = ${attrValue}`)
    attributeNames[attrName] = key
    attributeValues[attrValue] = value
  })

  const updateExpression = `SET ${updateParts.join(', ')}`

  return await db.updateItem<Product>(
    PRODUCTS_TABLE,
    { id },
    updateExpression,
    attributeValues,
    attributeNames,
  )
}

export const updateProductIndex = async (
  id: string,
  index: number,
): Promise<void> => {
  const now = new Date().toISOString()
  await db.updateItem(
    PRODUCTS_TABLE,
    { id },
    'SET #index = :index, #updatedAt = :updatedAt',
    {
      ':index': index,
      ':updatedAt': now,
    },
    {
      '#index': 'index',
      '#updatedAt': 'updatedAt',
    },
  )
}

export const updateProductStock = async (
  id: string,
  stockChange: number,
): Promise<void> => {
  const now = new Date().toISOString()

  // Use atomic update to increment/decrement stock
  await db.updateItem(
    PRODUCTS_TABLE,
    { id },
    'SET #stock = #stock + :change, #updatedAt = :updatedAt',
    {
      ':change': stockChange,
      ':updatedAt': now,
    },
    {
      '#stock': 'stock',
      '#updatedAt': 'updatedAt',
    },
  )
}

export const deleteProduct = async (id: string): Promise<void> => {
  await db.deleteItem(PRODUCTS_TABLE, { id })
}

export const createCategory = (
  data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>,
): Category => {
  // Generate GUID for id
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  return {
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  }
}

export const saveCategory = async (category: Category): Promise<void> => {
  await db.putItem(CATEGORIES_TABLE, category)
}

export const getCategory = async (id: string): Promise<Category | null> => {
  return await db.getItem<Category>(CATEGORIES_TABLE, { id })
}

export const getAllCategories = async (
  status?: 'active' | 'inactive',
): Promise<Category[]> => {
  let categories: Category[]

  if (status) {
    // Query using StatusIndex GSI for better performance
    try {
      categories = await db.queryItems<Category>(
        CATEGORIES_TABLE,
        'StatusIndex',
        '#status = :status',
        { ':status': status },
        { '#status': 'status' },
      )
    } catch (error) {
      // Fallback to scan if GSI is not yet available (during deployment)
      console.warn('StatusIndex not available, falling back to scan', error)
      const allCategories = await db.scanTable<Category>(CATEGORIES_TABLE)
      categories = allCategories.filter((c) => c.status === status)
    }
  } else {
    // Get all categories (for admin without filter)
    categories = await db.scanTable<Category>(CATEGORIES_TABLE)
  }

  // Sort categories alphabetically by title
  return categories.sort((a, b) => {
    const aTitle = a.title.toLowerCase()
    const bTitle = b.title.toLowerCase()
    if (aTitle < bTitle) return -1
    if (aTitle > bTitle) return 1
    return 0
  })
}

export const updateCategory = async (
  id: string,
  updates: Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<Category> => {
  const updateParts: string[] = []
  const attributeValues: Record<string, any> = {}
  const attributeNames: Record<string, string> = {}

  // Add updatedAt timestamp
  const now = new Date().toISOString()
  const allUpdates = { ...updates, updatedAt: now }

  Object.entries(allUpdates).forEach(([key, value], index) => {
    const attrName = `#attr${index}`
    const attrValue = `:val${index}`
    updateParts.push(`${attrName} = ${attrValue}`)
    attributeNames[attrName] = key
    attributeValues[attrValue] = value
  })

  const updateExpression = `SET ${updateParts.join(', ')}`

  return await db.updateItem<Category>(
    CATEGORIES_TABLE,
    { id },
    updateExpression,
    attributeValues,
    attributeNames,
  )
}

export const updateCategoryIndex = async (
  id: string,
  index: number,
): Promise<void> => {
  await db.updateItem(
    CATEGORIES_TABLE,
    { id },
    'SET #index = :index',
    {
      ':index': index,
    },
    {
      '#index': 'index',
    },
  )
}

export const deleteCategory = async (id: string): Promise<void> => {
  await db.deleteItem(CATEGORIES_TABLE, { id })
}

// Order functions
export const saveOrder = async (order: Order): Promise<void> => {
  await db.putItem(ORDERS_TABLE, order)
}

export const getOrder = async (id: string): Promise<Order | null> => {
  return await db.getItem<Order>(ORDERS_TABLE, { id })
}

export const getAllOrders = async (
  status?: 'pending' | 'unpaid' | 'active' | 'inactive' | 'invalid',
): Promise<Order[]> => {
  if (status) {
    try {
      // Use GSI for efficient query when filtering by status
      return await db.queryItems<Order>(
        ORDERS_TABLE,
        'StatusIndex',
        '#status = :status',
        { ':status': status },
        { '#status': 'status' },
      )
    } catch (error) {
      // Fall back to scanning and filtering if GSI is not available
      console.warn(
        'StatusIndex GSI not available for orders, falling back to table scan with filtering',
      )
      const allOrders = await db.scanTable<any>(ORDERS_TABLE)
      return allOrders.filter((item) => item.status === status)
    }
  }
  // No status filter: get all real orders (exclude internal counter items which
  // have no status field and live in the same table for atomic number generation)
  const allItems = await db.scanTable<any>(ORDERS_TABLE)
  return allItems.filter((item) =>
    ['pending', 'unpaid', 'inactive', 'active', 'invalid'].includes(item.status),
  )
}

// Generate a sequential numeric order ID used as the Swish payeePaymentReference.
// Swish requires a short alphanumeric reference; a sequential integer satisfies
// this and lets the callback look up the order directly by id without a GSI.
// The counter item has no `status` field so it is excluded from order queries.

// Fiscal year for order-number counters: starts July 1st each calendar year.
// July–December of year Y and January–June of year Y+1 share counter key "Y".
const getFiscalYear = (date: Date): string => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1–12
  const fiscalYear = month >= 7 ? year : year - 1
  return fiscalYear.toString().slice(-2)
}

// Generate order number in format YYMM.ZZZ (e.g. "2605.001").
// The dot-separated format clearly distinguishes the date prefix from the
// annual sequence, making it easy to read on invoices and in email.
// Uses an atomic DynamoDB counter so concurrent payment confirmations never
// receive the same number and the sequence never has gaps from unpaid orders.
// The counter resets on July 1st each year (fiscal year boundary).
// Counter items are stored in the orders table with a special id prefix and
// no `status` field so they are excluded from all order queries.
const generateOrderNumber = async (): Promise<string> => {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2) // Last 2 digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, '0') // Month with leading zero
  const prefix = `${year}${month}`

  // Counter key is shared across all months in the same fiscal year so the
  // sequence is continuous from July 1st and resets the following July 1st.
  const fiscalYearKey = getFiscalYear(now)
  const counterKey = { id: `__order_counter_${fiscalYearKey}__` }
  const seq = await db.atomicIncrement(ORDERS_TABLE, counterKey, 'seq')

  const orderNumber = `${prefix}.${seq.toString().padStart(3, '0')}`
  console.log('Generated order number:', orderNumber)
  return orderNumber
}

/**
 * Assigns an order number to an existing order after payment has been confirmed.
 * This is the only place where order numbers are created — never at checkout time.
 * Returns the assigned order number.
 */
export const assignOrderNumber = async (orderId: string): Promise<string> => {
  const number = await generateOrderNumber()
  const now = new Date().toISOString()

  // Write the number directly so updateOrder's type constraint (which excludes
  // `number`) does not prevent us from setting this field.
  await db.updateItem<Order>(
    ORDERS_TABLE,
    { id: orderId },
    'SET #number = :number, #updatedAt = :updatedAt',
    { ':number': number, ':updatedAt': now },
    { '#number': 'number', '#updatedAt': 'updatedAt' },
  )

  console.log('Order number assigned:', orderId, '->', number)
  return number
}

export const createOrder = async (
  information: OrderInformation,
  cart: Array<{ id: string; number: number }>,
  delivery: string,
  delivery_cost: number,
  orderId?: string,
): Promise<Order> => {
  const now = new Date()
  const timestamp = now.getTime()
  const isoString = now.toISOString()

  // Generate a UUID as the internal partition key. The order number is intentionally
  // NOT assigned here — it is only assigned in assignOrderNumber() once payment is
  // confirmed, so the sequential order-number series never has gaps from unpaid checkouts.
  const id = crypto.randomUUID()

  // Freeze product data from cart - copy full product details
  console.log('Freezing product data for', cart.length, 'items...')
  const frozenCart: OrderCartItem[] = await Promise.all(
    cart.map(async (item) => {
      const product = await getProduct(item.id)
      if (!product) {
        throw new Error(`Product ${item.id} not found`)
      }

      console.log('Frozen product:', product.id, product.title)

      return {
        id: product.id,
        number: item.number,
        // Freeze all product data
        slug: product.slug,
        category: product.category,
        article: product.article,
        brand: product.brand,
        title: product.title,
        subtitle: product.subtitle,
        price: product.price,
        price_reduced: product.price_reduced,
        description: product.description,
        tag: product.tag,
        image: product.image,
        images: product.images,
      }
    }),
  )

  return {
    id,
    orderId,
    number: null, // Assigned only after payment is confirmed
    date: timestamp,
    date_change: timestamp,
    status: 'pending', // awaiting payment
    delivery,
    delivery_cost,
    information,
    cart: frozenCart,
    createdAt: isoString,
    updatedAt: isoString,
  }
}

export const getOrderByNumber = async (
  orderNumber: string,
): Promise<Order | null> => {
  // Since we don't have a GSI on order number, we need to scan
  const allOrders = await db.scanTable<Order>(ORDERS_TABLE)
  return allOrders.find((order) => order.number === orderNumber) || null
}

export const updateOrder = async (
  id: string,
  updates: Partial<Omit<Order, 'id' | 'number' | 'createdAt'>>,
): Promise<Order> => {
  const updateParts: string[] = []
  const attributeValues: Record<string, any> = {}
  const attributeNames: Record<string, string> = {}

  // Add updatedAt timestamp
  const now = new Date().toISOString()
  const timestamp = new Date().getTime()
  const allUpdates = {
    ...updates,
    updatedAt: now,
    date_change: timestamp,
  }

  Object.entries(allUpdates).forEach(([key, value], index) => {
    const attrName = `#attr${index}`
    const attrValue = `:val${index}`
    updateParts.push(`${attrName} = ${attrValue}`)
    attributeNames[attrName] = key
    attributeValues[attrValue] = value
  })

  const updateExpression = `SET ${updateParts.join(', ')}`

  return await db.updateItem<Order>(
    ORDERS_TABLE,
    { id },
    updateExpression,
    attributeValues,
    attributeNames,
  )
}

export const updateOrderStatus = async (
  id: string,
  status: Order['status'],
): Promise<Order> => {
  const now = new Date()
  return await db.updateItem<Order>(
    ORDERS_TABLE,
    { id },
    'SET #status = :status, #date_change = :date_change, #updatedAt = :updatedAt',
    {
      ':status': status,
      ':date_change': now.getTime(),
      ':updatedAt': now.toISOString(),
    },
    {
      '#status': 'status',
      '#date_change': 'date_change',
      '#updatedAt': 'updatedAt',
    },
  )
}

export const adminGetProducts = async (options: {
  status?: 'active' | 'inactive'
  searchQuery?: string
  sortField: string
  limit: number
  offset: number
}): Promise<{ items: Product[]; total: number }> => {
  let products: Product[]

  try {
    // If filtering by status, use GSI for efficient query
    if (options.status) {
      products = await db.queryItems<Product>(
        PRODUCTS_TABLE,
        'StatusIndex',
        '#status = :status',
        { ':status': options.status },
        { '#status': 'status' },
      )
    } else {
      // No status filter: get all products
      products = await getAllProducts()
    }
  } catch (error) {
    // Fall back to scanning all products if GSI is not available
    console.warn(
      'StatusIndex GSI not available, falling back to table scan with filtering',
    )
    const allProducts = await getAllProducts()

    if (options.status) {
      products = allProducts.filter((p) => p.status === options.status)
    } else {
      products = allProducts
    }
  }

  // Apply search query (search in title, subtitle, brand, description)
  if (options.searchQuery) {
    const query = options.searchQuery.toLowerCase()
    products = products.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.subtitle.toLowerCase().includes(query) ||
        p.brand.toLowerCase().includes(query),
    )
  }

  // Sort products
  const sortField = options.sortField.startsWith('-')
    ? options.sortField.substring(1)
    : options.sortField
  const sortDirection = options.sortField.startsWith('-') ? -1 : 1

  products.sort((a, b) => {
    let aVal: any, bVal: any

    if (sortField === 'createdAt' || sortField === 'updatedAt') {
      aVal = a[sortField]
      bVal = b[sortField]
    } else if (sortField === 'title') {
      aVal = a.title.toLowerCase()
      bVal = b.title.toLowerCase()
    } else if (sortField === 'index') {
      aVal = a.index
      bVal = b.index
    } else {
      aVal = a.id
      bVal = b.id
    }

    if (aVal < bVal) return -1 * sortDirection
    if (aVal > bVal) return 1 * sortDirection
    return 0
  })

  const total = products.length
  const items = products.slice(options.offset, options.offset + options.limit)

  return { items, total }
}
