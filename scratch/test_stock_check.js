const http = require('http');

function makeRequest(options, bodyData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (bodyData) req.write(JSON.stringify(bodyData));
    req.end();
  });
}

async function runStockTests() {
  console.log('--- STARTING STOCK CHECK & CONCURRENCY TESTS ---');

  // 0. Login as admin to get auth token for updating stock
  let adminToken = null;
  try {
    const loginRes = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'frenchroastadmin', password: 'AdminPassword123!' });
    if (loginRes.body.success && loginRes.body.accessToken) {
      adminToken = loginRes.body.accessToken;
      console.log('✓ Admin login successful for stock test harness');
    }
  } catch(e) {
    console.warn('Could not log in as admin:', e.message);
  }

  // Fetch initial product stock
  const initialRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/products',
    method: 'GET'
  });
  const powderProduct = initialRes.body.data.find(p => p.variant === 'Powder');
  const originalStock = powderProduct.stock;
  const prodId = powderProduct._id || powderProduct.id;
  console.log(`Original Powder stock: ${originalStock} (ID: ${prodId})`);

  // Helper to set stock via Admin API
  async function setStock(stockVal) {
    const headers = { 'Content-Type': 'application/json' };
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
    const res = await makeRequest({
      hostname: 'localhost',
      port: 5000,
      path: `/api/products/${prodId}`,
      method: 'PUT',
      headers
    }, { stock: stockVal });
    return res;
  }

  // TEST A: Stock Available (Stock = 2, Qty = 1)
  console.log('\n--- TEST A: Stock Available (Stock = 2, Qty = 1) ---');
  await setStock(2);
  const testAPayload = {
    name: 'Stock Test A',
    email: 'testa@example.com',
    phone: '9876543210',
    address: '123 Indiranagar, Bengaluru',
    pinCode: '560038',
    variant: 'Powder',
    quantity: 1,
    paymentMode: 'test',
    paymentStatus: 'simulated_success'
  };
  const testARes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/orders',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, testAPayload);
  console.log('Test A Response Status:', testARes.status);
  console.log('Test A Response Body:', testARes.body);

  const checkA = await makeRequest({ hostname: 'localhost', port: 5000, path: '/api/products', method: 'GET' });
  const stockA = checkA.body.data.find(p => p.variant === 'Powder').stock;
  console.log(`Powder stock after Test A: ${stockA} (expected 1)`);
  if (testARes.status === 201 && stockA === 1) {
    console.log('✓ PASS: Test A succeeded, stock decremented from 2 to 1');
  } else {
    console.error('❌ FAIL: Test A failed');
  }

  // TEST B: Stock = 0 (Stock = 0, Qty = 1)
  console.log('\n--- TEST B: Stock = 0 (Stock = 0, Qty = 1) ---');
  await setStock(0);
  const testBPayload = {
    name: 'Stock Test B',
    email: 'testb@example.com',
    phone: '9876543210',
    address: '123 Indiranagar, Bengaluru',
    pinCode: '560038',
    variant: 'Powder',
    quantity: 1,
    paymentMode: 'test',
    paymentStatus: 'simulated_success'
  };
  const testBRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/orders',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, testBPayload);
  console.log('Test B Response Status:', testBRes.status);
  console.log('Test B Response Message:', testBRes.body.message);

  const checkB = await makeRequest({ hostname: 'localhost', port: 5000, path: '/api/products', method: 'GET' });
  const stockB = checkB.body.data.find(p => p.variant === 'Powder').stock;
  console.log(`Powder stock after Test B: ${stockB} (expected 0)`);
  if (testBRes.status === 400 && testBRes.body.success === false && stockB === 0) {
    console.log('✓ PASS: Test B rejected with HTTP 400, 0 stock changed');
  } else {
    console.error('❌ FAIL: Test B failed');
  }

  // TEST C: Requested Qty > Available Stock (Stock = 1, Qty = 2)
  console.log('\n--- TEST C: Requested Qty > Available Stock (Stock = 1, Qty = 2) ---');
  await setStock(1);
  const testCPayload = {
    name: 'Stock Test C',
    email: 'testc@example.com',
    phone: '9876543210',
    address: '123 Indiranagar, Bengaluru',
    pinCode: '560038',
    variant: 'Powder',
    quantity: 2,
    paymentMode: 'test',
    paymentStatus: 'simulated_success'
  };
  const testCRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/orders',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, testCPayload);
  console.log('Test C Response Status:', testCRes.status);
  console.log('Test C Response Message:', testCRes.body.message);

  const checkC = await makeRequest({ hostname: 'localhost', port: 5000, path: '/api/products', method: 'GET' });
  const stockC = checkC.body.data.find(p => p.variant === 'Powder').stock;
  console.log(`Powder stock after Test C: ${stockC} (expected 1)`);
  if (testCRes.status === 400 && testCRes.body.success === false && stockC === 1) {
    console.log('✓ PASS: Test C rejected with HTTP 400, stock remained 1');
  } else {
    console.error('❌ FAIL: Test C failed');
  }

  // TEST D: Concurrency / Race Condition (Stock = 1)
  console.log('\n--- TEST D: Race Condition / Oversold Protection (Stock = 1) ---');
  await setStock(1);
  const payloadCustA = {
    name: 'Customer A',
    email: 'custA@example.com',
    phone: '9876543210',
    address: '123 Indiranagar, Bengaluru',
    pinCode: '560038',
    variant: 'Powder',
    quantity: 1,
    paymentMode: 'test',
    paymentStatus: 'simulated_success'
  };
  const payloadCustB = {
    name: 'Customer B',
    email: 'custB@example.com',
    phone: '9876543210',
    address: '123 Indiranagar, Bengaluru',
    pinCode: '560038',
    variant: 'Powder',
    quantity: 1,
    paymentMode: 'test',
    paymentStatus: 'simulated_success'
  };

  const [resA, resB] = await Promise.all([
    makeRequest({ hostname: 'localhost', port: 5000, path: '/api/orders', method: 'POST', headers: { 'Content-Type': 'application/json' } }, payloadCustA),
    makeRequest({ hostname: 'localhost', port: 5000, path: '/api/orders', method: 'POST', headers: { 'Content-Type': 'application/json' } }, payloadCustB)
  ]);

  console.log('Customer A Status:', resA.status, 'Success:', resA.body.success);
  console.log('Customer B Status:', resB.status, 'Success:', resB.body.success);

  const checkD = await makeRequest({ hostname: 'localhost', port: 5000, path: '/api/products', method: 'GET' });
  const stockD = checkD.body.data.find(p => p.variant === 'Powder').stock;
  console.log(`Powder stock after race test: ${stockD} (expected 0)`);

  const successCount = [resA, resB].filter(r => r.status === 201).length;
  const failureCount = [resA, resB].filter(r => r.status === 400).length;

  if (successCount === 1 && failureCount === 1 && stockD === 0) {
    console.log('✓ PASS: Concurrency protection verified! Exactly 1 order succeeded, 1 was rejected, 0 stock oversold.');
  } else {
    console.error('❌ FAIL: Race condition test failed!');
  }

  // RESTORE ORIGINAL STOCK
  console.log(`\nRestoring original Powder stock to ${originalStock}...`);
  await setStock(originalStock);
  console.log('✓ Restored test inventory successfully.');

  console.log('--- ALL STOCK & CONCURRENCY TESTS COMPLETE ---');
}

runStockTests().catch(console.error);
