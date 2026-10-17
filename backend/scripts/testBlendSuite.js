import assert from 'assert';
import { validateAndBuildBlendSnapshot } from '../controllers/orderController.js';
import { dataStore } from '../config/dataStore.js';
import { APPROVED_WHOLE_BEAN_RECIPE } from '../config/blendConfig.js';
import { getOrderConfirmationTemplate, getWaitingPreorderConfirmationTemplate } from '../services/emailTemplates.js';

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function itAsync(name, fn) {
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

console.log('\n================================================================');
console.log('🧪 RUNNING FRENCH ROAST WHOLE BEAN & BLEND SLIDER TEST SUITE');
console.log('================================================================\n');

// ---------------------------------------------------------------------------
// SUITE 1: WHOLE BEAN ONLY - POWDER DISCONTINUATION
// ---------------------------------------------------------------------------
console.log('--- SUITE 1: Whole Bean Only & Powder Discontinuation ---');

it('Attempting to order Powder is strictly rejected with PRODUCT_DISCONTINUED', () => {
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    { arabicaPercentage: 80, robustaPercentage: 20 },
    APPROVED_WHOLE_BEAN_RECIPE,
    1
  );
  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.code, 'PRODUCT_DISCONTINUED');
  assert.ok(result.message.includes('Whole Bean is the only available product'));
});

await itAsync('dataStore.createOrder rejects Powder with descriptive error', async () => {
  let thrown = false;
  try {
    await dataStore.createOrder({
      name: 'Powder Attempt Customer',
      email: 'powder@test.com',
      phone: '9876543210',
      address: 'Test City',
      pinCode: '560001',
      variant: 'Powder',
      packSize: '250g',
      quantity: 1
    });
  } catch (err) {
    thrown = true;
    assert.ok(err.message.includes('Whole Bean is the only available product'));
  }
  assert.strictEqual(thrown, true, 'createOrder should throw when variant is Powder');
});

await itAsync('dataStore active products returns only Whole Bean at ₹599', async () => {
  const products = await dataStore.getProducts();
  assert.strictEqual(products.length, 1);
  assert.strictEqual(products[0].variant, 'Whole Bean');
  assert.strictEqual(products[0].price, 599);
});

// ---------------------------------------------------------------------------
// SUITE 2: WHOLE BEAN BLEND RULES (0-20% ROBUSTA, 80-100% ARABICA)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 2: Whole Bean Blend Arithmetic & Boundaries ---');

it('Default 80% Arabica / 20% Robusta builds valid snapshot with exact grams', () => {
  const result = validateAndBuildBlendSnapshot(
    'Whole Bean',
    { arabicaPercentage: 80, robustaPercentage: 20 },
    APPROVED_WHOLE_BEAN_RECIPE,
    1
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.arabicaPercentage, 80);
  assert.strictEqual(result.blend.robustaPercentage, 20);
  assert.strictEqual(result.blend.chicoryPercentage, 0);
  assert.strictEqual(result.blend.arabicaGrams, 200);
  assert.strictEqual(result.blend.robustaGrams, 50);
  assert.strictEqual(result.blend.chicoryGrams, 0);
  assert.strictEqual(result.blend.totalGrams, 250);
});

it('Boundary test: 100% Arabica / 0% Robusta (Single Origin Profile)', () => {
  const result = validateAndBuildBlendSnapshot(
    'Whole Bean',
    { arabicaPercentage: 100, robustaPercentage: 0 },
    APPROVED_WHOLE_BEAN_RECIPE,
    1
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.arabicaPercentage, 100);
  assert.strictEqual(result.blend.robustaPercentage, 0);
  assert.strictEqual(result.blend.arabicaGrams, 250);
  assert.strictEqual(result.blend.robustaGrams, 0);
  assert.strictEqual(result.blend.totalGrams, 250);
});

it('Valid preset: 85% Arabica / 15% Robusta', () => {
  const result = validateAndBuildBlendSnapshot(
    'Whole Bean',
    { arabicaPercentage: 85, robustaPercentage: 15 },
    APPROVED_WHOLE_BEAN_RECIPE,
    1
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.arabicaPercentage, 85);
  assert.strictEqual(result.blend.robustaPercentage, 15);
  assert.strictEqual(result.blend.arabicaGrams, 212.5);
  assert.strictEqual(result.blend.robustaGrams, 37.5);
  assert.strictEqual(result.blend.totalGrams, 250);
});

it('Valid preset: 90% Arabica / 10% Robusta', () => {
  const result = validateAndBuildBlendSnapshot(
    'Whole Bean',
    { arabicaPercentage: 90, robustaPercentage: 10 },
    APPROVED_WHOLE_BEAN_RECIPE,
    1
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.arabicaPercentage, 90);
  assert.strictEqual(result.blend.robustaPercentage, 10);
  assert.strictEqual(result.blend.arabicaGrams, 225);
  assert.strictEqual(result.blend.robustaGrams, 25);
  assert.strictEqual(result.blend.totalGrams, 250);
});

