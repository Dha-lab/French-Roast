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

async function verifyQaOrderInBackend() {
  console.log('--- VERIFYING QA ORDER FR-8524653 IN MONGODB & API ---');

  // 1. GET /api/orders/FR-8524653
  const orderRes = await makeRequest('/api/orders/FR-8524653');
  console.log('GET /api/orders/FR-8524653 Status:', orderRes.status);
  console.log('Order Data:', JSON.stringify(orderRes.body, null, 2));

  // 2. Test status update PATCH /api/orders/FR-8524653/status to 'confirmed'
  const patchRes = await makeRequest('/api/orders/FR-8524653/status', 'PATCH', { status: 'confirmed' });
  console.log('PATCH Status Update Status:', patchRes.status, patchRes.body);

  // 3. Verify status persisted
  const verifyPatch = await makeRequest('/api/orders/FR-8524653');
  console.log('Re-verify Status in MongoDB:', verifyPatch.body?.data?.status);

  // 4. Revert status back to 'pending' to keep QA order clean
  await makeRequest('/api/orders/FR-8524653/status', 'PATCH', { status: 'pending' });

  console.log('--- QA ORDER VERIFICATION COMPLETE ---');
}

verifyQaOrderInBackend();
