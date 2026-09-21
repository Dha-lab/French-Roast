import https from 'https';

const API_BASE = 'https://french-roast-backend.onrender.com';

const makeRequest = (path, method = 'GET', data = null, headers = {}) => {
  return new Promise((resolve) => {
    const url = new URL(`${API_BASE}${path}`);
    const req = https.request({
      method,
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 15000
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

async function testAdminOrderFlow() {
  console.log('--- TESTING ADMIN AUTH & ORDER DETAILS ACCESS ---');

  // Test 1: Unauthenticated request to /api/orders
  const unauthRes = await makeRequest('/api/orders');
  console.log('Unauthenticated GET /api/orders:', unauthRes.status, unauthRes.body);

  // Test 2: Unauthenticated request to /api/orders/FR-8524653
  const unauthOrderRes = await makeRequest('/api/orders/FR-8524653');
  console.log('Unauthenticated GET /api/orders/FR-8524653:', unauthOrderRes.status, unauthOrderRes.body);

  // Test 3: Unauthenticated PATCH /api/orders/FR-8524653/status
  const unauthPatchRes = await makeRequest('/api/orders/FR-8524653/status', 'PATCH', { status: 'confirmed' });
  console.log('Unauthenticated PATCH /api/orders/FR-8524653/status:', unauthPatchRes.status, unauthPatchRes.body);

  console.log('--- ADMIN AUTH & PROTECTION TEST COMPLETE ---');
}

testAdminOrderFlow();