it('Multi-pack scaling: 4 packs of 80/20 calculates exact cumulative grams (800g Arabica, 200g Robusta, 1000g total)', () => {
  const result = validateAndBuildBlendSnapshot(
    'Whole Bean',
    { arabicaPercentage: 80, robustaPercentage: 20 },
    APPROVED_WHOLE_BEAN_RECIPE,
    4
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.totalArabicaGrams, 800);
  assert.strictEqual(result.blend.totalRobustaGrams, 200);
  assert.strictEqual(result.blend.totalGrams, 250);
});

// ---------------------------------------------------------------------------
// SUITE 3: SERVER-SIDE VALIDATION & TAMPER-RESISTANCE
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 3: Server-Side Security & Tamper Resistance ---');

it('Rejects Robusta exceeding 20% (e.g. 21% or 25%)', () => {
  const r21 = validateAndBuildBlendSnapshot(
    'Whole Bean',
    { arabicaPercentage: 79, robustaPercentage: 21 },
    APPROVED_WHOLE_BEAN_RECIPE,
    1
  );
  assert.strictEqual(r21.valid, false);
  assert.ok(r21.message.includes('Robusta percentage cannot exceed 20%'));

  const r25 = validateAndBuildBlendSnapshot(
    'Whole Bean',
    { arabicaPercentage: 75, robustaPercentage: 25 },
    APPROVED_WHOLE_BEAN_RECIPE,
    1
  );
  assert.strictEqual(r25.valid, false);
});

it('Rejects Arabica less than 80% (e.g. 75%)', () => {
  const result = validateAndBuildBlendSnapshot(
    'Whole Bean',
    { arabicaPercentage: 75, robustaPercentage: 20 },
    APPROVED_WHOLE_BEAN_RECIPE,
    1
  );
  assert.strictEqual(result.valid, false);
});

it('Rejects percentages that do not total exactly 100%', () => {
  const result = validateAndBuildBlendSnapshot(
    'Whole Bean',
    { arabicaPercentage: 80, robustaPercentage: 15 },
    APPROVED_WHOLE_BEAN_RECIPE,
    1
  );
  assert.strictEqual(result.valid, false);
  assert.ok(result.message.includes('total exactly 100%'));
});

it('Rejects negative percentages', () => {
  const result = validateAndBuildBlendSnapshot(
    'Whole Bean',
    { arabicaPercentage: 105, robustaPercentage: -5 },
    APPROVED_WHOLE_BEAN_RECIPE,
    1
  );
  assert.strictEqual(result.valid, false);
});

it('Strictly rejects any attempt to add Chicory to Whole Bean', () => {
  const result = validateAndBuildBlendSnapshot(
    'Whole Bean',
    { arabicaPercentage: 80, robustaPercentage: 15, chicoryPercentage: 5 },
    APPROVED_WHOLE_BEAN_RECIPE,
    1
  );
  assert.strictEqual(result.valid, false);
  assert.ok(result.message.includes('Chicory is not permitted'));
});

it('Tampered gram values in payload are ignored; recalculated server-side from percentages', () => {
  const result = validateAndBuildBlendSnapshot(
    'Whole Bean',
    {
      arabicaPercentage: 80,
      robustaPercentage: 20,
      arabicaGrams: 9999, // TAMPERED
      robustaGrams: 8888  // TAMPERED
    },
    APPROVED_WHOLE_BEAN_RECIPE,
    1
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.arabicaGrams, 200);
  assert.strictEqual(result.blend.robustaGrams, 50);
});

// ---------------------------------------------------------------------------
// SUITE 4: DATA STORE PERSISTENCE & IMMUTABLE SNAPSHOTS
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 4: Data Store Persistence & Immutable Snapshots ---');

await itAsync('Whole Bean order persists with immutable blend snapshot', async () => {
  const order = await dataStore.createOrder({
    name: 'Whole Bean Gourmet Customer',
    email: 'wholebean@frenchroast.com',
    phone: '9876543210',
    address: 'Indiranagar, Bengaluru',
    pinCode: '560038',
    variant: 'Whole Bean',
    packSize: '250g',
    quantity: 2,
    blend: {
      customizationEnabled: true,
      arabicaPercentage: 85,
      robustaPercentage: 15,
      chicoryPercentage: 0,
      arabicaGrams: 212.5,
      robustaGrams: 37.5,
      chicoryGrams: 0,
      totalGrams: 250,
      totalArabicaGrams: 425,
      totalRobustaGrams: 75,
      totalChicoryGrams: 0,
      recipeName: 'Whole Bean Signature Roast'
    }
  });

  assert.ok(order);
  assert.strictEqual(order.variant, 'Whole Bean');
  assert.strictEqual(order.price, 599);
  assert.strictEqual(order.blend.arabicaPercentage, 85);
  assert.strictEqual(order.blend.robustaPercentage, 15);
  assert.strictEqual(order.blend.totalArabicaGrams, 425);
  assert.strictEqual(order.blend.totalRobustaGrams, 75);

  // Changing blend settings later must NOT alter this existing order snapshot
  await dataStore.updateBlendSettings({ defaultArabica: 90, defaultRobusta: 10 });
  const retrieved = await dataStore.getOrderById(order._id);
  assert.strictEqual(retrieved.blend.arabicaPercentage, 85, 'Existing order snapshot must remain immutable');
  assert.strictEqual(retrieved.blend.robustaPercentage, 15);
});

