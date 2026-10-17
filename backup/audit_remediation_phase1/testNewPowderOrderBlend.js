import assert from 'node:assert';
import { validateAndBuildBlendSnapshot, calculateOrderTotals } from '../controllers/orderController.js';

console.log('\n=================================================================');
console.log('🧪 TESTING NEWLY CREATED POWDER ORDERS BLEND DETAILS');
console.log('=================================================================\n');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// Simulated active settings
const activeSettings = {
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
  allowedPresets: ['70/30', '80/20', '60/40', '75/25'],
  version: 6
};

// 1. Powder 250g 2-ingredient order (Arabica + Robusta, chicory 0)
test('Single 250g pack (Arabica 70%, Robusta 30%): Arabica grams + Robusta grams = exactly 250g', () => {
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    { arabicaPercentage: 70, robustaPercentage: 30, chicoryPercentage: 0 },
    activeSettings,
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
  assert.strictEqual(result.blend.totalGrams, 250);
});

// 2. Multi-pack Powder order scaling
test('Multi-pack Powder (3 packs of 250g, 70/30): grams scale accurately across 3 packs to 750g', () => {
  const result = validateAndBuildBlendSnapshot(
    'Powder',
    { arabicaPercentage: 70, robustaPercentage: 30 },
    activeSettings,
    3
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.totalArabicaGrams, 525);
  assert.strictEqual(result.blend.totalRobustaGrams, 225);
  assert.strictEqual(result.blend.totalArabicaGrams + result.blend.totalRobustaGrams, 750);
});

// 3. Root-level arabicaPercentage and robustaPercentage passed directly in request body
test('Request body with root-level arabicaPercentage: 80 and robustaPercentage: 20 builds valid snapshot', () => {
  const reqBody = {
    variant: 'Powder',
    quantity: 2,
    arabicaPercentage: 80,
    robustaPercentage: 20
  };
  const rawBlendInput = reqBody.blend || (
    reqBody.arabicaPercentage !== undefined || reqBody.robustaPercentage !== undefined
      ? {
          customizationEnabled: true,
          arabicaPercentage: reqBody.arabicaPercentage,
          robustaPercentage: reqBody.robustaPercentage,
          chicoryPercentage: reqBody.chicoryPercentage,
          totalGrams: reqBody.totalGrams || 250
        }
      : undefined
  );
  const result = validateAndBuildBlendSnapshot(
    reqBody.variant,
    rawBlendInput,
    activeSettings,
    reqBody.quantity
  );
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.arabicaPercentage, 80);
  assert.strictEqual(result.blend.robustaPercentage, 20);
  assert.strictEqual(result.blend.arabicaGrams, 200);
  assert.strictEqual(result.blend.robustaGrams, 50);
  assert.strictEqual(result.blend.totalArabicaGrams, 400);
  assert.strictEqual(result.blend.totalRobustaGrams, 100);
});

// 4. Default powder recipe when no blend customization is provided
test('Powder order without explicit blend uses active default recipe with exact 250g total', () => {
  const result = validateAndBuildBlendSnapshot('Powder', undefined, activeSettings, 1);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend.customizationEnabled, false);
  assert.strictEqual(result.blend.arabicaPercentage, 70);
  assert.strictEqual(result.blend.robustaPercentage, 30);
  assert.strictEqual(result.blend.chicoryPercentage, 0);
  assert.strictEqual(result.blend.arabicaGrams + result.blend.robustaGrams, 250);
});

// 5. Whole Bean orders remain pure coffee without blend snapshot
test('Whole Bean order returns undefined blend and remains unchanged', () => {
  const result = validateAndBuildBlendSnapshot('Whole Bean', { arabicaPercentage: 80 }, activeSettings, 1);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.blend, undefined);
});

console.log('\n=================================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('=================================================================\n');

if (failed > 0) process.exit(1);
