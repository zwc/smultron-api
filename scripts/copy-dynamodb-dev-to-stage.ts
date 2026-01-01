import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';

// This script copies all items from dev tables to stage tables.
// It expects AWS credentials to be configured for both source (dev) and target (stage)
// by using `--profile` or environment variables. It will use the default region
// unless AWS_REGION is set.

const TABLES = [
  'smultron-products',
  'smultron-categories',
  'smultron-orders',
  'smultron-stock-reservations',
];

const BATCH_SIZE = 25; // DynamoDB batch write limit

function createClient(region?: string, profile?: string) {
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
}

async function scanAll(client: any, tableName: string) {
  const items: any[] = [];
  let ExclusiveStartKey: any = undefined;
  do {
    const res = await client.send(
      new ScanCommand({ TableName: tableName, ExclusiveStartKey })
    );
    if (res.Items) items.push(...res.Items);
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function batchWrite(client: any, tableName: string, items: any[]) {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const RequestItems: any = {};
    RequestItems[tableName] = chunk.map((it) => ({ PutRequest: { Item: it } }));
    await client.send(new BatchWriteCommand({ RequestItems }));
  }
}

async function main() {
  const srcProfile = process.env.SRC_AWS_PROFILE || process.env.AWS_PROFILE || 'default';
  const destProfile = process.env.DEST_AWS_PROFILE || process.env.AWS_PROFILE || 'default';
  const region = process.env.AWS_REGION || 'us-east-1';

  console.log('Using region:', region);
  console.log('Source profile:', srcProfile);
  console.log('Destination profile:', destProfile);

  // Note: AWS SDK v3 picks credentials from env/profile automatically. For cross-account
  // copying you can run this script with AWS_PROFILE set to the source credentials, and
  // use temporary credentials for destination by setting AWS_ACCESS_KEY_ID etc. accordingly.

  const srcClient = createClient(region);
  const destClient = createClient(region);

  for (const base of TABLES) {
    const srcTable = `${base}-dev`;
    const destTable = `${base}-stage`;
    console.log(`\nCopying table ${srcTable} -> ${destTable}`);

    const items = await scanAll(srcClient, srcTable);
    console.log(`Found ${items.length} items in ${srcTable}`);
    if (items.length === 0) continue;

    await batchWrite(destClient, destTable, items);
    console.log(`Copied ${items.length} items to ${destTable}`);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Error during copy:', err);
  process.exit(1);
});