await itAsync('Historical Powder orders remain intact and load without errors', async () => {
  const allOrders = await dataStore.getOrders();
  const powderOrders = allOrders.filter(o => o.variant === 'Powder');
  // If there are historical orders, verify their integrity
  for (const po of powderOrders) {
    assert.strictEqual(po.variant, 'Powder');
    assert.ok(po.price === 499 || po.price === 599);
  }
});

// ---------------------------------------------------------------------------
// SUITE 5: EMAIL CONFIRMATION TEMPLATES
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 5: Email Confirmation Templates ---');

it('Order confirmation email includes Whole Bean Arabica–Robusta blend snapshot', () => {
  const orderWithBlend = {
    bookingId: 'FR-BEAN-001',
    name: 'Artisan Brewer',
    coffeeType: 'Whole Bean',
    packSize: '250g',
    quantity: 2,
    unitPrice: 599,
    totalPrice: 1198,
    blend: {
      arabicaPercentage: 80,
      robustaPercentage: 20,
      chicoryPercentage: 0,
      arabicaGrams: 200,
      robustaGrams: 50,
      chicoryGrams: 0,
      totalGrams: 250,
      totalArabicaGrams: 400,
      totalRobustaGrams: 100,
      totalChicoryGrams: 0
    }
  };

  const tmpl = getOrderConfirmationTemplate(orderWithBlend);
  assert.ok(tmpl.htmlContent.includes('Blend:'), 'HTML should mention Blend:');
  assert.ok(tmpl.htmlContent.includes('80% Arabica (200g) / 20% Robusta (50g)'), 'HTML should show Arabica/Robusta grams');
  assert.ok(tmpl.htmlContent.includes('400g Arabica / 100g Robusta across 2 packs'), 'HTML should show total grams');
  assert.ok(!tmpl.htmlContent.includes('Chicory'), 'HTML should not mention chicory for Whole Bean');
  assert.ok(tmpl.textContent.includes('80% Arabica (200g) / 20% Robusta (50g)'), 'Plain text should show Arabica/Robusta grams');
});

it('Waiting pre-order confirmation email includes Whole Bean blend details', () => {
  const waitOrder = {
    bookingId: 'FR-WAIT-003',
    name: 'Patient Gourmet',
    coffeeType: 'Whole Bean',
    packSize: '250g',
    quantity: 1,
    unitPrice: 599,
    totalPrice: 599,
    blend: {
      arabicaPercentage: 85,
      robustaPercentage: 15,
      chicoryPercentage: 0,
      arabicaGrams: 212.5,
      robustaGrams: 37.5,
      chicoryGrams: 0
    }
  };

  const tmpl = getWaitingPreorderConfirmationTemplate(waitOrder);
  assert.ok(tmpl.htmlContent.includes('Blend:'), 'HTML should mention Blend:');
  assert.ok(tmpl.htmlContent.includes('85% Arabica (212.5g) / 15% Robusta (37.5g)'), 'HTML should show Arabica/Robusta');
  assert.ok(tmpl.textContent.includes('85% Arabica (212.5g) / 15% Robusta (37.5g)'), 'Plain text should show Arabica/Robusta');
});

// ---------------------------------------------------------------------------
// SUITE 6: INVENTORY & ADMIN SETTINGS
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 6: Inventory & Admin Settings Boundaries ---');

await itAsync('Blend settings enforce Whole Bean limits (Robusta max 20%, Arabica min 80%)', async () => {
  const settings = await dataStore.getBlendSettings();
  assert.strictEqual(settings.productType, 'Whole Bean');
  assert.strictEqual(settings.minArabica, 80);
  assert.strictEqual(settings.maxRobusta, 20);
  assert.strictEqual(settings.minRobusta, 0);
  assert.strictEqual(settings.maxArabica, 100);
});

await itAsync('Updating blend settings with Robusta > 20% is rejected', async () => {
  let thrown = false;
  try {
    await dataStore.updateBlendSettings({ defaultRobusta: 30, defaultArabica: 70 });
  } catch (err) {
    thrown = true;
    assert.ok(err.message.includes('Robusta percentage cannot exceed 20%'));
  }
  assert.strictEqual(thrown, true, 'Should reject Robusta > 20%');
});

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
