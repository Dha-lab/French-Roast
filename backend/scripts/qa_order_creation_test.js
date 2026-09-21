import https from 'https';

const API_BASE = 'https://french-roast-backend.onrender.com';

const makeRequest = (path, method = 'POST', data = null) => {
  return new Promise((resolve) => {
    const url = new URL(`${API_BASE}${path}`);
    const req = https.request({
      method,
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 20000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, body }); }
      });
    });

    req.on('error', err => resolve({ status: 0, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 408, error: 'Timeout' }); });

    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

async function testValidQaOrder() {
  console.log('--- TESTING SINGLE VALID QA ORDER CREATION ---');

  const qaOrderPayload = {
    fullName: 'French Roast QA Test',
    phone: '9876543210',
    email: 'saidhanush215@gmail.com',
    address: 'Test delivery address, M.G. Road, Bengaluru',
    pinCode: '560001',
    variant: 'Powder',
    weight: '250g',
    quantity: 1,
    notes: 'Automated QA test order',
    emailOptIn: true
  };

  const res = await makeRequest('/api/orders', 'POST', qaOrderPayload);
  console.log('Order Creation Response Status:', res.status);
  console.log('Order Creation Response Body:', JSON.stringify(res.body, null, 2));

  console.log('--- QA ORDER CREATION COMPLETE ---');
}

testValidQaOrder();
