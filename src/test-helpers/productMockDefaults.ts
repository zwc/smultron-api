/**
 * Complete default mock for ../services/product.
 *
 * Bun's ESM engine fixes the set of named live-binding exports the FIRST TIME
 * a module is mocked in a process. Every subsequent mock.module call for the
 * same path can only UPDATE existing binding values — it cannot ADD new names.
 * If a test file omits an export that a later test's handler statically imports,
 * Bun throws "Export named '…' not found".
 *
 * Solution: every mock.module('../services/product', …) call must spread this
 * object so that ALL 25 exports are always present in the binding list, then
 * override only the specific functions the test file needs to spy on.
 */
export const productMockDefaults = {
  // Product CRUD
  createProduct: () => ({}),
  saveProduct: async () => undefined,
  getProduct: async () => null,
  getAllProducts: async () => [],
  getActiveProducts: async () => [],
  updateProduct: async () => ({}),
  updateProductIndex: async () => undefined,
  updateProductStock: async () => undefined,
  deleteProduct: async () => undefined,

  // Category CRUD
  createCategory: () => ({}),
  saveCategory: async () => undefined,
  getCategory: async () => null,
  getAllCategories: async () => [],
  updateCategory: async () => ({}),
  updateCategoryIndex: async () => undefined,
  deleteCategory: async () => undefined,

  // Order CRUD
  saveOrder: async () => undefined,
  getOrder: async () => null,
  getAllOrders: async () => [],
  assignOrderNumber: async () => '',
  createOrder: async () => ({}),
  getOrderByNumber: async () => null,
  updateOrder: async () => ({}),
  updateOrderStatus: async () => ({}),

  // Admin
  adminGetProducts: async () => ({ items: [] as any[], total: 0 }),
} as const
