import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

// Migration script: Convert product.category (UUID) to product.categorySlug (slug)
// This script:
// 1. Fetches all categories to build a id->slug mapping
// 2. Updates all products to use categorySlug instead of category

const ENV = process.env.ENV || 'stage';
const PRODUCTS_TABLE = `smultron-products-${ENV}`;
const CATEGORIES_TABLE = `smultron-categories-${ENV}`;

const region = process.env.AWS_REGION || 'eu-north-1';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

async function scanAll(tableName: string): Promise<any[]> {
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

async function updateProduct(productId: string, categorySlug: string, oldCategory: string): Promise<void> {
  await client.send(
    new UpdateCommand({
      TableName: PRODUCTS_TABLE,
      Key: { id: productId },
      UpdateExpression: 'SET categorySlug = :slug REMOVE #cat',
      ExpressionAttributeNames: {
        '#cat': 'category',
      },
      ExpressionAttributeValues: {
        ':slug': categorySlug,
      },
    })
  );
}

async function main() {
  console.log(`\n🔄 Migrating products in ${PRODUCTS_TABLE}`);
  console.log(`   Using categories from ${CATEGORIES_TABLE}\n`);

  // Step 1: Build category id -> slug mapping
  console.log('📂 Fetching categories...');
  const categories = await scanAll(CATEGORIES_TABLE);
  const categoryMap = new Map<string, string>();
  
  for (const cat of categories) {
    categoryMap.set(cat.id, cat.slug);
    console.log(`   ${cat.id} -> ${cat.slug}`);
  }
  console.log(`   Found ${categories.length} categories\n`);

  // Step 2: Update all products
  console.log('📦 Fetching products...');
  const products = await scanAll(PRODUCTS_TABLE);
  console.log(`   Found ${products.length} products\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const product of products) {
    // Skip if already migrated (has categorySlug, no category)
    if (product.categorySlug && !product.category) {
      skipped++;
      continue;
    }

    const oldCategory = product.category;
    
    // If no category field, skip
    if (!oldCategory) {
      console.log(`   ⏭️  ${product.slug}: No category field, skipping`);
      skipped++;
      continue;
    }

    // Look up the slug
    let categorySlug = categoryMap.get(oldCategory);
    
    // If the old category is already a slug (not a UUID), keep it
    if (!categorySlug && !oldCategory.includes('-') || oldCategory.length < 30) {
      // Looks like it might already be a slug
      categorySlug = oldCategory;
    }

    if (!categorySlug) {
      console.log(`   ⚠️  ${product.slug}: Category ${oldCategory} not found in mapping`);
      notFound++;
      continue;
    }

    try {
      await updateProduct(product.id, categorySlug, oldCategory);
      console.log(`   ✅ ${product.slug}: ${oldCategory} -> ${categorySlug}`);
      updated++;
    } catch (err) {
      console.error(`   ❌ ${product.slug}: Failed to update`, err);
    }
  }

  console.log(`\n✨ Migration complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Not found: ${notFound}`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
