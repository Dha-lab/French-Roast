import assert from 'node:assert';
import { validateAndBuildBlendSnapshot } from '../controllers/orderController.js';

console.log('\n======================================================================');
console.log('🧪 VERIFYING ARABICA–ROBUSTA MIXER & CHICORY SEPARATION');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

function runTest(description, fn) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

async function runAsyncTest(description, fn) {
  try {
    await fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// PART 1: INGREDIENT RATIOS & GRAM QUANTITY UNIT TESTS
// -------------------------------------------------------------
console.log('--- PART 1: Blend Snapshot & 250g Calculation Logic ---');

const activeBlendSettings = {
  customizationEnabled: true,
  packWeight: 250,
  defaultArabica: 70,
  defaultRobusta: 30,
  defaultChicory: 0,
  minArabica: 0,
  maxArabica: 100,
  minRobusta: 0,
  maxRobusta: 100,
  minChicory: 0,
  maxChicory: 0,
  step: 5,
  allowedPresets: ['70/30', '80/20', '60/40', '75/25']
};

runTest('Ratio 1 (70% Arabica / 30% Robusta): 175g Arabica + 75g Robusta = exactly 250g; Chicory = 0', () => {
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    { arabicaPercentage: 70, robustaPercentage: 30 },
    activeBlendSettings,
    1
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.arabicaPercentage, 70);
  assert.strictEqual(result.blend.robustaPercentage, 30);
  assert.strictEqual(result.blend.chicoryPercentage, 0);
  assert.strictEqual(result.blend.arabicaGrams, 175);
  assert.strictEqual(result.blend.robustaGrams, 75);
  assert.strictEqual(result.blend.chicoryGrams, 0);
  assert.strictEqual(result.blend.arabicaGrams + result.blend.robustaGrams, 250);
  assert.strictEqual(result.blend.totalArabicaGrams, 175);
  assert.strictEqual(result.blend.totalRobustaGrams, 75);
  assert.strictEqual(result.blend.totalGrams, 250);
});

runTest('Ratio 2 (80% Arabica / 20% Robusta): 200g Arabica + 50g Robusta = exactly 250g; Chicory = 0', () => {
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    { arabicaPercentage: 80, robustaPercentage: 20 },
    activeBlendSettings,
    1
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.arabicaPercentage, 80);
  assert.strictEqual(result.blend.robustaPercentage, 20);
  assert.strictEqual(result.blend.chicoryPercentage, 0);
  assert.strictEqual(result.blend.arabicaGrams, 200);
  assert.strictEqual(result.blend.robustaGrams, 50);
  assert.strictEqual(result.blend.arabicaGrams + result.blend.robustaGrams, 250);
});

runTest('Ratio 3 (60% Arabica / 40% Robusta): 150g Arabica + 100g Robusta = exactly 250g; Chicory = 0', () => {
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    { arabicaPercentage: 60, robustaPercentage: 40 },
    activeBlendSettings,
    1
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.arabicaPercentage, 60);
  assert.strictEqual(result.blend.robustaPercentage, 40);
  assert.strictEqual(result.blend.arabicaGrams, 150);
  assert.strictEqual(result.blend.robustaGrams, 100);
  assert.strictEqual(result.blend.arabicaGrams + result.blend.robustaGrams, 250);
});

runTest('Multi-pack scaling (2 packs @ 70/30): 350g Arabica + 150g Robusta = 500g total', () => {
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    { arabicaPercentage: 70, robustaPercentage: 30 },
    activeBlendSettings,
    2
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.totalArabicaGrams, 350);
  assert.strictEqual(result.blend.totalRobustaGrams, 150);
  assert.strictEqual(result.blend.totalArabicaGrams + result.blend.totalRobustaGrams, 500);
});

runTest('Validation rejection when Arabica + Robusta != 100% (e.g. 70% + 20% = 90%)', () => {
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    { arabicaPercentage: 70, robustaPercentage: 20 },
    activeBlendSettings,
    1
  );
  assert.strictEqual(result.valid, false);
  assert.match(result.message, /must total exactly 100%/i);
});

