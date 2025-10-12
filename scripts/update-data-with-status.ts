import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Read the data.json file
const dataPath = join(process.cwd(), 'data.json');
const data = JSON.parse(readFileSync(dataPath, 'utf-8'));

// Get current timestamp
const now = new Date().toISOString();

// Add status and timestamps to all products
data.products = data.products.map((product: any, index: number) => {
  // Create a createdAt timestamp with some variation (older products first)
  const daysAgo = data.products.length - index;
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  
  return {
    ...product,
    status: 'active',
    createdAt,
    updatedAt: createdAt
  };
});

// Write back to data.json
writeFileSync(dataPath, JSON.stringify(data, null, 2));

console.log(`✅ Updated ${data.products.length} products with status and timestamps`);
