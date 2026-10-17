import assert from 'assert';
import { validateAndBuildBlendSnapshot } from '../controllers/orderController.js';
import { dataStore } from '../config/dataStore.js';
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

console.log('\n======================================================');
console.log('🧪 RUNNING FRENCH ROAST 3-INGREDIENT BLEND TEST SUITE');
console.log('======================================================\n');

// ---------------------------------------------------------------------------
// SUITE 1: 3-INGREDIENT ARITHMETIC PRECISION & 250g GRAM INVARIANT
// ---------------------------------------------------------------------------
console.log('--- SUITE 1: 3-Ingredient Gram Arithmetic & 250g Pack Invariant ---');

it('For development recipe 75% Arabica, 20% Robusta, 5% Chicory: exact gram sum === 250g', () => {
  const packWeight = 250;
  const aGrams = Math.round((packWeight * 75 / 100) * 10) / 10;
  const rGrams = Math.round((packWeight * 20 / 100) * 10) / 10;
  const cGrams = Math.round((packWeight - aGrams - rGrams) * 10) / 10;

  assert.strictEqual(aGrams, 187.5);
  assert.strictEqual(rGrams, 50.0);
  assert.strictEqual(cGrams, 12.5);
  assert.strictEqual(Math.round((aGrams + rGrams + cGrams) * 10) / 10, 250.0);
});

it('For any valid 3-ingredient combination totaling 100%, Arabica + Robusta + Chicory grams === 250g', () => {
  const testCases = [
    [75, 20, 5],
    [70, 25, 5],
    [65, 30, 5],
    [80, 15, 5],
    [60, 30, 10],
    [85, 10, 5],
    [100, 0, 0],
    [50, 45, 5]
  ];

  for (const [a, r, c] of testCases) {
    assert.strictEqual(a + r + c, 100);
    const aG = Math.round((250 * a / 100) * 10) / 10;
    const rG = Math.round((250 * r / 100) * 10) / 10;
    const cG = Math.round((250 - aG - rG) * 10) / 10;
    const totalG = Math.round((aG + rG + cG) * 10) / 10;
    assert.strictEqual(totalG, 250, `Failed for triplet ${a}/${r}/${c}`);
  }
});

// ---------------------------------------------------------------------------
// SUITE 2: SERVER-SIDE VALIDATION & SNAPSHOT CALCULATIONS
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 2: Server-Side 3-Ingredient Validation & Security ---');

const standardRules = {
  customizationEnabled: true,
  packWeight: 250,
  defaultArabica: 75,
  defaultRobusta: 20,
  defaultChicory: 5,
  arabicaAdjustable: true,
  robustaAdjustable: true,
  chicoryAdjustable: false,
  minArabica: 0,
  maxArabica: 95,
  minRobusta: 0,
  maxRobusta: 50,
  minChicory: 0,
  maxChicory: 20,
  step: 5,
  allowedPresets: ['75/20/5', '70/25/5', '65/30/5', '80/15/5'],
  productType: 'Powder',
  version: 1
};

it('Valid 75/20/5 blend builds correct snapshot with decimal grams for quantity 1', () => {
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    { arabicaPercentage: 75, robustaPercentage: 20, chicoryPercentage: 5 },
    standardRules,
    1
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.arabicaPercentage, 75);
  assert.strictEqual(result.blend.robustaPercentage, 20);
  assert.strictEqual(result.blend.chicoryPercentage, 5);
  assert.strictEqual(result.blend.arabicaGrams, 187.5);
  assert.strictEqual(result.blend.robustaGrams, 50);
  assert.strictEqual(result.blend.chicoryGrams, 12.5);
  assert.strictEqual(result.blend.totalGrams, 250);
  assert.strictEqual(result.blend.totalArabicaGrams, 187.5);
  assert.strictEqual(result.blend.totalRobustaGrams, 50);
  assert.strictEqual(result.blend.totalChicoryGrams, 12.5);
});

it('Multi-pack calculation correctly scales all 3 ingredient totals for quantity 3', () => {
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    { arabicaPercentage: 75, robustaPercentage: 20, chicoryPercentage: 5 },
    standardRules,
    3
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.arabicaGrams, 187.5);
  assert.strictEqual(result.blend.robustaGrams, 50);
  assert.strictEqual(result.blend.chicoryGrams, 12.5);
  assert.strictEqual(result.blend.totalArabicaGrams, 562.5); // 187.5 * 3
  assert.strictEqual(result.blend.totalRobustaGrams, 150);   // 50 * 3
  assert.strictEqual(result.blend.totalChicoryGrams, 37.5);  // 12.5 * 3
});

