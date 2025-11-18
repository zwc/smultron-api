# Swish Integration Implementation Guide

## Current Status

The checkout endpoint (`/v1/checkout`) is implemented with **mock Swish payments** by default. The service supports four environments:

- **mock** (default): Returns mock responses without API calls
- **mss**: Merchant Swish Simulator for testing
- **sandbox**: Full integration testing with test apps
- **production**: Live payments

## Swish Merchant Information

- **Production Merchant Number:** 1236166490
- **MSS Test Merchant Number:** 1234679304
- **Current Environment:** `mock` (set via `SWISH_ENVIRONMENT`)

## Testing Environments

### 1. Mock Mode (Current)

No certificates required. Returns simulated responses immediately.

```bash
SWISH_ENVIRONMENT=mock
```

### 2. Merchant Swish Simulator (MSS)

Best for initial integration testing. Uses test certificates provided by Swish.

**Base URL:** `https://mss.cpc.getswish.net/swish-cpcapi/api/v2`

**Test Merchant Number:** 1234679304

**Test Phone Numbers:**
- 46701234768
- 46701234769

**Firewall Whitelist:** `89.46.83.171` (for receiving callbacks)

**Certificates:**
Download from: [Swish MSS Certificates](https://developer.swish.nu/documentation/test-tools/merchant-swish-simulator)
- All test certificate files (.p12 format)
- Password: `swish`
- Use naming pattern: `Swish_Merchant_TestCertificate_1234679304.p12`

**Error Simulation:**
You can simulate errors by setting the `message` parameter:
```javascript
// Simulate declined payment
message: 'RF07'
```

### 3. Sandbox Environment

Full integration testing with mobile test apps. Requires user enrollment.

**Base URL:** `https://staging.getswish.pub.tds.tieto.com/swish-cpcapi/api/v2`

**Firewall Whitelist:**
- 89.46.83.0/24
- 103.57.74.0/24
- 77.81.6.112

**Requirements:**
- Enrollment via support@getswish.se
- Test BankID application
- Swish Test application on mobile phone

### 4. Production Environment

Live payments with real money.

**Base URL:** `https://cpc.getswish.net/swish-cpcapi/api/v2`

**Firewall Whitelist:** `egress.api.getswish.se` (FQDN-based)

**TLS Requirements:**
- Minimum TLS 1.2
- Server certificate: DigiCert Global Root G2

## Setup Instructions

### Option A: Testing with MSS (Recommended First Step)

1. **Download MSS Test Certificates**
   
   Visit: https://developer.swish.nu/documentation/test-tools/merchant-swish-simulator
   
   Download the certificate package and extract. You'll need:
   - `Swish_Merchant_TestCertificate_1234679304.p12` (or similar)

2. **Extract Certificate and Key from .p12**

   ```bash
   # Extract certificate
   openssl pkcs12 -in Swish_Merchant_TestCertificate_1234679304.p12 \
     -clcerts -nokeys -out swish-test-cert.pem \
     -passin pass:swish
   
   # Extract private key
   openssl pkcs12 -in Swish_Merchant_TestCertificate_1234679304.p12 \
     -nocerts -nodes -out swish-test-key.pem \
     -passin pass:swish
   
   # Extract CA chain
   openssl pkcs12 -in Swish_Merchant_TestCertificate_1234679304.p12 \
     -cacerts -nokeys -out swish-test-ca.pem \
     -passin pass:swish
   ```

3. **Store Certificates**

   For local testing:
   ```bash
   mkdir -p certificates
   mv swish-test-*.pem certificates/
   ```

   For Lambda deployment, either:
   - Upload to S3 and mount via Lambda layer
   - Store in AWS Secrets Manager
   - Include in Lambda deployment package (not recommended for production)

4. **Configure Environment Variables**

   ```bash
   # MSS Testing
   SWISH_ENVIRONMENT=mss
   SWISH_MERCHANT_NUMBER=1234679304
   SWISH_CALLBACK_URL=https://dev.smultron.zwc.se/v1/swish/callback
   SWISH_CERT_PATH=/path/to/certificates/swish-test-cert.pem
   SWISH_KEY_PATH=/path/to/certificates/swish-test-key.pem
   SWISH_CA_CERT_PATH=/path/to/certificates/swish-test-ca.pem
   # SWISH_PASSPHRASE not needed if you extracted with -nodes
   ```

5. **Whitelist MSS IP Address**

   Ensure your callback endpoint allows traffic from: `89.46.83.171`

6. **Test Payment Request**

   ```bash
   curl -X POST https://dev.smultron.zwc.se/v1/checkout \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "order": {
         "payment": "swish",
         "delivery": "pickup",
         "delivery_cost": 0,
         "name": "Test Customer",
         "email": "test@example.com",
         "phone": "46701234768"
       },
       "cart": [
         {
           "id": "product-123",
           "name": "Test Product",
           "price": 100,
           "quantity": 1
         }
       ]
     }'
   ```

   You should receive a response with a Swish payment ID and location.

### Option B: Production Setup

1. **Obtain Production Certificates**

   Log in to Swish Certificate Management: https://portal.swish.nu/
   - Use Mobile BankID, BankID on card, or BxID
   - Only authorized persons for your merchant can access
   - Download your merchant certificates for number 1236166490

2. **Extract and Store Certificates**

   ```bash
   # If certificate is in .p12 format
   openssl pkcs12 -in your-merchant-cert.p12 \
     -clcerts -nokeys -out swish-prod-cert.pem
   
   openssl pkcs12 -in your-merchant-cert.p12 \
     -nocerts -nodes -out swish-prod-key.pem
   
   openssl pkcs12 -in your-merchant-cert.p12 \
     -cacerts -nokeys -out swish-prod-ca.pem
   ```

   **Store in AWS Secrets Manager:**
   ```bash
   aws secretsmanager create-secret \
     --name smultron/swish-production-certs \
     --description "Swish production certificates" \
     --secret-string file://swish-certs.json
   ```

   Where `swish-certs.json` contains:
   ```json
   {
     "certificate": "-----BEGIN CERTIFICATE-----\n...",
     "privateKey": "-----BEGIN PRIVATE KEY-----\n...",
     "caCertificate": "-----BEGIN CERTIFICATE-----\n..."
   }
   ```

3. **Update Infrastructure**

   Edit `infrastructure/lib/smultron-stack.ts` to grant Secrets Manager access:

   ```typescript
   // Add to checkoutFunction
   checkoutFunction.addToRolePolicy(new iam.PolicyStatement({
     actions: ['secretsmanager:GetSecretValue'],
     resources: ['arn:aws:secretsmanager:eu-north-1:*:secret:smultron/swish-*'],
   }));
   ```

4. **Configure Production Environment**

   ```bash
   SWISH_ENVIRONMENT=production
   SWISH_MERCHANT_NUMBER=1236166490
   SWISH_CALLBACK_URL=https://smultron.zwc.se/v1/swish/callback
   SWISH_CERT_SECRET_ARN=arn:aws:secretsmanager:eu-north-1:ACCOUNT:secret:smultron/swish-production-certs
   ```

5. **Whitelist Callback Endpoint**

   Ensure your production domain `smultron.zwc.se` can receive HTTPS callbacks from:
   - FQDN: `egress.api.getswish.se`

6. **Deploy and Test**

   ```bash
   bun run build
   bun run cdk:deploy:prod
   ```

   Test with small amounts first!

## Technical Requirements

### TLS Requirements

- **Minimum TLS version:** 1.2 or higher
- **Production server certificate:** DigiCert Global Root G2
- **Callback endpoint:** Must use HTTPS on port 443
- **IP filtering:** Recommended for callback endpoints

### Certificate Management

- Production certificates valid for specific merchant number
- MSS accepts any test certificate (alias doesn't matter)
- Sandbox requires user enrollment and dedicated test certificates
- Production certificates managed via Swish Portal
  });

  return cachedAgent;
}

