# Smultron API Architecture Diagram

## Request Flow

```
Client Request
      ↓
CloudFront (CDN)
      ↓
API Gateway
      ↓
[Route Mapping]
      ↓
┌─────────────────────────────────────────────────────────────┐
│                   Individual Lambda Functions                │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │   Login    │  │List Products│ │Get Product │  ...      │
│  │ Handler    │  │  Handler    │  │  Handler   │           │
│  └─────┬──────┘  └─────┬───────┘  └─────┬──────┘           │
│        │               │                 │                  │
│        └───────────────┼─────────────────┘                  │
│                        ↓                                    │
│              ┌─────────────────────┐                        │
│              │   Shared Modules    │                        │
│              │                     │                        │
│              │  • Services         │                        │
│              │    - dynamodb.ts    │                        │
│              │    - product.ts     │                        │
│              │                     │                        │
│              │  • Middleware       │                        │
│              │    - auth.ts        │                        │
│              │                     │                        │
│              │  • Utils            │                        │
│              │    - jwt.ts         │                        │
│              │    - response.ts    │                        │
│              └──────────┬──────────┘                        │
└─────────────────────────┼───────────────────────────────────┘
                          ↓
                  ┌───────────────┐
                  │   DynamoDB    │
                  │               │
                  │  • Products   │
                  │  • Categories │
                  │  • Orders     │
                  └───────────────┘
```

## Handler to Endpoint Mapping

```
PUBLIC ENDPOINTS (No Auth)
┌──────────────────────┬─────────────────────────┬────────────────────────┐
│ HTTP Method          │ Endpoint                │ Lambda Handler         │
├──────────────────────┼─────────────────────────┼────────────────────────┤
│ POST                 │ /auth/login             │ login.ts               │
│ GET                  │ /products               │ list.products.ts       │
│ GET                  │ /products/{id}          │ get.product.ts         │
│ GET                  │ /categories             │ list.categories.ts     │
│ GET                  │ /categories/{id}        │ get.category.ts        │
│ POST                 │ /orders                 │ create.order.ts        │
└──────────────────────┴─────────────────────────┴────────────────────────┘

ADMIN ENDPOINTS (Auth Required)
┌──────────────────────┬─────────────────────────┬────────────────────────┐
│ HTTP Method          │ Endpoint                │ Lambda Handler         │
├──────────────────────┼─────────────────────────┼────────────────────────┤
│ POST                 │ /products               │ create.product.ts      │
│ PUT                  │ /products/{id}          │ update.product.ts      │
│ DELETE               │ /products/{id}          │ delete.product.ts      │
│ POST                 │ /categories             │ create.category.ts     │
│ PUT                  │ /categories/{id}        │ update.category.ts     │
│ DELETE               │ /categories/{id}        │ delete.category.ts     │
│ GET                  │ /orders                 │ list.orders.ts         │
│ GET                  │ /orders/{id}            │ get.order.ts           │
│ PUT                  │ /orders/{id}/status     │ update.order.status.ts │
└──────────────────────┴─────────────────────────┴────────────────────────┘
```

## Module Reuse Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Handler Example                               │
│                                                                      │
│  get.product.ts                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ import { getProduct } from '../services/product'              │  │
│  │ import { successResponse, errorResponse } from '../utils'     │  │
│  │                                                                │  │
│  │ export const handler = async (event) => {                     │  │
│  │   const product = await getProduct(id);                       │  │
│  │   return successResponse(product);                            │  │
│  │ }                                                              │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ↓ Uses shared modules ↓                                             │
│                                                                      │
│  Services (Business Logic)        Utils (Helpers)                    │
│  ┌─────────────────────┐         ┌──────────────────┐              │
│  │ product.ts          │         │ jwt.ts           │              │
│  │ - createProduct()   │         │ - generateToken()│              │
│  │ - getProduct()      │         │ - verifyToken()  │              │
│  │ - updateProduct()   │         │                  │              │
│  │ - deleteProduct()   │         │ response.ts      │              │
│  │                     │         │ - successResponse│              │
│  │ dynamodb.ts         │         │ - errorResponse  │              │
│  │ - putItem()         │         └──────────────────┘              │
│  │ - getItem()         │                                           │
│  │ - scanTable()       │         Middleware                        │
│  │ - updateItem()      │         ┌──────────────────┐              │
│  └─────────────────────┘         │ auth.ts          │              │
│                                  │ - verifyAuthToken│              │
│                                  └──────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

## Deployment Structure

```
AWS CloudFormation Stack: smultron-api
│
├─ DynamoDB Tables (3)
│  ├─ smultron-products
│  ├─ smultron-categories
│  └─ smultron-orders
│
├─ Lambda Functions (15)
│  ├─ smultron-login
│  ├─ smultron-list-products
│  ├─ smultron-get-product
│  ├─ smultron-create-product
│  ├─ smultron-update-product
│  ├─ smultron-delete-product
│  ├─ smultron-list-categories
│  ├─ smultron-get-category
│  ├─ smultron-create-category
│  ├─ smultron-update-category
│  ├─ smultron-delete-category
│  ├─ smultron-create-order
│  ├─ smultron-list-orders
│  ├─ smultron-get-order
│  └─ smultron-update-order-status
│
├─ API Gateway
│  └─ REST API: smultron-api
│     └─ Routes to individual Lambda functions
│
└─ CloudFront Distribution
   └─ Caches GET /products endpoints
   └─ Points to: smultron.zwc.se
```

## Benefits of This Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    Individual Handlers                          │
├────────────────────────────────────────────────────────────────┤
│ ✓ Single Responsibility    Each handler does one thing         │
│ ✓ Independent Scaling      Scale based on endpoint usage       │
│ ✓ Better Monitoring        Separate CloudWatch logs            │
│ ✓ Granular Permissions     Only required DynamoDB access       │
│ ✓ Smaller Cold Starts      Less code per function              │
│ ✓ Easy Debugging           Isolated error tracking             │
│ ✓ Clear Structure          File names match endpoints          │
│ ✓ Module Reuse             Shared logic via imports            │
│ ✓ No Router Overhead       Direct API Gateway → Lambda         │
│ ✓ Functional Programming   Pure functions, no classes          │
└────────────────────────────────────────────────────────────────┘
```