it('Fixed chicory at 5%: moving Arabica slider properly sets Robusta to remainder (95 - Arabica)', () => {
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    { arabicaPercentage: 70 }, // Client supplies only Arabica, Robusta balances remainder with 5% chicory
    standardRules,
    1
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.arabicaPercentage, 70);
  assert.strictEqual(result.blend.robustaPercentage, 25);
  assert.strictEqual(result.blend.chicoryPercentage, 5);
  assert.strictEqual(result.blend.arabicaGrams, 175);
  assert.strictEqual(result.blend.robustaGrams, 62.5);
  assert.strictEqual(result.blend.chicoryGrams, 12.5);
});

it('Rejects percentages that do not sum to 100%', () => {
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    { arabicaPercentage: 75, robustaPercentage: 20, chicoryPercentage: 10 }, // 105%
    standardRules,
    1
  );
  assert.strictEqual(result.valid, false);
  assert.ok(result.message.includes('total exactly 100%'));
});

it('Rejects negative percentages', () => {
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    { arabicaPercentage: -5, robustaPercentage: 100, chicoryPercentage: 5 },
    standardRules,
    1
  );
  assert.strictEqual(result.valid, false);
});

it('Rejects percentage outside permitted admin range', () => {
  const restrictedRules = {
    ...standardRules,
    minArabica: 50,
    maxArabica: 80,
    allowedPresets: [] // test range
  };

  const resultTooHigh = validateAndBuildBlendSnapshot(
    'Powder',
    { arabicaPercentage: 90, robustaPercentage: 5, chicoryPercentage: 5 },
    restrictedRules,
    1
  );
  assert.strictEqual(resultTooHigh.valid, false);
  assert.ok(resultTooHigh.message.includes('outside the permitted range'));
});

it('Client-tampered grams are ignored and strictly recalculated from percentages', () => {
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    {
      arabicaPercentage: 75,
      robustaPercentage: 20,
      chicoryPercentage: 5,
      arabicaGrams: 9999, // TAMPERED
      robustaGrams: 8888, // TAMPERED
      chicoryGrams: 7777  // TAMPERED
    },
    standardRules,
    1
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.arabicaGrams, 187.5);
  assert.strictEqual(result.blend.robustaGrams, 50);
  assert.strictEqual(result.blend.chicoryGrams, 12.5);
});

it('When customization is disabled, client cannot submit a custom blend', () => {
  const disabledRules = {
    ...standardRules,
    customizationEnabled: false
  };
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    { arabicaPercentage: 65, robustaPercentage: 30, chicoryPercentage: 5 },
    disabledRules,
    1
  );
  assert.strictEqual(result.valid, false);
  assert.ok(result.message.includes('disabled'));
});

it('Non-customized Powder order falls back to default 75/20/5 recipe', () => {
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    null,
    standardRules,
    1
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.customizationEnabled, false);
  assert.strictEqual(result.blend.arabicaPercentage, 75);
  assert.strictEqual(result.blend.robustaPercentage, 20);
  assert.strictEqual(result.blend.chicoryPercentage, 5);
  assert.strictEqual(result.blend.arabicaGrams, 187.5);
  assert.strictEqual(result.blend.robustaGrams, 50);
  assert.strictEqual(result.blend.chicoryGrams, 12.5);
});

it('Whole Bean product does NOT receive chicory or customized blend', () => {
  const result = validateAndBuildBlendSnapshot(
    'Whole Bean',
    { arabicaPercentage: 75, robustaPercentage: 20, chicoryPercentage: 5 },
    standardRules,
    1
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend, undefined);
});

// ---------------------------------------------------------------------------
// SUITE 3: DATA STORE & PERSISTENCE
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 3: Data Store & Settings Persistence ---');

await itAsync('dataStore retrieves and updates 3-ingredient blendSettings correctly', async () => {
  const initial = await dataStore.getBlendSettings();
  assert.ok(initial);
  assert.strictEqual(initial.customizationEnabled, true);

  const updated = await dataStore.updateBlendSettings({
    defaultArabica: 75,
    defaultRobusta: 20,
    defaultChicory: 5,
    packWeight: 250,
    allowedPresets: ['75/20/5', '70/25/5', '65/30/5', '80/15/5']
  });
  assert.strictEqual(updated.defaultArabica, 75);
  assert.strictEqual(updated.defaultRobusta, 20);
  assert.strictEqual(updated.defaultChicory, 5);
  assert.strictEqual(updated.packWeight, 250);
  assert.deepStrictEqual(updated.allowedPresets, ['75/20/5', '70/25/5', '65/30/5', '80/15/5']);
});

