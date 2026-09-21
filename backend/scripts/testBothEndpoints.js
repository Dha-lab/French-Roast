import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

async function testEndpoints() {
  const baseUrl = 'http://localhost:5000';
  
  // Step 1: Login
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.ADMIN_USERNAME || 'frenchroastadmin',
      password: process.env.ADMIN_PASSWORD || 'FrenchRoast2026!Admin'
    })
  });

  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.accessToken) {
    console.error('Login failed:', loginData);
    process.exit(1);
  }

  const token = loginData.accessToken;
  console.log('✅ Admin login successful.');

  // Step 2: Fetch Count Endpoint
  const countRes = await fetch(`${baseUrl}/api/admin/notifications/subscribers-count`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const countData = await countRes.json();
  console.log('\n--- 1. GET /api/admin/notifications/subscribers-count ---');
  console.log('HTTP Status:', countRes.status);
  console.log('Response:', countData);

  // Step 3: Fetch Subscribers List Endpoint
  const listRes = await fetch(`${baseUrl}/api/admin/notifications/subscribers`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const listData = await listRes.json();
  console.log('\n--- 2. GET /api/admin/notifications/subscribers ---');
  console.log('HTTP Status:', listRes.status);
  console.log('Response Count:', listData.count);
  console.log('Subscribers Length:', listData.subscribers ? listData.subscribers.length : 0);
  console.log('Subscribers List:');
  console.dir(listData.subscribers, { depth: null });

  console.log('\n--- MATCH CHECK ---');
  console.log(`Count API count: ${countData.count}`);
  console.log(`List API count: ${listData.count}`);
  console.log(`List Subscribers Array length: ${listData.subscribers.length}`);
  
  if (countData.count === listData.count && listData.count === listData.subscribers.length) {
    console.log('✅ PERFECT MATCH: All 3 values equal', countData.count);
  } else {
    console.error('❌ MISMATCH DETECTED!');
  }
}

testEndpoints().catch(console.error);
