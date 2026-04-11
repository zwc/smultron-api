# Example Request

```
curl -s -X POST https://stage.smultron.zwc.se/v1/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "order": {
      "payment": "swish",
      "delivery": "postnord",
      "delivery_cost": 0,
      "name": "Bernhard Hettman",
      "company": "",
      "address": "Varmfrontsgatan 18",
      "zip": "128 34",
      "city": "Skarpnäck",
      "email": "bernhard@zwc.se",
      "phone": "46793513563"
    },
    "cart": [
      {
        "id": "2450ae47-a8cf-411b-b51a-ec2a76d00d3c",
        "number": 1,
        "price": 5
      }
    ]
  }' | jq
```

```
curl -s -X PATCH https://stage.smultron.zwc.se/v1/cancel/335F08817C9A4521B62D6664DAE560C3
```

### Activate the Order

```
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