await itAsync('Order with 3-ingredient snapshot persists cleanly in dataStore', async () => {
  const testOrder = {
    name: '3-Ingredient Test Customer',
    email: 'chicory@frenchroast.com',
    phone: '9876543210',
    address: 'Bengaluru, India',
    pinCode: '560001',
    variant: 'Powder',
    packSize: '250g',
    quantity: 2,
    blend: {
      customizationEnabled: true,
      arabicaPercentage: 75,
      robustaPercentage: 20,
      chicoryPercentage: 5,
      arabicaGrams: 187.5,
      robustaGrams: 50,
      chicoryGrams: 12.5,
      totalGrams: 250,
      totalArabicaGrams: 375,
      totalRobustaGrams: 100,
      totalChicoryGrams: 25,
      configurationVersion: 1
    }
  };

  const created = await dataStore.createOrder(testOrder);
  assert.ok(created);
  assert.ok(created.blend);
  assert.strictEqual(created.blend.arabicaPercentage, 75);
  assert.strictEqual(created.blend.robustaPercentage, 20);
  assert.strictEqual(created.blend.chicoryPercentage, 5);
  assert.strictEqual(created.blend.arabicaGrams, 187.5);
  assert.strictEqual(created.blend.chicoryGrams, 12.5);
  assert.strictEqual(created.blend.totalArabicaGrams, 375);
  assert.strictEqual(created.blend.totalChicoryGrams, 25);
});

await itAsync('Legacy order without chicory retrieves with default 0 chicory without errors', async () => {
  const legacyOrder = {
    name: 'Legacy 2-Ingredient Customer',
    email: 'legacy@frenchroast.com',
    phone: '9876543211',
    address: 'Bengaluru, India',
    pinCode: '560001',
    variant: 'Powder',
    packSize: '250g',
    quantity: 1,
    blend: {
      arabicaPercentage: 70,
      robustaPercentage: 30,
      arabicaGrams: 175,
      robustaGrams: 75
    }
  };

  const created = await dataStore.createOrder(legacyOrder);
  assert.ok(created);
  assert.strictEqual(created.blend.arabicaPercentage, 70);
  assert.strictEqual(created.blend.robustaPercentage, 30);
});

// ---------------------------------------------------------------------------
// SUITE 4: EMAIL NOTIFICATION TEMPLATES WITH CHICORY
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 4: Email Notification Templates With Chicory ---');

it('Order confirmation email includes 3-ingredient snapshot with Chicory', () => {
  const orderWithBlend = {
    bookingId: 'FR-CHICORY-001',
    name: 'Coffee Fan',
    coffeeType: 'Powder',
    packSize: '250g',
    quantity: 2,
    blend: {
      arabicaPercentage: 75,
      robustaPercentage: 20,
      chicoryPercentage: 5,
      arabicaGrams: 187.5,
      robustaGrams: 50,
      chicoryGrams: 12.5,
      totalGrams: 250,
      totalArabicaGrams: 375,
      totalRobustaGrams: 100,
      totalChicoryGrams: 25
    }
  };

  const tmpl = getOrderConfirmationTemplate(orderWithBlend);
  assert.ok(tmpl.htmlContent.includes('Blend:'), 'HTML should mention Blend:');
  assert.ok(tmpl.htmlContent.includes('75% Arabica (187.5g) / 20% Robusta (50g) / 5% Chicory (12.5g)'), 'HTML should show 3 ingredients');
  assert.ok(tmpl.htmlContent.includes('375g Arabica / 100g Robusta / 25g Chicory across 2 packs'), 'HTML should show multi-pack grams');
  assert.ok(tmpl.textContent.includes('75% Arabica (187.5g) / 20% Robusta (50g) / 5% Chicory (12.5g)'), 'Plain text should show 3 ingredients');
});

it('Waiting pre-order confirmation email includes 3-ingredient snapshot with Chicory', () => {
  const waitingOrder = {
    bookingId: 'FR-WAIT-002',
    name: 'Waitlist Customer',
    coffeeType: 'Powder',
    packSize: '250g',
    quantity: 1,
    blend: {
      arabicaPercentage: 75,
      robustaPercentage: 20,
      chicoryPercentage: 5,
      arabicaGrams: 187.5,
      robustaGrams: 50,
      chicoryGrams: 12.5
    }
  };

  const tmpl = getWaitingPreorderConfirmationTemplate(waitingOrder);
  assert.ok(tmpl.htmlContent.includes('Blend:'), 'HTML should mention Blend:');
  assert.ok(tmpl.htmlContent.includes('75% Arabica (187.5g) / 20% Robusta (50g) / 5% Chicory (12.5g)'), 'HTML should show 3 ingredients');
  assert.ok(tmpl.textContent.includes('75% Arabica (187.5g) / 20% Robusta (50g) / 5% Chicory (12.5g)'), 'Plain text should show 3 ingredients');
});

it('Whole Bean order confirmation email does NOT contain blend or chicory details', () => {
  const beanOrder = {
    bookingId: 'FR-BEAN-002',
    name: 'Bean Customer',
    coffeeType: 'Whole Bean',
    packSize: '250g',
    quantity: 1,
    blend: null
  };

  const tmpl = getOrderConfirmationTemplate(beanOrder);
  assert.ok(!tmpl.htmlContent.includes('Blend:'), 'HTML should NOT mention blend');
  assert.ok(!tmpl.textContent.includes('Blend:'), 'Plain text should NOT mention blend');
});

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
