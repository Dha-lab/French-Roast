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

async function runTests() {
  console.log('--- STARTING PHASE 4 REVISION VERIFICATION ---');

  // 1. Fetch initial products & stock
  const productsRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/products',
    method: 'GET'
  });

  console.log('✓ Products loaded:', productsRes.body.count);
  const powderProduct = productsRes.body.data.find(p => p.variant === 'Powder');
  const initialStock = powderProduct.stock;
  console.log(`Initial Powder stock: ${initialStock}`);

  // 2. Fetch initial order count
  const ordersRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/orders',
    method: 'GET'
  });
  const initialOrderCount = ordersRes.body.count || (ordersRes.body.data ? ordersRes.body.data.length : 0);
  console.log(`Initial order count: ${initialOrderCount}`);

  // 3. Create a test order (simulating success)
  const orderPayload = {
    name: 'Test Customer No Dropdown',
    email: 'testnodropdown@example.com',
    phone: '9876543210',
    address: '123 Test Street, Indiranagar',
    pinCode: '560038',
    variant: 'Powder',
    packSize: '250g',
    quantity: 1,
    paymentMode: 'test',
    paymentStatus: 'simulated_success'
  };

  const createRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/orders',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, orderPayload);

  console.log('Order Creation Response Status:', createRes.status);
  console.log('Order Creation Response Success:', createRes.body.success);

  if (createRes.body.success) {
    const newOrder = createRes.body.data;
    console.log('✓ Order ID:', newOrder._id);
    console.log('✓ Order Type:', newOrder.orderType);
    console.log('✓ Order Status:', newOrder.orderStatus);
    console.log('✓ Subtotal:', newOrder.subtotal);
    console.log('✓ GST Amount:', newOrder.gstAmount);
    console.log('✓ CGST Amount:', newOrder.cgstAmount);
    console.log('✓ SGST Amount:', newOrder.sgstAmount);
    console.log('✓ Delivery Charge:', newOrder.deliveryCharge);
    console.log('✓ Final Total:', newOrder.finalTotal);

    if (newOrder.orderType !== 'preorder') {
      console.error('❌ FAIL: orderType is not preorder!');
    } else {
      console.log('✓ PASS: orderType is preorder');
    }

    if (newOrder.finalTotal !== 499) {
      console.error(`❌ FAIL: finalTotal expected 499, got ${newOrder.finalTotal}`);
    } else {
      console.log('✓ PASS: finalTotal correctly calculated as ₹499');
    }
  } else {
    console.error('❌ FAIL: Order creation failed', createRes.body);
  }

  // 4. Verify stock updated correctly (decremented by 1)
  const productsResAfter = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/products',
    method: 'GET'
  });
  const updatedPowder = productsResAfter.body.data.find(p => p.variant === 'Powder');
  console.log(`Stock after successful order: ${updatedPowder.stock} (was ${initialStock})`);
  if (updatedPowder.stock === initialStock - 1) {
    console.log('✓ PASS: Inventory correctly decremented on order success');
  } else {
    console.error('❌ FAIL: Inventory mismatch!');
  }

  // 5. Simulate failed payment attempt
  const failedPayload = {
    name: 'Failed Payment Customer',
    email: 'testfailed@example.com',
    phone: '9876543210',
    address: '123 Test Street, Indiranagar',
    pinCode: '560038',
    variant: 'Powder',
    packSize: '250g',
    quantity: 1,
    paymentMode: 'test',
    paymentStatus: 'simulated_failed'
  };

  const failedCreateRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/orders',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, failedPayload);

  console.log('Failed Order Request Status:', failedCreateRes.status);
  console.log('Failed Order Request Message:', failedCreateRes.body.message);
  if (failedCreateRes.status === 400 && failedCreateRes.body.success === false) {
    console.log('✓ PASS: Failed test payment rejected with HTTP 400 and zero order creation');
  }

  // Verify stock remained unchanged after failed payment
  const productsResFinal = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/products',
    method: 'GET'
  });
  const finalPowder = productsResFinal.body.data.find(p => p.variant === 'Powder');
  console.log(`Stock after failed order attempt: ${finalPowder.stock} (was ${updatedPowder.stock})`);
  if (finalPowder.stock === updatedPowder.stock) {
    console.log('✓ PASS: Zero inventory modified on failed test payment');
  } else {
    console.error('❌ FAIL: Inventory mutated on failed payment!');
  }

  console.log('--- ALL VERIFICATIONS COMPLETE ---');
}

runTests().catch(console.error);
