# Swish MSS Testing Guide

This guide helps you test the Swish integration using the Merchant Swish Simulator (MSS).

## Prerequisites

1. Download MSS test certificates from: https://developer.swish.nu/documentation/test-tools/merchant-swish-simulator
2. Extract the certificate package (password: `swish`)
3. Your callback endpoint must be accessible from IP: `89.46.83.171`

## Quick Start

### 1. Extract Certificates

```bash
# Create certificates directory
mkdir -p certificates

# Extract from .p12 file
openssl pkcs12 -in Swish_Merchant_TestCertificate_1234679304.p12 \
  -clcerts -nokeys -out certificates/swish-mss-cert.pem \
  -passin pass:swish

openssl pkcs12 -in Swish_Merchant_TestCertificate_1234679304.p12 \
  -nocerts -nodes -out certificates/swish-mss-key.pem \
  -passin pass:swish

openssl pkcs12 -in Swish_Merchant_TestCertificate_1234679304.p12 \
  -cacerts -nokeys -out certificates/swish-mss-ca.pem \
  -passin pass:swish
```

### 2. Configure Lambda Environment Variables

Add to `infrastructure/lib/smultron-stack.ts`:

```typescript
const checkoutFunction = new lambda.Function(this, 'CheckoutFunction', {
  // ... existing config ...
  environment: {
    // ... existing env vars ...
    SWISH_ENVIRONMENT: 'mss',
    SWISH_MERCHANT_NUMBER: '1234679304',
    SWISH_CALLBACK_URL: 'https://dev.smultron.zwc.se/v1/swish/callback',
    SWISH_CERT_PATH: '/opt/certificates/swish-mss-cert.pem',
    SWISH_KEY_PATH: '/opt/certificates/swish-mss-key.pem',
    SWISH_CA_CERT_PATH: '/opt/certificates/swish-mss-ca.pem',
  },
});
```

### 3. Deploy Certificates with Lambda

**Option A: Lambda Layer**

```bash
# Create layer structure
mkdir -p layer/certificates
cp certificates/*.pem layer/certificates/

# Create layer zip
cd layer
zip -r ../swish-certificates-layer.zip .
cd ..

# Upload to AWS
aws lambda publish-layer-version \
  --layer-name swish-mss-certificates \
  --zip-file fileb://swish-certificates-layer.zip \
  --compatible-runtimes nodejs22.x \
  --compatible-architectures arm64
```

Then add layer to your function in CDK.

**Option B: Include in Deployment Package**

Add to your build process (not recommended for production).

### 4. Test Payment Flow

```bash
# Login to get token
TOKEN=$(curl -X POST https://dev.smultron.zwc.se/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"linn","password":"e5uu588hzfwge367"}' \
  | jq -r '.data.token')

# Create checkout with Swish payment
curl -X POST https://dev.smultron.zwc.se/v1/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "order": {
      "payment": "swish",
      "delivery": "pickup",
      "delivery_cost": 0,
      "name": "MSS Test Customer",
      "company": "Test AB",
      "address": "Testgatan 1",
      "zip": "12345",
      "city": "Stockholm",
      "email": "test@example.com",
      "phone": "46701234768"
    },
    "cart": [
      {
        "id": "product-123",
        "name": "Test Product",
        "price": 100,
        "quantity": 2
      }
    ]
  }' | jq
```

Expected response:
```json
{
  "data": {
    "order": {
      "id": "ORD-...",
      "status": "pending",
      "payment_reference": "<uuid>",
      ...
    },
    "payment": {
      "provider": "swish",
      "reference": "<uuid>",
      "status": "CREATED",
      "amount": 200
    }
  }
}
```

### 5. Monitor Callback

Check CloudWatch logs for the `swish-callback` function:

```bash
aws logs tail /aws/lambda/smultron-swish-callback-dev --follow
```

You should see:
1. Initial payment creation log
2. Callback from MSS with payment status (PAID, DECLINED, etc.)

## MSS Environment Details

### Endpoints

- **Base URL:** `https://mss.cpc.getswish.net/swish-cpcapi/api/v2`
- **Create Payment:** `PUT /paymentrequests/{uuid}`
- **Get Status:** `GET /paymentrequests/{uuid}`
- **Refunds:** `POST /refunds/{uuid}`

### Test Data

**Merchant Number:** 1234679304

**Test Phone Numbers:**
- 46701234768
- 46701234769

**Callback Source IP:** 89.46.83.171

### Error Simulation

Simulate different error scenarios using the `message` parameter:

```bash
# Simulate declined payment
curl -X POST https://dev.smultron.zwc.se/v1/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "order": {
      "payment": "swish",
      "delivery": "pickup",
      "delivery_cost": 0,
      "name": "Error Test",
      "email": "test@example.com",
      "phone": "46701234768"
    },
    "cart": [...],
    "test_error": "RF07"
  }'
```

**Common Error Codes:**
- `RF07` - Declined
- `FF08` - PaymentReference already in use
- `RP03` - Callback URL missing or invalid
- `PA02` - Amount value is invalid
- `AM06` - Specified transaction amount exceeds allowed amount
- `ACMT03` - Payer not enrolled
- `ACMT01` - Payee not enrolled
- `RF02` - Account blocked for vendor

See full list in Swish API documentation.

## Troubleshooting

### Certificate Issues

**Error: "unable to verify the first certificate"**
- Ensure you extracted the CA chain: `swish-mss-ca.pem`
- Verify file paths in environment variables

**Error: "certificate signature failure"**
- Password may be incorrect (should be `swish`)
- Use correct certificate file for MSS (not production certs)

### Callback Not Received

1. **Check Firewall:** Allow traffic from `89.46.83.171`
2. **Verify HTTPS:** Callback endpoint must use HTTPS on port 443
3. **Check Logs:** View Lambda logs for incoming requests
4. **Test Manually:**
   ```bash
   curl -X POST https://dev.smultron.zwc.se/v1/swish/callback \
     -H "Content-Type: application/json" \
     -d '{"id":"test-123","status":"PAID"}'
   ```

### Payment Status

Check payment status manually:

```bash
# Get the payment UUID from checkout response
PAYMENT_ID="<uuid-from-checkout>"

# Query MSS directly (requires certificates)
curl -X GET "https://mss.cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests/$PAYMENT_ID" \
  --cert certificates/swish-mss-cert.pem \
  --key certificates/swish-mss-key.pem \
  --cacert certificates/swish-mss-ca.pem
```

## Next Steps

After successful MSS testing:

1. **Sandbox Testing:** Test with mobile apps (requires enrollment)
2. **Production Setup:** Replace MSS certs with production certs from Swish Portal
3. **Environment Switch:** Change `SWISH_ENVIRONMENT=production`
4. **Merchant Number:** Update to production number `1236166490`

## MSS Limitations

- No actual money transfer
- No real Swish app interaction
- Simulated responses only
- May not perfectly match production timing
- Error simulation via message parameter only

For full end-to-end testing with mobile apps, use Sandbox environment.