runTest('Whole Bean ordering returns undefined blend (pure coffee beans)', () => {
  const result = validateAndBuildBlendSnapshot(
    'Whole Bean',
    { arabicaPercentage: 70, robustaPercentage: 30 },
    activeBlendSettings,
    1
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend, undefined);
});

// -------------------------------------------------------------
// PART 2: LIVE BACKEND API END-TO-END VALIDATION
// -------------------------------------------------------------
console.log('\n--- PART 2: Live Backend API End-to-End Tests ---');

const BASE_URL = 'http://localhost:5000';

async function main() {
  await runAsyncTest('Public blend settings endpoint exposes Arabica–Robusta defaults without Chicory', async () => {
    const res = await fetch(`${BASE_URL}/api/products/blend-settings`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.defaultArabica, 70);
    assert.strictEqual(json.data.defaultRobusta, 30);
    assert.strictEqual(json.data.defaultChicory, 0);
    assert.strictEqual(json.data.packWeight, 250);
  });

  let createdPowderOrderId = null;

  await runAsyncTest('Create new Powder order with 70% Arabica / 30% Robusta customized ratio', async () => {
    const payload = {
      fullName: 'Arabica Robusta Tester',
      phone: '9999900000',
      email: 'test-mixer-70-30@example.com',
      address: '100 Coffee Bean Way, Indiranagar',
      pinCode: '560038',
      variant: 'Powder',
      packSize: '250g',
      quantity: 1,
      arabicaPercentage: 70,
      robustaPercentage: 30,
      paymentMode: 'test',
      status: 'pending'
    };

    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data);
    createdPowderOrderId = json.data.id || json.data._id;

    // Verify blend snapshot in API response
    const blend = json.data.blend;
    assert.ok(blend, 'Blend snapshot must be present in order creation response');
    assert.strictEqual(blend.arabicaPercentage, 70);
    assert.strictEqual(blend.robustaPercentage, 30);
    assert.strictEqual(blend.chicoryPercentage, 0);
    assert.strictEqual(blend.arabicaGrams, 175);
    assert.strictEqual(blend.robustaGrams, 75);
    assert.strictEqual(blend.chicoryGrams, 0);
    assert.strictEqual(blend.totalGrams, 250);
  });

  await runAsyncTest('Create new Whole Bean order: blend details remain undefined', async () => {
    const payload = {
      fullName: 'Whole Bean Tester',
      phone: '9999900000',
      email: 'test-whole-bean@example.com',
      address: '101 Whole Bean Street, Koramangala',
      pinCode: '560034',
      variant: 'Whole Bean',
      packSize: '250g',
      quantity: 1,
      paymentMode: 'test',
      status: 'pending'
    };

    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.variant, 'Whole Bean');
    assert.ok(!json.data.blend, 'Whole Bean blend must be null/undefined');
  });

  await runAsyncTest('Create Waiting Pre-Order with Arabica 80% / Robusta 20%: blend preserved with status "waiting"', async () => {
    const payload = {
      fullName: 'Waiting List Tester',
      phone: '9999900000',
      email: 'test-waiting-list@example.com',
      address: '102 Waiting Pre-Order Rd, Whitefield',
      pinCode: '560066',
      variant: 'Powder',
      packSize: '250g',
      quantity: 1,
      arabicaPercentage: 80,
      robustaPercentage: 20,
      isWaitingPreorder: true
    };

    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.status, 'waiting');
    const blend = json.data.blend;
    assert.ok(blend);
    assert.strictEqual(blend.arabicaPercentage, 80);
    assert.strictEqual(blend.robustaPercentage, 20);
    assert.strictEqual(blend.arabicaGrams, 200);
    assert.strictEqual(blend.robustaGrams, 50);
  });

  // -------------------------------------------------------------
  // PART 3: ADMIN PANEL BLEND PERSISTENCE & PARSER VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- PART 3: Admin Panel Display & Persistence Check ---');

  await runAsyncTest('Admin API retrieves saved blend and parseBlendInfo formats 2-ingredient badge without chicory', async () => {
    // 1. Authenticate admin
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'frenchroastadmin',
        password: 'AdminPassword123!'
      })
    });
    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.strictEqual(loginData.success, true);
    const token = loginData.accessToken || loginData.token;

    // 2. Fetch admin orders list via GET /api/orders with admin auth
    const ordersRes = await fetch(`${BASE_URL}/api/orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(ordersRes.status, 200);
    const ordersData = await ordersRes.json();
    assert.strictEqual(ordersData.success, true);

    const foundOrder = ordersData.data.find(o => (o.id === createdPowderOrderId || o._id === createdPowderOrderId));
    assert.ok(foundOrder, `Created order ${createdPowderOrderId} must exist in admin orders list`);

    // Verify raw blend data in MongoDB
    assert.ok(foundOrder.blend, 'foundOrder.blend must be present');
    assert.strictEqual(foundOrder.blend.arabicaPercentage, 70);
    assert.strictEqual(foundOrder.blend.robustaPercentage, 30);
    assert.strictEqual(foundOrder.blend.arabicaGrams, 175);
    assert.strictEqual(foundOrder.blend.robustaGrams, 75);

    // 3. Test parseBlendInfo logic (exact replication of admin/src/main.js parseBlendInfo)
    function parseBlendInfo(item) {
      if (!item) return { isPowder: false, isCustomized: false, valid: false };
      const variant = String(item.variant || item.productType || '').toLowerCase();
      const isPowder = variant.includes('powder');
      if (!isPowder) return { isPowder: false, isCustomized: false, valid: false };

      const b = item.blend;
      const aPct = (b && typeof b.arabicaPercentage === 'number') ? b.arabicaPercentage : item.arabicaPercentage;
      const rPct = (b && typeof b.robustaPercentage === 'number') ? b.robustaPercentage : item.robustaPercentage;
      const cPct = (b && typeof b.chicoryPercentage === 'number') ? b.chicoryPercentage : item.chicoryPercentage;

      const hasValidArabica = typeof aPct === 'number' && !isNaN(aPct) && aPct >= 0 && aPct <= 100;
      const hasValidRobusta = typeof rPct === 'number' && !isNaN(rPct) && rPct >= 0 && rPct <= 100;

      if (!hasValidArabica || !hasValidRobusta) {
        return { isPowder: true, isCustomized: false, valid: false, reason: 'missing_percentages' };
      }

      const totalPct = Math.round((aPct + rPct + (cPct || 0)) * 10) / 10;
      const validTotal = Math.abs(totalPct - 100) <= 1.0;
      const hasChicory = typeof cPct === 'number' && !isNaN(cPct) && cPct > 0;

      let aG = (b && typeof b.arabicaGrams === 'number') ? b.arabicaGrams : item.arabicaGrams;
      let rG = (b && typeof b.robustaGrams === 'number') ? b.robustaGrams : item.robustaGrams;

      if (typeof aG !== 'number' || isNaN(aG) || typeof rG !== 'number' || isNaN(rG)) {
        aG = Math.round((250 * aPct / 100) * 10) / 10;
        rG = Math.round((250 * rPct / 100) * 10) / 10;
      }

      const badgeText = hasChicory
        ? `☕ ${aPct}%A / ${rPct}%R / ${cPct}%C (${aG}g / ${rG}g / ${b?.chicoryGrams || 0}g)`
        : `☕ ${aPct}%A / ${rPct}%R (${aG}g / ${rG}g)`;

      return {
        isPowder: true,
        valid: validTotal,
        hasChicory,
        arabicaPct: aPct,
        robustaPct: rPct,
        arabicaGrams: aG,
        robustaGrams: rG,
        badgeText
      };
    }

    const blendInfo = parseBlendInfo(foundOrder);
    assert.strictEqual(blendInfo.valid, true, 'Blend info must be valid');
    assert.strictEqual(blendInfo.hasChicory, false, 'Chicory must NOT be in blend');
    assert.strictEqual(blendInfo.arabicaPct, 70);
    assert.strictEqual(blendInfo.robustaPct, 30);
    assert.strictEqual(blendInfo.arabicaGrams, 175);
    assert.strictEqual(blendInfo.robustaGrams, 75);
    assert.strictEqual(blendInfo.badgeText, '☕ 70%A / 30%R (175g / 75g)');
    console.log(`    Badge output in admin panel: "${blendInfo.badgeText}"`);
  });

  console.log('\n======================================================================');
  console.log(`📊 TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
