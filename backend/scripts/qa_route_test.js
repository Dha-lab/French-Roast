import https from 'https';

const API_BASE = 'https://french-roast-backend.onrender.com';

const makeRequest = (path, method = 'GET', data = null, headers = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (e) { parsed = body; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', err => resolve({ status: 0, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 408, error: 'Timeout' }); });

    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

async function runApiAudit() {
  console.log('--- STARTING BACKEND API ROUTE AUDIT ---');

  // 1. GET /api/health
  const health = await makeRequest('/api/health');
  console.log('1. GET /api/health:', health.status, health.body);

  // 2. GET /api/products
  const products = await makeRequest('/api/products');
  console.log('2. GET /api/products:', products.status, 'Count:', products.body?.data?.length || 0);

  // 3. POST /api/orders (Invalid Delivery PIN - Delhi 110001)
  const invalidPin = await makeRequest('/api/orders', 'POST', {
    fullName: 'QA Test',
    phone: '9876543210',
    email: 'test@example.com',
    address: 'Connaught Place, Delhi',
    pinCode: '110001',
    variant: 'Powder',
    weight: '250g',
    quantity: 1
  });
  console.log('3. POST /api/orders (Invalid PIN 110001):', invalidPin.status, invalidPin.body);

  // 4. POST /api/orders (Invalid Pack Size - 500g)
  const invalidPack = await makeRequest('/api/orders', 'POST', {
    fullName: 'QA Test',
    phone: '9876543210',
    email: 'test@example.com',
    address: 'M.G. Road, Bengaluru',
    pinCode: '560001',
    variant: 'Powder',
    weight: '500g',
    quantity: 1
  });
  console.log('4. POST /api/orders (Invalid Pack 500g):', invalidPack.status, invalidPack.body);

  // 5. GET /api/admin/notifications/subscribers-count (Unauthenticated check)
  const subCountUnauth = await makeRequest('/api/admin/notifications/subscribers-count');
  console.log('5. GET /api/admin/notifications/subscribers-count (Unauthenticated):', subCountUnauth.status, subCountUnauth.body);

  // 6. POST /api/admin/login (Invalid credentials)
  const badLogin = await makeRequest('/api/admin/login', 'POST', {
    username: 'wronguser',
    password: 'wrongpassword'
  });
  console.log('6. POST /api/admin/login (Bad Credentials):', badLogin.status, badLogin.body);

  console.log('--- BACKEND API ROUTE AUDIT COMPLETE ---');
}

runApiAudit();
