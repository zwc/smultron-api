# Copy DynamoDB from dev to stage

This script copies all items from the `*-dev` DynamoDB tables to the corresponding `*-stage` tables.

Tables copied:

- `smultron-products-dev` -> `smultron-products-stage`
- `smultron-categories-dev` -> `smultron-categories-stage`
- `smultron-orders-dev` -> `smultron-orders-stage`
- `smultron-stock-reservations-dev` -> `smultron-stock-reservations-stage`

Usage

1. Install dependencies (if not already):

```bash
bun install
```

2. Run the script. By default it uses the `default` AWS profile and `AWS_REGION` or `us-east-1`.

```bash
# Use default profile and region
bun run scripts/copy-dynamodb-dev-to-stage.ts

# Or specify profiles via env vars
SRC_AWS_PROFILE=dev-profile DEST_AWS_PROFILE=stage-profile AWS_REGION=eu-north-1 bun run scripts/copy-dynamodb-dev-to-stage.ts
```

Notes

- The script performs full table scans and batch writes in chunks of 25 (DynamoDB limit).
- It does not deduplicate or merge existing items — it will overwrite items with the same primary key.
- For cross-account copying, configure correct credentials for source and destination, or run the script twice with `AWS_*` env vars adjusted.
- Large tables may take time and require handling of unprocessed items from `BatchWrite` responses; this script does not yet retry unprocessed items.
