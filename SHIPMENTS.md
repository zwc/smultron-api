Create first shipment option (dev)

This document shows how to create a shipment option on the dev environment.

Notes

- The API `POST /v1/shipment-options` will create the shipment option and will generate an `id` (UUID) automatically.
- If you need the item to have an explicit id of `1`, insert it directly into the dev DynamoDB table (`smultron-shipment-dev`) using the AWS CLI (example below).

1. Create via API (recommended)

Replace the values below with your dev API base URL and a valid admin JWT.

Set variables:

```bash
export API_BASE="https://<your-dev-subdomain>/api/v1"
export TOKEN="<ADMIN_JWT>"
```

Create a token
export API_BASE="https://dev.smultron.zwc.se/v1"

# Get token (extract with jq)

export TOKEN=$(curl -s -X POST "$API_BASE/admin/login" \
 -H "Content-Type: application/json" \
 -d '{"username":"linn","password":"e5uu588hzfwge367"}' | jq -r '.data.token')

# Verify token was returned

echo "$TOKEN"

Create the shipment option with curl:

```bash
curl -X POST "$API_BASE/shipment-options" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "postnord",
    "description": "spårbart med postnord",
    "cost": 82
  }'
```

Expected response: 201 Created with JSON containing the created resource (including generated `id`).

Verify list:

```bash
curl "$API_BASE/shipment-options" -H "Content-Type: application/json"
```

2. Create with explicit id = 1 (direct DynamoDB write)

If you require the `id` to be exactly `1`, use the AWS CLI to put the item into the dev table directly. Replace `--region` as appropriate.

```bash
aws dynamodb put-item \
  --table-name smultron-shipment-dev \
  --region <aws-region> \
  --item '{
    "id": {"S": "1"},
    "name": {"S": "postnord"},
    "description": {"S": "spårbart med postnord"},
    "cost": {"N": "82"},
    "createdAt": {"S": "2026-04-11T00:00:00.000Z"},
    "updatedAt": {"S": "2026-04-11T00:00:00.000Z"}
  }'
```

Then verify via the API or AWS CLI:

```bash
# via API
curl "$API_BASE/shipment-options" -H "Content-Type: application/json"

# via AWS CLI
aws dynamodb get-item --table-name smultron-shipment-dev --key '{"id":{"S":"1"}}' --region <aws-region>
```

3. Remove the shipment option (if needed)

```bash
# If created with id 1 via DynamoDB, you can also delete via API (requires auth):
curl -X DELETE "$API_BASE/shipment-options/1" \
  -H "Authorization: Bearer $TOKEN"

# Or remove from DynamoDB directly:
aws dynamodb delete-item --table-name smultron-shipment-dev --key '{"id":{"S":"1"}}' --region <aws-region>
```

If you want, I can also add a small script to the repo to bootstrap this entry automatically for dev. Would you like that?
