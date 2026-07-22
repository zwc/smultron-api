# Complete Order Flow Test

## Overview

This test script validates the entire order flow from product setup through payment confirmation, including:

- ✅ Product creation/update with stock management
- ✅ Stock availability checks
- ✅ Stock reservation during checkout
- ✅ Swish payment integration
- ✅ Payment callback processing
- ✅ Order status updates
- ✅ Email notifications (SES)
- ✅ Stock permanent reduction after payment

## Test Scenario

The test uses a sample order with 2 products:

```json
{
  "order": {
    "payment": "swish",
    "delivery": "postnord",
    "delivery_cost": 69,
    "name": "Henrik",
    "address": "Åloppevägen 43",
    "zip": "123 45",
    "city": "Bromma",
    "email": "henrik@vh.se",
    "phone": "0706444364"
  },
  "cart": [
    {
      "id": "id-enmassatecken-big-into-energy",
      "title": "Labubu - Big into energy",
      "price": 599,
      "quantity": 2
    },
    {
      "id": "id-enmassatecken-rainy-day",
      "title": "Sonny Angel - Rainy day",
      "price": 599,
      "quantity": 1
    }
  ]
}
```

**Total Order Value:** 1,797 SEK (599×2 + 599×1) + 69 SEK delivery = **1,866 SEK**

## Prerequisites

1. **Deployed Dev Environment**
   ```bash
   bun run cdk:deploy:dev
   ```

2. **SES Configuration** (for email testing)
   - Verify sender email: `noreply@smultron.zwc.se`
   - Verify recipient email: `henrik@vh.se`
   - Or use SES sandbox with verified emails

3. **Environment Variables** (optional)
   ```bash
   export API_URL=https://dev.smultron.zwc.se/v1
   ```

## Running the Test

### Basic Test (Successful Payment)

Tests the complete happy path: order creation → stock reservation → payment → confirmation

```bash
bun run test:order-flow
```

Or directly:
```bash
bun run scripts/test-complete-order-flow.ts
```

### Test with Declined Payment

Tests the failure path: order creation → stock reservation → payment declined → stock release

```bash
bun run test:order-flow:declined
```

Or directly:
```bash
bun run scripts/test-complete-order-flow.ts --test-declined
```

## Test Flow

### Step 1: Authentication
- Logs in as admin user (Linn)
- Obtains JWT token for API calls

### Step 2: Product Setup
For each product in the cart:
- Checks if product exists
- Creates product if missing
- Verifies sufficient stock (quantity + 5 buffer)
- Updates stock if insufficient
- Ensures product status is 'active'

### Step 3: Checkout & Stock Reservation
- Places order via `/checkout` endpoint
- Stock is **reserved** (not yet reduced)
- Order created with `status: 'inactive'`
- Swish payment initiated
- Returns payment reference

### Step 4: Verify Stock Reservation
- Confirms products still show original stock
- Stock is held in reservations table (10-minute TTL)
- Other customers cannot purchase reserved quantities

### Step 5: Swish Payment Integration
- Displays payment reference and Swish URL
- In real scenario: Customer opens Swish app and confirms payment
- Test simulates callback

### Step 6: Simulate Payment Callback
- Sends POST to `/swish/callback`
- Status: `PAID` (success) or `DECLINED` (failure)
- Processes payment result

### Step 7: Verify Order Confirmation
- Checks order status updated to `'active'` (on success)
- Or `'invalid'` (on failure)
- Waits for async processing

### Step 8: Verify Stock Reduction
- Confirms stock permanently reduced (on success)
- Or stock reservations cancelled (on failure)
- Final stock count displayed

## Expected Output

