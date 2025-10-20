# Quick Start Deployment Guide

## Prerequisites Checklist

- [ ] Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] AWS SAM CLI installed (`pip install aws-sam-cli`)
- [ ] ACM certificate created for smultron.zwc.se in us-east-1
- [ ] S3 bucket created for deployment artifacts

## Step-by-Step Deployment

### 1. Install Dependencies
```bash
bun install
```

### 2. Run Tests
```bash
bun test
```
All 39 tests should pass.

### 3. Create .env File
```bash
cp .env.example .env
```

Edit `.env` and add your values:
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourSecurePassword123!
JWT_SECRET=your-very-long-random-secret-key-here
AWS_REGION=us-east-1
CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/abc-123
S3_DEPLOYMENT_BUCKET=my-deployment-bucket
DOCS_BUCKET=smultron-docs
```

### 4. Create S3 Deployment Bucket (if not exists)
```bash
aws s3 mb s3://my-deployment-bucket --region us-east-1
```

### 5. Deploy API
```bash
bun run deploy
```

This will:
- Build the application
- Create DynamoDB tables (smultron-products, smultron-categories, smultron-orders)
- Deploy Lambda function
- Create API Gateway
- Set up CloudFront distribution

### 6. Get Deployment Outputs
The deploy script will display:
- API Gateway URL
- CloudFront URL
- CloudFront Distribution ID

### 7. Update DNS
Create a CNAME or ALIAS record:
- Name: `smultron.zwc.se`
- Type: CNAME (or ALIAS if Route53)
- Value: `<cloudfront-domain>.cloudfront.net`

### 8. Deploy Documentation (Optional)
```bash
bun run deploy-docs
```

### 9. Test API

#### Login as Admin
```bash
curl -X POST https://smultron.zwc.se/api/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YourSecurePassword123!"}'
```

Save the returned token.

#### Create a Category (Admin)
```bash
TOKEN="your-jwt-token-here"

curl -X POST https://smultron.zwc.se/api/v1/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Electronics",
    "description": "Electronic devices and accessories"
  }'
```

#### Create a Product (Admin)
```bash
curl -X POST https://smultron.zwc.se/api/v1/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Laptop",
    "description": "High-performance laptop",
    "price": 999.99,
    "categoryId": "category-xxx",
    "stock": 10
  }'
```

#### List Products (Public)
```bash
curl https://smultron.zwc.se/api/v1/products
```

#### Create an Order (Public)
```bash
curl -X POST https://smultron.zwc.se/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "product-xxx",
        "quantity": 2,
        "price": 999.99
      }
    ],
    "total": 1999.98,
    "customerEmail": "customer@example.com",
    "customerName": "John Doe"
  }'
```

## Troubleshooting

### Lambda Timeout
If functions timeout, increase timeout in `infrastructure/template.yaml`:
```yaml
Globals:
  Function:
    Timeout: 60  # Increase from 30
```

### DynamoDB Permissions
If you get permission errors, verify the Lambda has correct policies in the template.

### CloudFront Cache Issues
After updating products, invalidate CloudFront cache:
```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/api/v1/products*"
```

### CORS Issues
All responses include CORS headers. If still having issues, check API Gateway CORS settings.

## Monitoring

### View Lambda Logs
```bash
sam logs -n smultron-api --stack-name smultron-api --tail
```

### View DynamoDB Tables
```bash
aws dynamodb scan --table-name smultron-products
aws dynamodb scan --table-name smultron-categories
aws dynamodb scan --table-name smultron-orders
```

### CloudWatch Metrics
Check Lambda invocations, errors, and duration in AWS CloudWatch Console.

## Cleanup

To delete all resources:
```bash
aws cloudformation delete-stack --stack-name smultron-api
aws s3 rb s3://smultron-docs --force
```

Note: This will delete all data in DynamoDB tables!
