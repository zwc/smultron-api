# Checkout & Swish Payment Integration

## Overview

The `/v1/checkout` endpoint provides a complete checkout flow that:
1. Validates cart items and stock availability
2. Creates an order in the system
3. Updates product stock
4. Initiates a Swish payment request
5. Returns order details and payment reference

## Endpoint

**POST** `/v1/checkout`

## Request Payload

```json
{
  "order": {
    "payment": "swish",
    "delivery": "postnord",
    "delivery_cost": 82,
    "name": "Henrik",
    "company": "",
    "address": "Åloppevägen 43",
    "zip": "123 45",
    "city": "Bromma",
    "email": "henrik@vh.se",
    "phone": "0706444364"
  },
  "cart": [
    {
      "id": "product-id-123",
      "slug": "big-into-energy",
      "brand": "Pop Mart",
      "title": "Labubu",
      "subtitle": "Big into energy",
      "category": "labubu",
      "price": 599,
      "number": 2,
      "image": "graphics/temp/labubu-big-into-energy-1.jpg"
    }
  ]
}
```

### Required Fields

**order:**
- `payment`: Payment method - `"swish"`, `"card"`, or `"invoice"`
- `delivery`: Delivery method (e.g., `"postnord"`, `"dhl"`, `"pickup"`)
- `delivery_cost`: Delivery cost in SEK
- `name`: Customer name
- `address`: Delivery address
- `zip`: Postal code
- `city`: City
- `email`: Customer email
- `phone`: Customer phone number

**order.company:** Optional company name

**cart:** Array of cart items, each containing:
- `id`: Product ID (required)
- `number`: Quantity (required)
- `slug`, `brand`, `title`, `subtitle`, `category`, `price`, `image`: Optional metadata

## Response

### Success (201 Created)

```json
{
  "data": {
    "order": {
      "id": "uuid-order-id",
      "number": "20251106-0001",
      "status": "active"
    },
    "payment": {
      "method": "swish",
      "status": "created",
      "reference": "mock-20251106-0001-1730899200000",
      "swishUrl": "https://mss.cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests/mock-20251106-0001-1730899200000"
    }
  },
  "meta": null,
  "links": null,
  "error": null
}
```

### Error Responses

**400 Bad Request** - Validation error or insufficient stock:
```json
{
  "data": null,
  "error": {
    "message": "Insufficient stock for Labubu. Available: 5, Requested: 10"
  }
}
```

**404 Not Found** - Product not found:
```json
{
  "data": null,
  "error": {
    "message": "Product product-id-123 not found"
  }
}
```

**500 Internal Server Error** - Payment initialization failed:
```json
{
  "data": null,
  "error": {
    "message": "Order created but payment initialization failed. Please contact support."
  }
}
```

## Swish Integration

### Test Mode

By default, the system runs in **test mode** and returns mock Swish payment references. This allows you to test the full checkout flow without requiring Swish certificates or a merchant account.

### Production Setup

To enable production Swish payments, you need to:

1. **Obtain Swish Certificates**
   - Register for Swish merchant account
   - Download SSL certificates for mTLS authentication

2. **Configure Environment Variables**
   ```bash
   SWISH_ENVIRONMENT=production
   SWISH_MERCHANT_NUMBER=your-merchant-number
   SWISH_CALLBACK_URL=https://yourdomain.com/v1/swish/callback
   SWISH_CERT_PATH=/path/to/certificate.pem
   SWISH_KEY_PATH=/path/to/private-key.pem
   SWISH_PASSPHRASE=certificate-passphrase
   ```

3. **Store Certificates Securely**
   - Use AWS Secrets Manager or Parameter Store
   - Load certificates at runtime

### Payment Flow

1. **Customer initiates checkout** → POST to `/v1/checkout`
2. **System creates order** and reserves stock
3. **Swish payment request** is created with:
   - Order number as payment reference
   - Total amount (cart items + delivery cost)
   - Customer phone number
   - Callback URL for status updates
4. **Customer opens Swish app** using the returned `swishUrl`
5. **Customer confirms payment** in Swish app
6. **Swish sends callback** to your server with payment status
7. **System updates order status** based on payment result

### Payment Statuses

- `CREATED` - Payment request created, awaiting customer action
- `PAID` - Payment completed successfully
- `DECLINED` - Customer declined or payment failed
- `ERROR` - Technical error occurred
- `CANCELLED` - Payment was cancelled

## Example Usage

### cURL

```bash
curl -X POST https://dev.smultron.zwc.se/v1/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "order": {
      "payment": "swish",
      "delivery": "postnord",
      "delivery_cost": 82,
      "name": "Henrik",
      "company": "",
      "address": "Åloppevägen 43",
      "zip": "123 45",
      "city": "Bromma",
      "email": "henrik@vh.se",
      "phone": "0706444364"
    },
    "cart": [
      {
        "id": "product-id-123",
        "number": 2,
        "price": 599
      }
    ]
  }'
```

### JavaScript (fetch)

```javascript
const response = await fetch('https://dev.smultron.zwc.se/v1/checkout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    order: {
      payment: 'swish',
      delivery: 'postnord',
      delivery_cost: 82,
      name: 'Henrik',
      company: '',
      address: 'Åloppevägen 43',
      zip: '123 45',
      city: 'Bromma',
      email: 'henrik@vh.se',
      phone: '0706444364'
    },
    cart: [
      {
        id: 'product-id-123',
        number: 2,
        price: 599
      }
    ]
  })
});

const result = await response.json();

if (response.ok) {
  const { order, payment } = result.data;
  console.log('Order created:', order.number);
  console.log('Payment reference:', payment.reference);
  
  // Redirect user to Swish
  if (payment.swishUrl) {
    window.location.href = payment.swishUrl;
  }
} else {
  console.error('Checkout failed:', result.error.message);
}
```

## Stock Management

The checkout endpoint automatically:
- Validates product availability
- Checks stock levels
- Updates stock after successful order creation
- Prevents overselling through atomic operations

## Error Handling

If payment initialization fails after order creation:
- The order is still created in the database
- Stock is already reserved
- The error message indicates the payment failure
- You can manually process the payment or cancel the order

## Next Steps

To complete the integration:

1. **Implement Swish callback handler** (`/v1/swish/callback`)
2. **Update order status** based on payment callbacks
3. **Restore stock** if payment fails or is cancelled
4. **Send confirmation emails** when payment succeeds
5. **Configure production certificates** for live Swish payments

## Support

For questions or issues, contact the development team or refer to:
- [Swish Developer Documentation](https://developer.swish.nu/)
- [Swish Integration Guide](https://developer.swish.nu/documentation/getting-started)
