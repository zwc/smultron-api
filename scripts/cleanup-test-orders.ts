import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.ORDERS_TABLE || 'smultron-orders-dev';
const REGION = process.env.AWS_REGION || 'eu-north-1';

const client = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(client);

async function scanAll(tableName: string) {
  const results: any[] = [];
  let ExclusiveStartKey: any = undefined;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey }));
    if (res.Items) results.push(...res.Items as any[]);
    ExclusiveStartKey = (res as any).LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return results;
}

async function main() {
  console.log(`Scanning table ${TABLE} in ${REGION}...`);
  const items = await scanAll(TABLE);
  console.log(`Total items in table: ${items.length}`);

  const candidates = items.filter(it => {
    try {
      const info = it.information || it.order || {};
      const name = info?.name;
      const number = (it.number || it.Number || '') as string;
      if (typeof name === 'string' && name.startsWith('Test Customer')) return true;
      if (typeof number === 'string' && number.startsWith('Test Customer')) return true;
    } catch (e) {
      // ignore
    }
    return false;
  });

  if (candidates.length === 0) {
    console.log('No test orders found for deletion.');
    return;
  }

  console.log(`Found ${candidates.length} test order(s). Deleting...`);
  for (const c of candidates) {
    const id = c.id || c.Id || c.ID;
    if (!id) {
      console.warn('Skipping item without id:', JSON.stringify(c).slice(0,200));
      continue;
    }
    console.log('Deleting order id=', id);
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { id } }));
  }

  console.log('Cleanup completed.');
}

main().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
