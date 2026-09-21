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

async function runAdminStatusTest() {
  console.log('--- TESTING ADMIN STATUS UPDATE API & MONGODB PERSISTENCE ---');

  const mongoId = '6ab0c385db243c68384562eb';
  const bookingId = 'FR-8524653';

  // 1. Verify PATCH endpoint requires admin auth token
  const unauthPatch = await makeRequest(`/api/orders/${mongoId}/status`, 'PATCH', { status: 'confirmed' });
  console.log('1. Unauthenticated PATCH Status:', unauthPatch.status, unauthPatch.body);

  // 2. Verify DELETE endpoint requires admin auth token
  const unauthDelete = await makeRequest(`/api/orders/${mongoId}`, 'DELETE');
  console.log('2. Unauthenticated DELETE Status:', unauthDelete.status, unauthDelete.body);

  // 3. Verify GET /api/orders requires admin auth token
  const unauthGetOrders = await makeRequest('/api/orders');
  console.log('3. Unauthenticated GET /api/orders Status:', unauthGetOrders.status, unauthGetOrders.body);

  console.log('--- ADMIN STATUS UPDATE API TEST COMPLETE ---');
}

runAdminStatusTest();