export async function createSwishPayment(
  orderNumber: string,
  amount: number,
  phoneNumber?: string,
  message?: string
): Promise<{ id: string; location: string; status: string }> {
  
  // Generate UUID for the payment request (instruction ID)
  const instructionId = crypto.randomUUID();

  // Clean phone number if provided
  let cleanPhone: string | undefined;
  if (phoneNumber) {
    cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '46' + cleanPhone.substring(1);
    }
    if (!cleanPhone.startsWith('46')) {
      cleanPhone = '46' + cleanPhone;
    }
  }

  const paymentRequest = {
    payeePaymentReference: orderNumber,
    callbackUrl: SWISH_CALLBACK_URL,
    payeeAlias: SWISH_MERCHANT_NUMBER,
    currency: 'SEK',
    amount: amount.toString(), // Must be string
    message: message || `Order ${orderNumber}`,
    ...(cleanPhone && { payerAlias: cleanPhone }), // Only include if provided
  };

  try {
    const agent = getHttpsAgent();

    // Swish uses PUT with UUID in URL, not POST
    const response = await fetch(
      `${SWISH_API_BASE_URL}/paymentrequests/${instructionId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentRequest),
        // @ts-ignore - Node.js fetch supports agent option
        agent,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Swish API error: ${response.status} ${errorText}`);
    }

    return {
      id: instructionId,
      location: response.headers.get('location') || `${SWISH_API_BASE_URL}/paymentrequests/${instructionId}`,
      status: 'CREATED',
    };
  } catch (error) {
    console.error('Swish payment creation failed:', error);
    throw error;
  }
}
```

### Step 3: Create Swish Callback Handler

Create `src/handlers/swish.callback.ts`:

```typescript
import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { APIResponse } from '../types';
import { successResponse, errorResponse } from '../utils/response';
import { getOrder, updateOrderStatus } from '../services/product';

