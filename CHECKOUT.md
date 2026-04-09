# Checkout Flow with Swish Payment (Stage)

Step-by-step guide to performing a complete checkout with Swish payment on the **stage** environment.

Base URL: `https://stage.smultron.zwc.se/v1`

---

## Step 1: Browse the catalog and find the product

Fetch the full public catalog to find the product ID for the item you want to buy.

```bash
curl -s https://stage.smultron.zwc.se/v1/catalog | jq '.data.products[] | select(.slug == "labubu--pin-for-love") | {id, slug, title, price, stock}'
```

This queries the catalog and filters for the product with slug `labubu--pin-for-love`. The response gives you the product `id`, current `price`, and available `stock`.

Example output:

```json
{
  "id": "abc12345-...",
  "slug": "labubu--pin-for-love",
  "title": "Pin for Love",
  "price": 599,
  "stock": 10
}
```

Save the `id` and `price` — you need them for the checkout request.

---

## Step 2: Checkout with Swish payment

Send a `POST /checkout` request with your order details and cart. Replace `PRODUCT_ID` with the actual `id` from Step 1, and `PRODUCT_PRICE` with the `price`.

```bash
curl -s -X POST https://stage.smultron.zwc.se/v1/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "order": {
      "payment": "swish",
      "delivery": "postnord",
      "delivery_cost": 82,
      "name": "Bernhard Hettman",
      "company": "",
      "address": "Varmfrontsgatan 18",
      "zip": "128 34",
      "city": "Skarpnäck",
      "email": "bernhard@zwc.se",
      "phone": "+46793513563"
    },
    "cart": [
      {
        "id": "PRODUCT_ID",
        "number": 1,
        "price": PRODUCT_PRICE
      }
    ]
  }' | jq .
```

What happens on the server:

1. Validates the cart items exist and are in stock.
2. Creates the order with status `inactive` (not yet paid).
3. Reserves stock for 10 minutes so it can't be bought by someone else.
4. Sends a Swish payment request to the Swish API with your phone number.
5. Returns the order ID, order number, and Swish payment reference.

Example response:

```json
{
  "data": {
    "order": {
      "id": "order-uuid-here",
      "number": "2604.001",
      "status": "inactive"
    },
    "payment": {
      "method": "swish",
      "status": "created",
      "reference": "SWISH-INSTRUCTION-ID",
      "swishUrl": "https://cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests/SWISH-INSTRUCTION-ID"
    }
  },
  "meta": null,
  "links": null,
  "error": null
}
```

At this point the customer's Swish app shows a payment request for the total amount. The order stays `inactive` until payment is confirmed.

---

## Step 3: Swish payment confirmation (callback)

Once the customer approves the payment in the Swish app, Swish sends a callback to:

```
POST https://stage.smultron.zwc.se/v1/swish/callback
```

This is handled automatically — you don't need to call it manually. But for testing, you can simulate the Swish callback by sending the payload yourself. Replace `ORDER_NUMBER` with the order number from Step 2, and `SWISH_INSTRUCTION_ID` with the payment reference:

```bash
curl -s -X POST https://stage.smultron.zwc.se/v1/swish/callback \
  -H "Content-Type: application/json" \
  -d '{
    "id": "SWISH_INSTRUCTION_ID",
    "payeePaymentReference": "ORDER_NUMBER",
    "paymentReference": "REF123456",
    "callbackUrl": "https://stage.smultron.zwc.se/v1/swish/callback",
    "payerAlias": "46793513563",
    "payeeAlias": "1236166490",
    "amount": 681,
    "currency": "SEK",
    "message": "Order ORDER_NUMBER",
    "status": "PAID",
    "dateCreated": "2026-04-06T12:00:00.000Z",
    "datePaid": "2026-04-06T12:01:00.000Z",
    "errorCode": null,
    "errorMessage": null
  }' | jq .
```

What happens on the server when `status` is `PAID`:

1. Looks up the order by order number (`payeePaymentReference`).
2. Updates the order status from `inactive` to `active`.
3. Sends confirmation emails to the customer and admin.

Response:

```json
{
  "data": {
    "received": true,
    "orderNumber": "2604.001",
    "status": "PAID"
  },
  "meta": null,
  "links": null,
  "error": null
}
```

---

## Step 4: Verify the order is paid

Fetch the order to confirm it has been updated to `active`. This is an admin endpoint so you need a JWT token.

### 4a. Get an admin token

```bash
TOKEN=$(curl -s -X POST https://stage.smultron.zwc.se/v1/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "YOUR_ADMIN_PASSWORD"}' | jq -r '.data.token')
```

### 4b. Get the order by ID

Replace `ORDER_ID` with the `order.id` from Step 2:

```bash
curl -s https://stage.smultron.zwc.se/v1/admin/orders/ORDER_ID \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Example response:

```json
{
  "data": {
    "id": "order-uuid-here",
    "number": "2604.001",
    "status": "active",
    "delivery": "postnord",
    "delivery_cost": 82,
    "information": {
      "name": "Bernhard Hettman",
      "company": "",
      "address": "Varmfrontsgatan 18",
      "zip": "128 34",
      "city": "Skarpnäck",
      "email": "bernhard@zwc.se",
      "phone": "+46793513563"
    },
    "cart": [
      {
        "id": "product-id",
        "number": 1,
        "slug": "labubu--pin-for-love",
        "title": "Pin for Love",
        "price": 599
      }
    ]
  },
  "meta": { "total": 1 },
  "links": null,
  "error": null
}
```

The order `status` is now `active`. This confirms the Swish payment was processed.

---

## Payment status reference

| Swish status | Order status | What happens                                    |
| ------------ | ------------ | ----------------------------------------------- |
| `CREATED`    | `inactive`   | Payment request sent, waiting for customer      |
| `PAID`       | `active`     | Payment confirmed, stock reserved, emails sent  |
| `DECLINED`   | `invalid`    | Customer declined, stock reservations cancelled |
| `ERROR`      | `invalid`    | Payment error, stock reservations cancelled     |
| `CANCELLED`  | `invalid`    | Payment cancelled, stock reservations cancelled |
