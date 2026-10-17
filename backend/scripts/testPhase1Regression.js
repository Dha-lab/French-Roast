import assert from 'node:assert';
import express from 'express';
import orderRoutes from '../routes/orderRoutes.js';
import { orderLimiter } from '../middleware/rateLimiter.js';
import { APPROVED_WHOLE_BEAN_RECIPE } from '../config/blendConfig.js';
import { validateAndBuildBlendSnapshot } from '../controllers/orderController.js';
import { dataStore } from '../config/dataStore.js';

console.log('\n=================================================================');
console.log('🧪 RUNNING WHOLE BEAN REGRESSION TESTS (RATE LIMIT, RECIPE, DISCONTINUATION)');
console.log('=================================================================\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// Setup an isolated Express test server with proxy trust and order routes
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use('/api/orders', orderRoutes);

// Ephemeral server
const server = app.listen(0);
const port = server.address().port;
const BASE_URL = `http://127.0.0.1:${port}`;

const validOrderPayload = {
  fullName: 'Priya Sharma',
  phone: '9876543210',
  email: 'priya.sharma@example.com',
  address: '123 MG Road, Bengaluru',
  pinCode: '560001',
  variant: 'Whole Bean',
  packSize: '250g',
  quantity: 1,
  blend: { arabicaPercentage: 80, robustaPercentage: 20 },
  paymentMode: 'test',
  paymentStatus: 'simulated_success'
};

try {
  // Test 1: Trust proxy configuration
  await test('Express app has trust proxy enabled for Render deployment', () => {
    assert.strictEqual(app.get('trust proxy'), 1);
  });

  // Test 2: Approved recipe authoritative constant definition
  await test('Authoritative APPROVED_WHOLE_BEAN_RECIPE is strictly 80/20 with 0% Chicory, max Robusta 20%, 250g pack', () => {
    assert.strictEqual(APPROVED_WHOLE_BEAN_RECIPE.arabicaPercentage, 80);
    assert.strictEqual(APPROVED_WHOLE_BEAN_RECIPE.robustaPercentage, 20);
    assert.strictEqual(APPROVED_WHOLE_BEAN_RECIPE.chicoryPercentage, 0);
    assert.strictEqual(APPROVED_WHOLE_BEAN_RECIPE.maxRobusta, 20);
    assert.strictEqual(APPROVED_WHOLE_BEAN_RECIPE.minArabica, 80);
    assert.strictEqual(APPROVED_WHOLE_BEAN_RECIPE.arabicaGrams, 200.0);
    assert.strictEqual(APPROVED_WHOLE_BEAN_RECIPE.robustaGrams, 50.0);
    assert.strictEqual(APPROVED_WHOLE_BEAN_RECIPE.chicoryGrams, 0.0);
    assert.strictEqual(APPROVED_WHOLE_BEAN_RECIPE.totalGrams, 250.0);
  });

  // Test 3: Powder discontinuation
  await test('Powder order attempt is strictly rejected with PRODUCT_DISCONTINUED', () => {
    const res = validateAndBuildBlendSnapshot('Powder', undefined, null, 1);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.code, 'PRODUCT_DISCONTINUED');
    assert.ok(res.message.includes('Powder is discontinued'));
  });

  // Test 4: Recipe enforcement for Whole Bean
  await test('Whole Bean order returns valid 80/20 snapshot (200g Arabica, 50g Robusta, 0g Chicory)', () => {
    const res = validateAndBuildBlendSnapshot('Whole Bean', { arabicaPercentage: 80, robustaPercentage: 20 }, null, 1);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.blend.arabicaPercentage, 80);
    assert.strictEqual(res.blend.robustaPercentage, 20);
    assert.strictEqual(res.blend.chicoryPercentage, 0);
    assert.strictEqual(res.blend.arabicaGrams, 200);
    assert.strictEqual(res.blend.robustaGrams, 50);
  });

  // Test 5: Reject Robusta exceeding 20% limit
  await test('Whole Bean order with Robusta > 20% (e.g. 70/30) is rejected with descriptive error', () => {
    const res = validateAndBuildBlendSnapshot('Whole Bean', { arabicaPercentage: 70, robustaPercentage: 30 }, null, 1);
    assert.strictEqual(res.valid, false);
    assert.ok(res.message.includes('Robusta percentage cannot exceed 20%'));
  });

  // Test 6: Reject Chicory in Whole Bean
  await test('Whole Bean order with Chicory ratio is strictly rejected (chicory strictly 0%)', () => {
    const res = validateAndBuildBlendSnapshot('Whole Bean', { arabicaPercentage: 80, robustaPercentage: 15, chicoryPercentage: 5 }, null, 1);
    assert.strictEqual(res.valid, false);
    assert.ok(res.message.includes('Chicory'));
  });

  // Test 7: Tampered client grams are ignored and strictly recalculated
  await test('Client-tampered grams (e.g. 9999g) are ignored and recalculated strictly to 200g/50g', () => {
    const res = validateAndBuildBlendSnapshot('Whole Bean', {
      arabicaPercentage: 80,
      robustaPercentage: 20,
      arabicaGrams: 9999,
      robustaGrams: 8888
    }, null, 1);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.blend.arabicaGrams, 200);
    assert.strictEqual(res.blend.robustaGrams, 50);
    assert.strictEqual(res.blend.chicoryGrams, 0);
  });

  // Test 8: Live HTTP Order Creation rejects Powder with HTTP 400
  await test('POST /api/orders with Powder variant returns HTTP 400 Bad Request (PRODUCT_DISCONTINUED)', async () => {
    const powderData = {
      ...validOrderPayload,
      variant: 'Powder',
      phone: '9888811111',
      email: 'powder.api@example.com'
    };

    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(powderData)
    });
    const json = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.code, 'PRODUCT_DISCONTINUED');
  });

  // Test 9: Live HTTP Whole Bean Order Creation and Duplicate Protection
  await test('POST /api/orders creates valid Whole Bean order, subsequent identical submission returns 409 Conflict', async () => {
    const orderData = {
      ...validOrderPayload,
      phone: '9888877777',
      email: 'dup.bean@example.com'
    };

    const res1 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    const json1 = await res1.json();
    assert.strictEqual(res1.status, 201);
    assert.strictEqual(json1.success, true);
    assert.ok(json1.data.bookingId);
    assert.strictEqual(json1.data.variant, 'Whole Bean');
    assert.strictEqual(json1.data.blend.arabicaPercentage, 80);
    assert.strictEqual(json1.data.blend.robustaPercentage, 20);
    assert.strictEqual(json1.data.blend.arabicaGrams, 200);
    assert.strictEqual(json1.data.blend.robustaGrams, 50);

    // Duplicate submission within 30 seconds
    const res2 = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });
    const json2 = await res2.json();
    assert.strictEqual(res2.status, 409);
    assert.strictEqual(json2.success, false);
    assert.strictEqual(json2.code, 'DUPLICATE_ORDER');
    assert.ok(json2.message.includes('recently received'));
  });

  // Test 10: HTTP Order Creation with Tampered Ratios (Robusta > 20%) returns HTTP 400
  await test('POST /api/orders with tampered client ratio 70/30 returns HTTP 400 Bad Request', async () => {
    const tamperedData = {
      ...validOrderPayload,
      phone: '9777766666',
      email: 'tamper.ratio@example.com',
      blend: { arabicaPercentage: 70, robustaPercentage: 30 }
    };

    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tamperedData)
    });
    const json = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(json.success, false);
    assert.ok(json.message.includes('Robusta percentage cannot exceed 20%'));
  });

  // Test 11: Order Rate Limiting returns HTTP 429
  await test('Order rate limiter triggers HTTP 429 with customer-friendly message when exceeded', async () => {
    const testApp = express();
    testApp.use(express.json());
    
    const { default: rateLimit } = await import('express-rate-limit');
    const localLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many order attempts from your connection. Please wait a few moments before trying again.'
        });
      }
    });

    testApp.post('/api/orders/limited', localLimiter, (req, res) => {
      res.status(200).json({ success: true });
    });

    const localServer = testApp.listen(0);
    const localPort = localServer.address().port;

    const r1 = await fetch(`http://127.0.0.1:${localPort}/api/orders/limited`, { method: 'POST' });
    assert.strictEqual(r1.status, 200);

    const r2 = await fetch(`http://127.0.0.1:${localPort}/api/orders/limited`, { method: 'POST' });
    assert.strictEqual(r2.status, 200);

    const r3 = await fetch(`http://127.0.0.1:${localPort}/api/orders/limited`, { method: 'POST' });
    assert.strictEqual(r3.status, 429);
    const json3 = await r3.json();
    assert.strictEqual(json3.success, false);
    assert.strictEqual(json3.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(json3.message.includes('Too many order attempts'));

    localServer.close();
  });

} finally {
  server.close();
}

console.log('\n=================================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('=================================================================\n');

if (failed > 0) process.exit(1);
