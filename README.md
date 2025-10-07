# Smultron E-commerce API

E-commerce REST API built with Bun, AWS Lambda, DynamoDB, and CloudFront.

## Architecture

- **Runtime**: Bun
- **Compute**: AWS Lambda (15 individual functions, one per endpoint)
- **Database**: DynamoDB (3 tables)
- **CDN**: CloudFront (for product listings caching)
- **API Gateway**: REST API (routes to individual Lambda functions)
- **Authentication**: JWT tokens
- **Domain**: smultron.zwc.se
- **Design**: No router - each endpoint is a separate Lambda handler that reuses shared modules

## Features

### Public Endpoints
- List products (cached via CloudFront)
- Get product by ID
- List categories
- Get category by ID
- Create order

### Admin Endpoints (Auth Required)
- Login to get JWT token
- CRUD operations on products
- CRUD operations on categories
- View and manage orders
- Update order status

## Project Structure

```
smultron/
├── src/
│   ├── handlers/          # Individual Lambda handlers (one per endpoint)
│   │   ├── login.ts
│   │   ├── list.products.ts
│   │   ├── get.product.ts
│   │   ├── create.product.ts
│   │   ├── update.product.ts
│   │   ├── delete.product.ts
│   │   ├── list.categories.ts
│   │   ├── get.category.ts
│   │   ├── create.category.ts
│   │   ├── update.category.ts
│   │   ├── delete.category.ts
│   │   ├── create.order.ts
│   │   ├── list.orders.ts
│   │   ├── get.order.ts
│   │   └── update.order.status.ts
│   ├── services/          # Business logic (shared modules)
│   │   ├── dynamodb.ts
│   │   └── product.ts
│   ├── middleware/        # Auth middleware (shared)
│   │   └── auth.ts
│   ├── utils/             # Utilities (shared)
│   │   ├── jwt.ts
│   │   └── response.ts
│   └── types.ts           # TypeScript types
├── infrastructure/        # AWS infrastructure
│   ├── template.yaml      # SAM/CloudFormation template
│   ├── swagger.yaml       # OpenAPI spec
│   ├── docs.html          # Swagger UI
│   ├── deploy.sh          # Deployment script
│   └── deploy-docs.sh     # Docs deployment script
└── tests/                 # Test files

```

## Setup

### Prerequisites
- Bun installed
- AWS CLI configured
- AWS SAM CLI installed
- ACM certificate for smultron.zwc.se
- S3 bucket for deployment artifacts

### Installation

```bash
bun install
```

### Environment Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update `.env` with your values:
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret-key
AWS_REGION=us-east-1
CERTIFICATE_ARN=arn:aws:acm:us-east-1:xxxxx:certificate/xxxxx
S3_DEPLOYMENT_BUCKET=your-deployment-bucket
DOCS_BUCKET=smultron-docs
```

## Development

Run tests:
```bash
bun test
```

Build:
```bash
bun run build
```

## Deployment

### Deploy API

```bash
bun run deploy
```

This will:
1. Build the application
2. Package with SAM
3. Deploy to AWS
4. Create DynamoDB tables
5. Set up API Gateway
6. Configure CloudFront

### Deploy Documentation

```bash
bun run deploy-docs
```

This uploads Swagger documentation to S3.

### Post-Deployment

1. Note the CloudFront Distribution ID from deployment output
2. Create/Update DNS record for smultron.zwc.se pointing to CloudFront
3. Access API at: `https://smultron.zwc.se/api/v1`
4. Access docs at the S3 URL provided (or configure CloudFront for /docs)

Note: Each API endpoint is handled by a dedicated Lambda function for better isolation and independent scaling.

## API Endpoints

### Authentication
```
POST /api/v1/auth/login
```

### Products (Public listing, Admin for modifications)
```
GET    /api/v1/products
GET    /api/v1/products/{id}
POST   /api/v1/products          (Auth required)
PUT    /api/v1/products/{id}     (Auth required)
DELETE /api/v1/products/{id}     (Auth required)
```

### Categories
```
GET    /api/v1/categories
GET    /api/v1/categories/{id}
POST   /api/v1/categories        (Auth required)
PUT    /api/v1/categories/{id}   (Auth required)
DELETE /api/v1/categories/{id}   (Auth required)
```

### Orders
```
POST   /api/v1/orders            (Public - create order)
GET    /api/v1/orders            (Auth required)
GET    /api/v1/orders/{id}       (Auth required)
PUT    /api/v1/orders/{id}/status (Auth required)
```

## Authentication

1. Login with admin credentials:
```bash
curl -X POST https://smultron.zwc.se/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```

2. Use returned JWT token in subsequent requests:
```bash
curl https://smultron.zwc.se/api/v1/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Product","description":"Desc","price":99.99,"categoryId":"cat-1","stock":10}'
```

## Testing

All handlers have tests. Run with:
```bash
bun test
```

Tests cover:
- JWT generation and verification
- Response utilities
- Auth middleware
- All handler authentication
- Input validation
- Error handling

## CloudFront Caching

Product listing endpoints are cached via CloudFront:
- Cache TTL: 1 hour (3600s)
- Max TTL: 24 hours
- Only GET requests cached
- Admin operations bypass cache

To invalidate cache after product updates:
```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/api/v1/products*"
```install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.23. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
