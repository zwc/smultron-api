#!/usr/bin/env bun
/**
 * Test Swish MSS Integration
 * 
 * This script tests the Swish payment flow with the Merchant Swish Simulator.
 * 
 * Prerequisites:
 * - MSS certificates configured
 * - SWISH_ENVIRONMENT=mss
 * - Deployed to AWS with proper environment variables
 * 
 * Usage:
 *   bun run scripts/test-swish-mss.ts
 */

const API_URL = process.env.API_URL || 'https://dev.smultron.zwc.se/v1';

interface LoginResponse {
  data: {
    token: string;
    name: string;
  };
}

interface CheckoutResponse {
  data: {
    order: {
      id: string;
      status: string;
      payment_reference?: string;
    };
    payment?: {
      provider: string;
      reference: string;
      status: string;
      amount: number;
    };
  };
}

async function login(): Promise<string> {
  console.log('🔐 Logging in...');
  
  const response = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'linn',
      password: 'e5uu588hzfwge367',
    }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as LoginResponse;
  console.log(`✅ Logged in as ${data.data.name}`);
  return data.data.token;
}

async function testCheckout(token: string) {
  console.log('\n🛒 Creating test checkout with Swish payment...');
  
  const checkoutData = {
    order: {
      payment: 'swish',
      delivery: 'pickup',
      delivery_cost: 0,
      name: 'MSS Test Customer',
      company: 'Test AB',
      address: 'Testgatan 1',
      zip: '12345',
      city: 'Stockholm',
      email: 'test@example.com',
      phone: '46701234768', // MSS test phone number
    },
    cart: [
      {
        id: 'test-product-1',
        name: 'Test Product',
        price: 100,
        quantity: 2,
      },
    ],
  };

  const response = await fetch(`${API_URL}/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(checkoutData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Checkout failed: ${response.status} ${errorText}`);
  }

  const data = await response.json() as CheckoutResponse;
  
  console.log('✅ Checkout successful!');
  console.log(`   Order ID: ${data.data.order.id}`);
  console.log(`   Order Status: ${data.data.order.status}`);
  
  if (data.data.payment) {
    console.log(`   Payment Provider: ${data.data.payment.provider}`);
    console.log(`   Payment Reference: ${data.data.payment.reference}`);
    console.log(`   Payment Status: ${data.data.payment.status}`);
    console.log(`   Payment Amount: ${data.data.payment.amount} SEK`);
  }

  return data.data;
}

async function checkSwishConfiguration() {
  console.log('🔍 Checking Swish configuration...\n');
  
  const envVars = {
    'SWISH_ENVIRONMENT': process.env.SWISH_ENVIRONMENT || 'Not set (defaults to mock)',
    'SWISH_MERCHANT_NUMBER': process.env.SWISH_MERCHANT_NUMBER || 'Not set',
    'SWISH_CALLBACK_URL': process.env.SWISH_CALLBACK_URL || 'Not set',
    'SWISH_CERT_PATH': process.env.SWISH_CERT_PATH ? '✅ Set' : '❌ Not set',
    'SWISH_KEY_PATH': process.env.SWISH_KEY_PATH ? '✅ Set' : '❌ Not set',
    'SWISH_CA_CERT_PATH': process.env.SWISH_CA_CERT_PATH ? '✅ Set' : '❌ Not set',
  };

  for (const [key, value] of Object.entries(envVars)) {
    console.log(`   ${key}: ${value}`);
  }

  console.log('\n');
}

async function main() {
  console.log('🧪 Swish MSS Integration Test\n');
  console.log('═'.repeat(50));
  
  await checkSwishConfiguration();
  
  console.log('⚠️  Note: This script tests the API endpoint.');
  console.log('   For MSS testing, ensure Lambda has proper environment variables.\n');
  
  try {
    const token = await login();
    const result = await testCheckout(token);
    
    console.log('\n' + '═'.repeat(50));
    console.log('✨ Test completed successfully!\n');
    
    if (process.env.SWISH_ENVIRONMENT === 'mock') {
      console.log('ℹ️  Currently in MOCK mode - no actual Swish API calls made.');
      console.log('   To test with MSS:');
      console.log('   1. Configure MSS certificates in Lambda');
      console.log('   2. Set SWISH_ENVIRONMENT=mss');
      console.log('   3. Redeploy and run this test again');
    } else if (process.env.SWISH_ENVIRONMENT === 'mss') {
      console.log('✅ MSS mode active - check CloudWatch logs for Swish API calls.');
      console.log('   Monitor callback logs: /aws/lambda/smultron-swish-callback-dev');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
