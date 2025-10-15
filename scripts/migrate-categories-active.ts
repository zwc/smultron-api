#!/usr/bin/env bun
/**
 * Migration script to add active=true to all existing categories
 * Run this after deploying the new infrastructure with the ActiveIndex GSI
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

// Load environment variables
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

const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE || 'smultron-categories-dev';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function migrateCategories() {
  console.log(`Starting migration for table: ${CATEGORIES_TABLE}`);
  console.log('Scanning all categories...');

  // Scan all categories
  const scanResult = await docClient.send(
    new ScanCommand({
      TableName: CATEGORIES_TABLE,
    })
  );

  const categories = scanResult.Items || [];
  console.log(`Found ${categories.length} categories`);

  let updatedCount = 0;
  let skippedCount = 0;

  // Update each category
  for (const category of categories) {
    if ('active' in category) {
      console.log(`  ✓ Category "${category.title}" already has active field (${category.active})`);
      skippedCount++;
      continue;
    }

    console.log(`  → Updating category "${category.title}" (${category.id})...`);
    
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: CATEGORIES_TABLE,
          Key: { id: category.id },
          UpdateExpression: 'SET active = :active',
          ExpressionAttributeValues: {
            ':active': true,
          },
        })
      );
      console.log(`  ✓ Updated category "${category.title}"`);
      updatedCount++;
    } catch (error) {
      console.error(`  ✗ Failed to update category "${category.title}":`, error);
    }
  }

  console.log('\nMigration complete!');
  console.log(`  Updated: ${updatedCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Total: ${categories.length}`);
}

// Run migration
migrateCategories().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
