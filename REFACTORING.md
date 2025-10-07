# Architecture Refactoring: Individual Lambda Handlers

## Changes Made

### Before: Router-Based Architecture
- Single `router.ts` file handling all routes
- Old handler files grouped by resource (auth.ts, products.ts, categories.ts, orders.ts)
- One Lambda function routing all requests

### After: Individual Handler Architecture
- 15 separate handler files, one per API endpoint
- No router needed - API Gateway routes directly to specific Lambda functions
- Each Lambda function is independent and focused on a single operation

## Handler Files Created

### Authentication (1 handler)
- `login.ts` - POST /auth/login

### Products (5 handlers)
- `list.products.ts` - GET /products
- `get.product.ts` - GET /products/{id}
- `create.product.ts` - POST /products (auth required)
- `update.product.ts` - PUT /products/{id} (auth required)
- `delete.product.ts` - DELETE /products/{id} (auth required)

### Categories (5 handlers)
- `list.categories.ts` - GET /categories
- `get.category.ts` - GET /categories/{id}
- `create.category.ts` - POST /categories (auth required)
- `update.category.ts` - PUT /categories/{id} (auth required)
- `delete.category.ts` - DELETE /categories/{id} (auth required)

### Orders (4 handlers)
- `create.order.ts` - POST /orders
- `list.orders.ts` - GET /orders (auth required)
- `get.order.ts` - GET /orders/{id} (auth required)
- `update.order.status.ts` - PUT /orders/{id}/status (auth required)

## Shared Modules (Reused by Handlers)

All handlers reuse functionality through shared modules:

### Services (`src/services/`)
- `dynamodb.ts` - DynamoDB operations (put, get, delete, scan, query, update)
- `product.ts` - Business logic for products, categories, and orders

### Middleware (`src/middleware/`)
- `auth.ts` - JWT token verification

### Utils (`src/utils/`)
- `jwt.ts` - JWT generation and verification
- `response.ts` - Standardized API response formatting

### Types (`src/types.ts`)
- Type definitions for Product, Category, Order, etc.

## Benefits

1. **Separation of Concerns**: Each handler has a single responsibility
2. **Independent Scaling**: Each Lambda can scale independently based on usage
3. **Better Monitoring**: Separate CloudWatch logs per function
4. **Smaller Packages**: Each Lambda only includes what it needs
5. **Easier Testing**: Test individual handlers in isolation
6. **Clear Boundaries**: Easy to see which handler handles which endpoint
7. **No Router Logic**: API Gateway handles routing to specific functions

## Infrastructure Changes

Updated `infrastructure/template.yaml`:
- Removed single `ApiFunction`
- Added 15 separate Lambda function definitions:
  - LoginFunction
  - ListProductsFunction
  - GetProductFunction
  - CreateProductFunction
  - UpdateProductFunction
  - DeleteProductFunction
  - ListCategoriesFunction
  - GetCategoryFunction
  - CreateCategoryFunction
  - UpdateCategoryFunction
  - DeleteCategoryFunction
  - CreateOrderFunction
  - ListOrdersFunction
  - GetOrderFunction
  - UpdateOrderStatusFunction

Each function:
- Has its own name (e.g., `smultron-list-products`)
- Specifies only required DynamoDB permissions
- Maps to a specific API Gateway route
- Exports its handler from `index.ts`

## Code Reuse Pattern

Each handler follows this pattern:

```typescript
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { /* shared services */ } from '../services/product';
import { /* shared utils */ } from '../utils/response';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  // Handler-specific logic using shared modules
};
```

## Test Updates

- Updated all test imports to reference new handler files
- All 39 tests still passing
- No test logic changes needed

## Removed Files

- `src/handlers/auth.ts` (split into `login.ts`)
- `src/handlers/products.ts` (split into 5 handlers)
- `src/handlers/categories.ts` (split into 5 handlers)
- `src/handlers/orders.ts` (split into 4 handlers)
- `src/router.ts` (no longer needed)

## Build Output

Build still produces single `index.js` with all handlers exported:
```
Bundled 236 modules in 25ms
index.js  1.23 MB
```

## Deployment

No changes to deployment process:
```bash
bun test          # All tests pass
bun run build     # Build succeeds
bun run deploy    # Deploys 15 Lambda functions
```

Each Lambda function will appear separately in AWS Console, making monitoring and debugging easier.