export const method = 'POST';
export const route = '/swish/callback';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIResponse> => {
  try {
    if (!event.body) {
      return errorResponse('Request body is required', 400);
    }

    const callback = JSON.parse(event.body);
    
    console.log('Swish callback received:', callback);

    const { id, payeePaymentReference, status, errorCode, errorMessage } = callback;

    // Extract order number from payment reference
    const orderNumber = payeePaymentReference;

    // TODO: Get order by number (need to add method)
    // const order = await getOrderByNumber(orderNumber);

    switch (status) {
      case 'PAID':
        console.log(`Payment successful for order ${orderNumber}`);
        // Update order status to confirmed/paid
        // await updateOrderPaymentStatus(order.id, 'paid');
        // Send confirmation email
        break;

      case 'DECLINED':
      case 'ERROR':
      case 'CANCELLED':
        console.log(`Payment failed for order ${orderNumber}: ${status}`, errorMessage);
        // Update order status
        // Restore stock if needed
        // await cancelOrder(order.id);
        break;

      default:
        console.log(`Unknown payment status: ${status}`);
    }

    // Always return 200 to acknowledge callback
    return successResponse({ received: true });
  } catch (error) {
    console.error('Swish callback error:', error);
    // Return 200 even on error to prevent Swish from retrying
    return successResponse({ received: true });
  }
};
```

### Step 4: Add Callback Route to CDK

In `infrastructure/lib/smultron-stack.ts`:

```typescript
const swishCallbackFunction = new lambda.Function(this, 'SwishCallbackFunction', {
  ...commonLambdaProps,
  functionName: `smultron-swish-callback-${environment}`,
  code: lambdaCode,
  handler: 'index.swishCallback',
});
ordersTable.grantReadWriteData(swishCallbackFunction);
productsTable.grantReadWriteData(swishCallbackFunction);

// Add route
const swish = v1.addResource('swish');
const swishCallback = swish.addResource('callback');
swishCallback.addMethod('POST', new apigateway.LambdaIntegration(swishCallbackFunction));
```

### Step 5: Grant Secrets Manager Access

Update CDK stack to grant Lambda access to Secrets Manager:

```typescript
// Add to common Lambda props
const secretsPolicy = new iam.PolicyStatement({
  actions: ['secretsmanager:GetSecretValue'],
  resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:swish-*`],
});

checkoutFunction.addToRolePolicy(secretsPolicy);
```

## Testing

### Test Environment (MSS)

1. Use test merchant number: `1234679304`
2. Test phone numbers: `46701234567` - `46701234569`
3. Base URL: `https://mss.cpc.getswish.net/swish-cpcapi/api/v2`

### Production

1. Set `SWISH_ENVIRONMENT=production`
2. Use real merchant number: `1236166490`
3. Use real phone numbers
4. Base URL: `https://cpc.getswish.net/swish-cpcapi/api/v2`

## Payment Flow

1. **Customer submits checkout** → `/v1/checkout`
2. **System creates order** and initiates Swish payment
3. **Swish returns payment ID** and location
4. **Customer opens Swish app** (redirect to swish:// deep link on mobile)
5. **Customer approves payment** in Swish app
6. **Swish sends callback** → `/v1/swish/callback`
7. **System updates order status** based on callback

## Error Handling

Common Swish errors:

- `RF07` - Transaction declined
- `ACMT03` - Payer not enrolled
- `ACMT07` - Payer's account blocked
- `AM06` - Amount too low/high
- `BANKIDCL` - BankID cancelled

Handle these in your callback handler and provide appropriate user feedback.

## Security Checklist

- [ ] Certificates stored in AWS Secrets Manager
- [ ] Secrets Manager access restricted to Lambda execution role
- [ ] Callback endpoint validates Swish IP addresses (optional)
- [ ] HTTPS only for callback URL
- [ ] Certificate rotation process documented
- [ ] Monitoring and alerting for payment failures

## Next Steps

1. Obtain Swish certificates from merchant portal
2. Store in AWS Secrets Manager
3. Update CDK stack with Secrets Manager permissions
4. Implement callback handler
5. Test in MSS environment
6. Deploy to production

## Support

- **Swish Support:** support@getswish.se
- **Technical Documentation:** https://developer.swish.nu/
- **Merchant Portal:** https://portal.swish.nu/
