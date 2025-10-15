#!/usr/bin/env bun
/**
 * Script to remove all categories and recreate them with active=true
 * This ensures all categories have the new active field properly set
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
  PutCommand,
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

// Load categories from data.json
const dataFile = Bun.file('data.json');
const dataContent = await dataFile.json();
const categoriesToCreate = dataContent.categories.map((cat: any) => {
  // Ensure status field exists, default to 'active' if not present
  return {
    ...cat,
    status: cat.status || 'active',
  };
});

async function recreateCategories() {
  console.log(`🔄 Recreating categories in table: ${CATEGORIES_TABLE}`);
  console.log('='.repeat(60));

  // Step 1: Scan and backup existing categories
  console.log('\n📋 Step 1: Backing up existing categories...');
  const scanResult = await docClient.send(
    new ScanCommand({
      TableName: CATEGORIES_TABLE,
    })
  );

  const existingCategories = scanResult.Items || [];
  console.log(`   Found ${existingCategories.length} existing categories`);

  if (existingCategories.length > 0) {
    // Save backup to file
    const backupFile = `categories-backup-${Date.now()}.json`;
    await Bun.write(backupFile, JSON.stringify(existingCategories, null, 2));
    console.log(`   ✅ Backup saved to: ${backupFile}`);

    // Display existing categories
    console.log('\n   Existing categories:');
    existingCategories.forEach((cat, idx) => {
      console.log(`   ${idx + 1}. ${cat.title} (${cat.id}) - status: ${cat.status ?? 'undefined'}`);
    });
  }

  // Step 2: Delete all existing categories
  console.log('\n🗑️  Step 2: Deleting all existing categories...');
  let deletedCount = 0;
  
  for (const category of existingCategories) {
    try {
      await docClient.send(
        new DeleteCommand({
          TableName: CATEGORIES_TABLE,
          Key: { id: category.id },
        })
      );
      console.log(`   ✓ Deleted: ${category.title} (${category.id})`);
      deletedCount++;
    } catch (error) {
      console.error(`   ✗ Failed to delete ${category.title}:`, error);
    }
  }
  console.log(`   ✅ Deleted ${deletedCount} categories`);

  // Step 3: Recreate categories with status field from data.json
  console.log('\n➕ Step 3: Creating categories from data.json with status field...');
  console.log(`   Loading ${categoriesToCreate.length} categories from data.json`);
  
  const categoriesToRecreate: any[] = categoriesToCreate;

  let createdCount = 0;
  
  for (const category of categoriesToRecreate) {
    try {
      await docClient.send(
        new PutCommand({
          TableName: CATEGORIES_TABLE,
          Item: category,
        })
      );
      console.log(`   ✓ Created: ${category.title} (${category.id}) - status: ${category.status}`);
      createdCount++;
    } catch (error) {
      console.error(`   ✗ Failed to create ${category.title}:`, error);
    }
  }
  console.log(`   ✅ Created ${createdCount} categories`);

  // Step 4: Verify
  console.log('\n✅ Step 4: Verifying results...');
  const verifyResult = await docClient.send(
    new ScanCommand({
      TableName: CATEGORIES_TABLE,
    })
  );

  const finalCategories = verifyResult.Items || [];
  console.log(`   Total categories: ${finalCategories.length}`);
  
  console.log('\n   Final categories:');
  finalCategories
    .sort((a, b) => a.index - b.index)
    .forEach((cat, idx) => {
      console.log(`   ${idx + 1}. ${cat.title} (${cat.id})`);
      console.log(`      - Brand: ${cat.brand}`);
      console.log(`      - Subtitle: ${cat.subtitle}`);
      console.log(`      - Index: ${cat.index}`);
      console.log(`      - Status: ${cat.status}`);
    });

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Category recreation complete!');
  console.log(`   Deleted: ${deletedCount}`);
  console.log(`   Created: ${createdCount}`);
  console.log(`   Final count: ${finalCategories.length}`);
}

// Confirm before running
console.log('⚠️  WARNING: This will DELETE all existing categories and recreate them!');
console.log('   Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

await new Promise(resolve => setTimeout(resolve, 3000));

// Run the recreation
recreateCategories().catch(error => {
  console.error('❌ Recreation failed:', error);
  process.exit(1);
});
