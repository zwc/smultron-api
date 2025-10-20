#!/usr/bin/env bun

import { readFileSync } from 'fs';
import { join } from 'path';

interface Category {
	id: string;
	slug: string;
	brand: string;
	title: string;
	subtitle: string;
	index: number;
	status: 'active' | 'inactive';
	createdAt: string;
	updatedAt: string;
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
	status: 'active' | 'inactive';
	createdAt: string;
	updatedAt: string;
}

interface DataFile {
	categories: Category[];
	products: Product[];
}

// Configuration
const API_URL = process.env.API_URL || 'https://dev.smultron.zwc.se/v1';
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
	const response = await apiRequest('POST', '/admin/login', undefined, {
		username: ADMIN_USERNAME,
		password: ADMIN_PASSWORD,
	});

	if (!response.token) {
		throw new Error('No token received from login');
	}

	console.log('✓ Authentication successful');
	return response.token;
}

// Delete all existing categories
async function deleteAllCategories(token: string): Promise<void> {
	console.log('\n🗑️  Deleting all existing categories...');
	
	try {
		const response = await apiRequest('GET', '/admin/categories?limit=100', token);
		const categories = response.data || [];
		
		if (categories.length === 0) {
			console.log('  ℹ️  No categories to delete');
			return;
		}
		
		for (const category of categories) {
			try {
				await apiRequest('DELETE', `/admin/categories/${category.id}`, token);
				console.log(`  ✓ Deleted category: ${category.title} (${category.id})`);
			} catch (error) {
				console.error(`  ✗ Failed to delete category ${category.id}:`, error);
			}
		}
		
		console.log(`✓ Deleted ${categories.length} categories`);
	} catch (error) {
		console.error('  ✗ Failed to fetch categories for deletion:', error);
		throw error;
	}
}

// Delete all existing products
async function deleteAllProducts(token: string): Promise<void> {
	console.log('\n🗑️  Deleting all existing products...');
	
	try {
		const response = await apiRequest('GET', '/admin/products?limit=100', token);
		const products = response.data || [];
		
		if (products.length === 0) {
			console.log('  ℹ️  No products to delete');
			return;
		}
		
		for (const product of products) {
			try {
				await apiRequest('DELETE', `/admin/products/${product.id}`, token);
				console.log(`  ✓ Deleted product: ${product.title} - ${product.subtitle} (${product.id})`);
			} catch (error) {
				console.error(`  ✗ Failed to delete product ${product.id}:`, error);
			}
		}
		
		console.log(`✓ Deleted ${products.length} products`);
	} catch (error) {
		console.error('  ✗ Failed to fetch products for deletion:', error);
		throw error;
	}
}

// Seed categories
async function seedCategories(token: string): Promise<void> {
	console.log('\n📁 Seeding categories...');
	
	let successCount = 0;
	let errorCount = 0;
	
	for (const category of data.categories) {
		try {
			await apiRequest('POST', '/admin/categories', token, category);
			successCount++;
			console.log(`  ✓ Created category: ${category.title} (${category.id})`);
		} catch (error) {
			errorCount++;
			console.error(`  ✗ Failed to create category ${category.id}:`, error);
		}
	}
	
	console.log(`✓ Finished seeding categories: ${successCount} successful, ${errorCount} errors`);
}

// Seed products
async function seedProducts(token: string): Promise<void> {
	console.log('\n📦 Seeding products...');
	
	let successCount = 0;
	let errorCount = 0;
	
	for (const product of data.products) {
		try {
			await apiRequest('POST', '/admin/products', token, product);
			successCount++;
			console.log(`  ✓ Created product: ${product.title} - ${product.subtitle} (${product.id})`);
		} catch (error) {
			errorCount++;
			console.error(`  ✗ Failed to create product ${product.id}:`, error);
		}
	}
	
	console.log(`✓ Finished seeding products: ${successCount} successful, ${errorCount} errors`);
}

// Verify seeded data
async function verifyData(token: string): Promise<void> {
	console.log('\n🔍 Verifying seeded data...');
	
	try {
		const categories = await apiRequest('GET', '/admin/categories', token);
		console.log(`  ✓ Categories in database: ${categories.length}`);
		
		const products = await apiRequest('GET', '/admin/products', token);
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
		
		// Step 2: Delete all existing data
		await deleteAllProducts(token);
		await deleteAllCategories(token);
		
		// Step 3: Seed categories first (products depend on categories)
		await seedCategories(token);
		
		// Step 4: Seed products
		await seedProducts(token);
		
		// Step 5: Verify the seeded data
		await verifyData(token);
		
		console.log('\n✅ Data seeding completed successfully!');
	} catch (error) {
		console.error('\n❌ Data seeding failed:', error);
		process.exit(1);
	}
}

main();
