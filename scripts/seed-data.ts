#!/usr/bin/env bun

import { readFileSync } from 'fs';
import { join } from 'path';

interface Category {
	id: string;
	name: string;
	description: string[];
	image: string;
	index: number;
}

interface Product {
	id: string;
	category: string;
	article: string;
	brand: string;
	title: string;
	subtitle: string;
	price: number;
	price_reduced: number;
	description: string[];
	tag: string;
	index: number;
	stock: number;
	max_order: number;
	image: string;
	images: string[];
}

interface DataFile {
	categories: Category[];
	products: Product[];
}

// Configuration
const API_URL = process.env.API_URL || 'https://fewl5l8ebd.execute-api.eu-north-1.amazonaws.com/api/v1';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
	console.error('Error: ADMIN_USERNAME and ADMIN_PASSWORD environment variables are required');
	process.exit(1);
}

// Load data.json
const dataPath = join(process.cwd(), 'data.json');
let data: DataFile;
try {
	const dataContent = readFileSync(dataPath, 'utf-8');
	data = JSON.parse(dataContent);
	console.log(`✓ Loaded data.json: ${data.categories.length} categories, ${data.products.length} products`);
} catch (error) {
	console.error('Error loading data.json:', error);
	process.exit(1);
}

// Helper function to make API requests
async function apiRequest(
	method: string,
	path: string,
	token?: string,
	body?: any
): Promise<any> {
	const url = `${API_URL}${path}`;
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	try {
		const response = await fetch(url, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`HTTP ${response.status}: ${errorText}`);
		}

		return await response.json();
	} catch (error) {
		console.error(`Error ${method} ${path}:`, error);
		throw error;
	}
}

// Authenticate and get token
async function login(): Promise<string> {
	console.log('\n🔐 Authenticating...');
	const response = await apiRequest('POST', '/auth/login', undefined, {
		username: ADMIN_USERNAME,
		password: ADMIN_PASSWORD,
	});

	if (!response.token) {
		throw new Error('No token received from login');
	}

	console.log('✓ Authentication successful');
	return response.token;
}

// Seed categories
async function seedCategories(token: string): Promise<void> {
	console.log('\n📁 Seeding categories...');
	
	for (const category of data.categories) {
		try {
			await apiRequest('POST', '/categories', token, category);
			console.log(`  ✓ Created category: ${category.name} (${category.id})`);
		} catch (error: any) {
			// If category already exists, try to update it
			if (error.message.includes('409') || error.message.includes('already exists')) {
				try {
					await apiRequest('PUT', `/categories/${category.id}`, token, category);
					console.log(`  ↻ Updated category: ${category.name} (${category.id})`);
				} catch (updateError) {
					console.error(`  ✗ Failed to update category ${category.id}:`, updateError);
				}
			} else {
				console.error(`  ✗ Failed to create category ${category.id}:`, error);
			}
		}
	}
	
	console.log(`✓ Finished seeding ${data.categories.length} categories`);
}

// Seed products
async function seedProducts(token: string): Promise<void> {
	console.log('\n📦 Seeding products...');
	
	let successCount = 0;
	let errorCount = 0;
	
	for (const product of data.products) {
		try {
			await apiRequest('POST', '/products', token, product);
			successCount++;
			console.log(`  ✓ Created product: ${product.title} - ${product.subtitle} (${product.id})`);
		} catch (error: any) {
			// If product already exists, try to update it
			if (error.message.includes('409') || error.message.includes('already exists')) {
				try {
					await apiRequest('PUT', `/products/${product.id}`, token, product);
					successCount++;
					console.log(`  ↻ Updated product: ${product.title} - ${product.subtitle} (${product.id})`);
				} catch (updateError) {
					errorCount++;
					console.error(`  ✗ Failed to update product ${product.id}:`, updateError);
				}
			} else {
				errorCount++;
				console.error(`  ✗ Failed to create product ${product.id}:`, error);
			}
		}
	}
	
	console.log(`✓ Finished seeding products: ${successCount} successful, ${errorCount} errors`);
}

// Verify seeded data
async function verifyData(token: string): Promise<void> {
	console.log('\n🔍 Verifying seeded data...');
	
	try {
		const categories = await apiRequest('GET', '/categories', token);
		console.log(`  ✓ Categories in database: ${categories.length}`);
		
		const products = await apiRequest('GET', '/products', token);
		console.log(`  ✓ Products in database: ${products.length}`);
	} catch (error) {
		console.error('  ✗ Failed to verify data:', error);
	}
}

// Main execution
async function main() {
	console.log('🌱 Starting data seeding process...');
	console.log(`   Target API: ${API_URL}`);
	
	try {
		// Step 1: Authenticate
		const token = await login();
		
		// Step 2: Seed categories first (products depend on categories)
		await seedCategories(token);
		
		// Step 3: Seed products
		await seedProducts(token);
		
		// Step 4: Verify the seeded data
		await verifyData(token);
		
		console.log('\n✅ Data seeding completed successfully!');
	} catch (error) {
		console.error('\n❌ Data seeding failed:', error);
		process.exit(1);
	}
}

main();
