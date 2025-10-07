# Available Commands

## Development

### Install Dependencies
```bash
bun install
```

### Run Tests
```bash
bun test
```
Runs all 39 tests across 8 test files.

### Build Application
```bash
bun run build
```
Builds the application to `./dist` directory.

### Watch Mode (Development)
```bash
bun run dev
```
Runs the application with auto-reload on file changes.

## Deployment

### Deploy API to AWS
```bash
bun run deploy
```
Executes `infrastructure/deploy.sh`:
- Builds application
- Packages with SAM
- Deploys CloudFormation stack
- Creates all AWS resources

### Deploy Documentation
```bash
bun run deploy-docs
```
Executes `infrastructure/deploy-docs.sh`:
- Creates/configures S3 bucket
- Uploads Swagger UI
- Uploads OpenAPI spec

## AWS Commands

### View Lambda Logs
```bash
sam logs -n smultron-api --stack-name smultron-api --tail
```

### View All Logs
```bash
sam logs -n smultron-api --stack-name smultron-api
```

### List DynamoDB Tables
```bash
aws dynamodb list-tables | grep smultron
```

### Scan Products Table
```bash
aws dynamodb scan --table-name smultron-products
```

### Scan Categories Table
```bash
aws dynamodb scan --table-name smultron-categories
```

### Scan Orders Table
```bash
aws dynamodb scan --table-name smultron-orders
```

### Invalidate CloudFront Cache
```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/api/v1/products*"
```

### Get Stack Outputs
```bash
aws cloudformation describe-stacks \
  --stack-name smultron-api \
  --query 'Stacks[0].Outputs' \
  --output table
```

### Delete Stack (Cleanup)
```bash
aws cloudformation delete-stack --stack-name smultron-api
```

## API Testing Commands

### Login
```bash
curl -X POST https://smultron.zwc.se/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-password"
  }'
```

### List Products (Public)
```bash
curl https://smultron.zwc.se/api/v1/products
```

### Get Product by ID (Public)
```bash
curl https://smultron.zwc.se/api/v1/products/product-123
```

### Create Product (Admin)
```bash
TOKEN="your-jwt-token"

curl -X POST https://smultron.zwc.se/api/v1/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Laptop",
    "description": "High-performance laptop",
    "price": 999.99,
    "categoryId": "category-123",
    "stock": 10
  }'
```

### Update Product (Admin)
```bash
TOKEN="your-jwt-token"

curl -X PUT https://smultron.zwc.se/api/v1/products/product-123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Updated Laptop",
    "price": 899.99
  }'
```

### Delete Product (Admin)
```bash
TOKEN="your-jwt-token"

curl -X DELETE https://smultron.zwc.se/api/v1/products/product-123 \
  -H "Authorization: Bearer $TOKEN"
```

### List Categories (Public)
```bash
curl https://smultron.zwc.se/api/v1/categories
```

### Create Category (Admin)
```bash
TOKEN="your-jwt-token"

curl -X POST https://smultron.zwc.se/api/v1/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Electronics",
    "description": "Electronic devices and accessories"
  }'
```

### Update Category (Admin)
```bash
TOKEN="your-jwt-token"

curl -X PUT https://smultron.zwc.se/api/v1/categories/category-123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Updated Electronics"
  }'
```

### Delete Category (Admin)
```bash
TOKEN="your-jwt-token"

curl -X DELETE https://smultron.zwc.se/api/v1/categories/category-123 \
  -H "Authorization: Bearer $TOKEN"
```

### Create Order (Public)
```bash
curl -X POST https://smultron.zwc.se/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "product-123",
        "quantity": 2,
        "price": 999.99
      }
    ],
    "total": 1999.98,
    "customerEmail": "customer@example.com",
    "customerName": "John Doe"
  }'
```

### List Orders (Admin)
```bash
TOKEN="your-jwt-token"

curl https://smultron.zwc.se/api/v1/orders \
  -H "Authorization: Bearer $TOKEN"
```

### Get Order by ID (Admin)
```bash
TOKEN="your-jwt-token"

curl https://smultron.zwc.se/api/v1/orders/order-123 \
  -H "Authorization: Bearer $TOKEN"
```

### Update Order Status (Admin)
```bash
TOKEN="your-jwt-token"

curl -X PUT https://smultron.zwc.se/api/v1/orders/order-123/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "confirmed"
  }'
```

## Utility Commands

### Check Node/Bun Version
```bash
bun --version
```

### Check AWS CLI Configuration
```bash
aws sts get-caller-identity
```

### Check SAM CLI Version
```bash
sam --version
```

### Format All TypeScript Files (if prettier installed)
```bash
bun x prettier --write "src/**/*.ts" "tests/**/*.ts"
```

### Type Check
```bash
bun x tsc --noEmit
```

## Monitoring Commands

### Watch Lambda Metrics
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=smultron-api \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### Check DynamoDB Table Status
```bash
aws dynamodb describe-table --table-name smultron-products \
  --query 'Table.TableStatus'
```

### Get API Gateway Stage Info
```bash
aws apigateway get-stages \
  --rest-api-id YOUR_API_ID
```

## Environment Commands

### View Current Environment Variables
```bash
cat .env
```

### Generate Random JWT Secret
```bash
openssl rand -base64 32
```

### Generate Random Password
```bash
openssl rand -base64 16
```

## Quick Test Script
Save this as `test-api.sh`:
```bash
#!/bin/bash

API_URL="https://smultron.zwc.se/api/v1"

echo "1. Testing login..."
TOKEN=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"'$ADMIN_PASSWORD'"}' \
  | jq -r '.token')

echo "Token: $TOKEN"

echo "2. Testing list products..."
curl -s $API_URL/products | jq

echo "3. Testing create category..."
curl -s -X POST $API_URL/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test","description":"Test category"}' | jq

echo "Done!"
```

Make it executable:
```bash
chmod +x test-api.sh
./test-api.sh
```
