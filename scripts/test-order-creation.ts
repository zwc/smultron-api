#!/usr/bin/env bun

// Quick test script to debug order creation
const API_URL = process.env.API_URL || 'https://dev.smultron.zwc.se/v1';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error('ADMIN_PASSWORD environment variable required');
  process.exit(1);
}

async function main() {
  console.log('Testing order creation against:', API_URL);
  
  // 1. Login
  console.log('\n1. Logging in...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  
  if (!loginRes.ok) {
    console.error('Login failed:', loginRes.status, await loginRes.text());
    process.exit(1);
  }
  
  const { token } = await loginRes.json() as any;
  console.log('✓ Logged in successfully');
  
  // 2. Create test product
  console.log('\n2. Creating test product...');
  const productRes = await fetch(`${API_URL}/admin/products`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      slug: `test-order-debug-${Date.now()}`,
      category: 'test',
      article: 'TEST-DEBUG',
      brand: 'Test',
      title: 'Debug Test Product',
      subtitle: 'For testing',
      price: 100,
      stock: 50,
      image: 'test.jpg',
      status: 'active',
    }),
  });
  
  if (!productRes.ok) {
    console.error('Product creation failed:', productRes.status, await productRes.text());
    process.exit(1);
  }
  
  const { data: product } = await productRes.json() as any;
  console.log('✓ Created product:', product.id, product.title);
  
  // 3. Create order
  console.log('\n3. Creating order...');
  const orderRes = await fetch(`${API_URL}/admin/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      information: {
        name: 'Debug Test',
        company: '',
        address: 'Test Street 1',
        zip: '12345',
        city: 'Test City',
        email: 'debug@test.com',
        phone: '1234567890',
      },
      cart: [{ id: product.id, number: 1 }],
      order: {
        delivery: 'test-delivery',
        delivery_cost: 50,
      },
    }),
  });
  
  console.log('Order creation response status:', orderRes.status);
  const orderResponseText = await orderRes.text();
  console.log('Order creation response:', orderResponseText);
  
  if (!orderRes.ok) {
    console.error('✗ Order creation failed');
    
    // Try to get CloudWatch logs hint
    console.log('\n📝 To check CloudWatch logs:');
    console.log(`aws logs tail /aws/lambda/smultron-create-order-dev --follow --format short`);
    
    process.exit(1);
  }
  
  const orderData = JSON.parse(orderResponseText);
  console.log('✓ Order created successfully!');
  console.log('  Order ID:', orderData.data.id);
  console.log('  Order Number:', orderData.data.number);
  console.log('  Status:', orderData.data.status);
  console.log('  Date:', new Date(orderData.data.date));
  console.log('  Frozen cart items:', orderData.data.cart.length);
  console.log('  First item:', orderData.data.cart[0].title, '-', orderData.data.cart[0].price, 'SEK');
}

main().catch(console.error);
