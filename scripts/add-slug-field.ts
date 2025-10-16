#!/usr/bin/env bun
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// Load dev environment variables
const envFile = Bun.file('.env.dev');
const envContent = await envFile.text();
envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  }
});

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE || 'smultron-products-dev';
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE || 'smultron-categories-dev';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-north-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

async function addSlugToProducts() {
  console.log('Scanning products table...');
  
  const scanResult = await dynamodb.send(new ScanCommand({
    TableName: PRODUCTS_TABLE,
  }));

  const products = scanResult.Items || [];
  console.log(`Found ${products.length} products`);

  for (const product of products) {
    if (product.slug) {
      console.log(`Product ${product.id} already has slug: ${product.slug}`);
      continue;
    }

    // Extract slug from existing ID (remove timestamp and random suffix)
    // Old format: category-title-timestamp-random
    // New slug: category-title
    const idParts = product.id.split('-');
    // Remove last two parts (timestamp and random)
    const slugParts = idParts.slice(0, -2);
    const slug = slugParts.join('-');

    console.log(`Adding slug to product ${product.id}: ${slug}`);

    await dynamodb.send(new UpdateCommand({
      TableName: PRODUCTS_TABLE,
      Key: { id: product.id },
      UpdateExpression: 'SET slug = :slug',
      ExpressionAttributeValues: {
        ':slug': slug,
      },
    }));
  }

  console.log('Products migration complete!');
}

async function addSlugToCategories() {
  console.log('Scanning categories table...');
  
  const scanResult = await dynamodb.send(new ScanCommand({
    TableName: CATEGORIES_TABLE,
  }));

  const categories = scanResult.Items || [];
  console.log(`Found ${categories.length} categories`);

  for (const category of categories) {
    if (category.slug) {
      console.log(`Category ${category.id} already has slug: ${category.slug}`);
      continue;
    }

    // For categories, the old ID was just the title slug
    // We need to check if the ID has timestamp-random suffix or not
    const idParts = category.id.split('-');
    
    // If last two parts look like timestamp-random, extract slug
    const lastPart = idParts[idParts.length - 1];
    const secondLastPart = idParts[idParts.length - 2];
    
    let slug;
    if (lastPart.length === 9 && !isNaN(Number(secondLastPart))) {
      // Has timestamp-random suffix, remove it
      slug = idParts.slice(0, -2).join('-');
    } else {
      // Old format without suffix, use entire ID as slug
      slug = category.id;
    }

    console.log(`Adding slug to category ${category.id}: ${slug}`);

    await dynamodb.send(new UpdateCommand({
      TableName: CATEGORIES_TABLE,
      Key: { id: category.id },
      UpdateExpression: 'SET slug = :slug',
      ExpressionAttributeValues: {
        ':slug': slug,
      },
    }));
  }

  console.log('Categories migration complete!');
}

async function main() {
  try {
    await addSlugToProducts();
    await addSlugToCategories();
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