### Successful Flow
```
🧪 Complete Order Flow Test
Testing against: https://dev.smultron.zwc.se/v1

============================================================
Step 1: Authentication
============================================================
ℹ Logging in as admin user...
✓ Logged in as Linn Forbes

============================================================
Step 2: Product Setup
============================================================
ℹ Checking if product id-enmassatecken-big-into-energy exists...
✓ Product found: Labubu
✓ Product Labubu has sufficient stock (7)
...

============================================================
Step 3: Checkout & Stock Reservation
============================================================
ℹ Placing order...
✓ Order created: 2511.XXX

============================================================
Step 4: Verify Stock Reservation
============================================================
ℹ Verifying stock has been reserved...
ℹ Product Labubu: Current stock = 7 (reservations active, not yet reduced)
...

============================================================
Step 5: Swish Payment Integration Test
============================================================
ℹ Payment Method: swish
ℹ Payment Status: created
ℹ Payment Reference: <uuid>
ℹ Swish URL: https://mss.cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests/<uuid>

============================================================
Step 6: Simulate Successful Payment
============================================================
ℹ Simulating Swish callback with status: PAID...
✓ Callback processed: PAID

============================================================
Step 7: Verify Order Confirmation
============================================================
ℹ Fetching order <id>...
ℹ Order Status: active
✓ Order confirmed successfully!

============================================================
Step 8: Verify Stock Reduction After Payment
============================================================
ℹ Product Labubu: Stock = 5
ℹ Product Sonny Angel: Stock = 6

============================================================
✨ Test completed successfully!
============================================================

Test Summary:
  Order Number: 2511.XXX
  Order ID: <uuid>
  Payment Method: swish
  Final Status: active
  Items Ordered: 2
  Total Amount: 1879 SEK

Key Features Tested:
✓ Product creation/verification
✓ Stock availability check
✓ Stock reservation during checkout
✓ Order creation with inactive status
✓ Swish payment integration
✓ Payment callback processing
✓ Order status update to active
✓ Stock permanent reduction after payment

Emails should have been sent to:
  Customer: henrik@vh.se
  Admin: smultronet@zwc.se
  (Check SES or email logs to verify)
```

## Verification Steps

### 1. Check DynamoDB Tables

**Orders Table:**
```bash
aws dynamodb scan \
  --table-name smultron-orders-dev \
  --filter-expression "number = :orderNum" \
  --expression-attribute-values '{":orderNum": {"S": "2511.XXX"}}'
```

**Stock Reservations Table:**
```bash
aws dynamodb scan \
  --table-name smultron-stock-reservations-dev
```

### 2. Check CloudWatch Logs

**Checkout Function:**
```bash
aws logs tail /aws/lambda/smultron-checkout-dev --follow
```

**Swish Callback Function:**
```bash
aws logs tail /aws/lambda/smultron-swish-callback-dev --follow
```

### 3. Check SES Email Sending

**View sent emails (if in sandbox):**
- Check inbox for `henrik@vh.se`
- Check inbox for `smultronet@zwc.se`

**View SES sending stats:**
```bash
aws ses get-send-statistics
```

## Troubleshooting

### "Product not found" errors
- Products are created automatically by the test
- Ensure API is accessible and authentication works

### "Insufficient stock" errors
- Test automatically ensures stock ≥ quantity + 5
- Check if product updates are succeeding

### "Callback failed" errors
- Ensure `/swish/callback` endpoint is deployed
- Check Lambda function logs
- Verify callback URL is correct

### "Order status not updated" errors
- Check CloudWatch logs for callback function
- Verify DynamoDB permissions
- May need to increase wait time between steps

### Email not received
- Verify SES email addresses
- Check SES sandbox mode restrictions
- View CloudWatch logs for SES errors

## Manual Testing

To test with real Swish app:

1. Set `SWISH_ENVIRONMENT=mss` in Lambda
2. Configure MSS certificates
3. Run test - it will return real Swish URL
4. **Do not simulate callback** - wait for real callback from Swish

## Cleanup

Remove test products (optional):
```bash
# Delete via API
curl -X DELETE https://dev.smultron.zwc.se/v1/admin/products/id-enmassatecken-big-into-energy \
  -H "Authorization: Bearer <token>"
```

Or run the test multiple times - it reuses existing products.

## Next Steps

1. **Deploy to Production**: `bun run cdk:deploy:prod`
2. **Configure Production Swish**: Add real merchant certificates
3. **Update Email Addresses**: Use production email addresses
4. **Monitor**: Set up CloudWatch alarms for failures
5. **Load Testing**: Test with multiple concurrent orders
