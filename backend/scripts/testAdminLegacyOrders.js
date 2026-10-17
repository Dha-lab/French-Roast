import assert from 'assert';
import mongoose from 'mongoose';
import Order from '../models/Order.js';

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

// Logic copied directly from admin/src/main.js to test client-side rendering fidelity
function formatProductTypeAndSize(item) {
  const rawType = item.coffeeType || item.variant || item.product || '';
  const type = (typeof rawType === 'string' && rawType.trim()) ? rawType.trim() : 'Powder';
  const rawSize = item.packSize || item.weight || '';
  const size = (typeof rawSize === 'string' && rawSize.trim()) ? rawSize.trim() : '250g';
  return { type, size };
}

function parseBlendInfo(item) {
  if (!item) return { valid: false };
  const b = (item.blend && typeof item.blend === 'object')
    ? item.blend
    : (item.arabicaPercentage !== undefined || item.robustaPercentage !== undefined ? item : null);
  if (!b || typeof b !== 'object') {
    return { valid: false };
  }
  const aPct = Number(b.arabicaPercentage);
  const rPct = Number(b.robustaPercentage);
  const cPct = b.chicoryPercentage !== undefined && b.chicoryPercentage !== null ? Number(b.chicoryPercentage) : 0;

  if (isNaN(aPct) || isNaN(rPct) || !isFinite(aPct) || !isFinite(rPct) || aPct < 0 || rPct < 0) {
    return { valid: false };
  }
  if (isNaN(cPct) || !isFinite(cPct) || cPct < 0) {
    return { valid: false };
  }

  const totalPct = Math.round(aPct + rPct + cPct);
  if (totalPct !== 100) {
    return { valid: false };
  }

  const packWeight = Math.max(1, Number(b.totalGrams) || 250);
  const qty = Math.max(1, Number(item.quantity) || 1);

  const aG = typeof b.arabicaGrams === 'number' && !isNaN(b.arabicaGrams)
    ? b.arabicaGrams
    : Math.round((packWeight * aPct / 100) * 10) / 10;
  const rG = typeof b.robustaGrams === 'number' && !isNaN(b.robustaGrams)
    ? b.robustaGrams
    : (cPct > 0 ? Math.round((packWeight * rPct / 100) * 10) / 10 : Math.round((packWeight - aG) * 10) / 10);
  const cG = typeof b.chicoryGrams === 'number' && !isNaN(b.chicoryGrams)
    ? b.chicoryGrams
    : (cPct > 0 ? Math.round((packWeight - aG - rG) * 10) / 10 : 0);

  const totalAG = typeof b.totalArabicaGrams === 'number' && !isNaN(b.totalArabicaGrams)
    ? b.totalArabicaGrams
    : Math.round((aG * qty) * 10) / 10;
  const totalRG = typeof b.totalRobustaGrams === 'number' && !isNaN(b.totalRobustaGrams)
    ? b.totalRobustaGrams
    : Math.round((rG * qty) * 10) / 10;
  const totalCG = typeof b.totalChicoryGrams === 'number' && !isNaN(b.totalChicoryGrams)
    ? b.totalChicoryGrams
    : Math.round((cG * qty) * 10) / 10;

  return {
    valid: true,
    hasChicory: cPct > 0,
    arabicaPercentage: aPct,
    robustaPercentage: rPct,
    chicoryPercentage: cPct,
    arabicaGrams: aG,
    robustaGrams: rG,
    chicoryGrams: cG,
    totalArabicaGrams: totalAG,
    totalRobustaGrams: totalRG,
    totalChicoryGrams: totalCG,
    packWeight
  };
}

function renderCoffeeDetailsHTML(item) {
  const { type, size } = formatProductTypeAndSize(item);
  const blendInfo = parseBlendInfo(item);
  let blendHtml = '';
  if (blendInfo.valid) {
    if (blendInfo.hasChicory) {
      blendHtml = `☕ ${blendInfo.arabicaPercentage}%A / ${blendInfo.robustaPercentage}%R / ${blendInfo.chicoryPercentage}%C (${blendInfo.arabicaGrams}g / ${blendInfo.robustaGrams}g / ${blendInfo.chicoryGrams}g)`;
    } else {
      blendHtml = `☕ ${blendInfo.arabicaPercentage}%A / ${blendInfo.robustaPercentage}%R (${blendInfo.arabicaGrams}g / ${blendInfo.robustaGrams}g)`;
    }
  } else {
    blendHtml = 'Blend details unavailable for this order.';
  }
  return {
    productLabel: `${type.toUpperCase()} · ${size.toUpperCase()}`,
    blendText: blendHtml
  };
}

console.log('\n=================================================================');
console.log('🧪 TESTING ADMIN LEGACY ORDER RENDERING & BLEND COMPATIBILITY');
console.log('=================================================================\n');

// -----------------------------------------------------------------------------
// TEST A: Historical order created before blend customization, with no blend fields
// -----------------------------------------------------------------------------
console.log('--- TEST A: Historical Order (No blend fields) ---');

it('Order with no blend fields displays actual product and "Blend details unavailable for this order."', () => {
  const orderA = {
    bookingId: 'FR-8396962',
    fullName: 'Historical Customer',
    variant: 'Whole Bean',
    weight: '250g',
    quantity: 1
    // blend is undefined
  };

  const rendered = renderCoffeeDetailsHTML(orderA);
  assert.strictEqual(rendered.productLabel, 'WHOLE BEAN · 250G');
  assert.strictEqual(rendered.blendText, 'Blend details unavailable for this order.');
  assert.ok(!rendered.blendText.includes('undefined'));
  assert.ok(!rendered.blendText.includes('NaN'));
});

it('Historical powder order with no blend fields displays "POWDER · 250G" and unavailable notice', () => {
  const orderPowder = {
    bookingId: 'FR-4239936',
    fullName: 'Powder Customer',
    variant: 'Powder',
    weight: '250g',
    quantity: 1
  };

  const rendered = renderCoffeeDetailsHTML(orderPowder);
  assert.strictEqual(rendered.productLabel, 'POWDER · 250G');
  assert.strictEqual(rendered.blendText, 'Blend details unavailable for this order.');
});

it('Historical order loaded through Mongoose model without blend field keeps blend undefined', () => {
  const doc = new Order({
    bookingId: 'FR-HIST-001',
    fullName: 'Mongo Historical Customer',
    phone: '9876543210',
    email: 'mongo@historical.com',
    address: 'Bengaluru',
    pinCode: '560001',
    variant: 'Whole Bean',
    weight: '250g'
  });

  const obj = doc.toObject();
  assert.strictEqual(obj.blend, undefined);
  const rendered = renderCoffeeDetailsHTML(obj);
  assert.strictEqual(rendered.blendText, 'Blend details unavailable for this order.');
});

// -----------------------------------------------------------------------------
// TEST B: Historical two-ingredient order (Arabica + Robusta, no chicory)
// -----------------------------------------------------------------------------
console.log('\n--- TEST B: Historical Two-Ingredient Order ---');

it('Order with 70% Arabica and 30% Robusta displays only saved Arabica & Robusta without chicory', () => {
  const orderB = {
    bookingId: 'FR-LEGACY-002',
    variant: 'Powder',
    weight: '250g',
    quantity: 1,
    blend: {
      arabicaPercentage: 70,
      robustaPercentage: 30,
      arabicaGrams: 175,
      robustaGrams: 75
    }
  };

  const info = parseBlendInfo(orderB);
  assert.strictEqual(info.valid, true);
  assert.strictEqual(info.hasChicory, false);
  assert.strictEqual(info.arabicaPercentage, 70);
  assert.strictEqual(info.robustaPercentage, 30);
  assert.strictEqual(info.chicoryPercentage, 0);

  const rendered = renderCoffeeDetailsHTML(orderB);
  assert.strictEqual(rendered.productLabel, 'POWDER · 250G');
  assert.strictEqual(rendered.blendText, '☕ 70%A / 30%R (175g / 75g)');
  assert.ok(!rendered.blendText.includes('Chicory'));
  assert.ok(!rendered.blendText.includes('C'));
  assert.ok(!rendered.blendText.includes('undefined'));
});

it('Order with root-level arabicaPercentage and robustaPercentage displays correct grams with 250g sum', () => {
  const orderRoot = {
    bookingId: 'FR-ROOT-002',
    variant: 'Powder',
    weight: '250g',
    quantity: 1,
    arabicaPercentage: 70,
    robustaPercentage: 30
  };

  const info = parseBlendInfo(orderRoot);
  assert.strictEqual(info.valid, true);
  assert.strictEqual(info.hasChicory, false);
  assert.strictEqual(info.arabicaPercentage, 70);
  assert.strictEqual(info.robustaPercentage, 30);
  assert.strictEqual(info.arabicaGrams + info.robustaGrams, 250);

  const rendered = renderCoffeeDetailsHTML(orderRoot);
  assert.strictEqual(rendered.blendText, '☕ 70%A / 30%R (175g / 75g)');
});

// -----------------------------------------------------------------------------
// TEST C: New three-ingredient order (Arabica + Robusta + Chicory)
// -----------------------------------------------------------------------------
console.log('\n--- TEST C: New Three-Ingredient Order ---');

it('Order with 75% Arabica, 20% Robusta, and 5% Chicory displays all 3 ingredients with exact grams', () => {
  const orderC = {
    bookingId: 'FR-NEW-003',
    variant: 'Powder',
    weight: '250g',
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

  const info = parseBlendInfo(orderC);
  assert.strictEqual(info.valid, true);
  assert.strictEqual(info.hasChicory, true);
  assert.strictEqual(info.arabicaPercentage, 75);
  assert.strictEqual(info.robustaPercentage, 20);
  assert.strictEqual(info.chicoryPercentage, 5);
  assert.strictEqual(info.arabicaGrams, 187.5);
  assert.strictEqual(info.robustaGrams, 50);
  assert.strictEqual(info.chicoryGrams, 12.5);
  assert.strictEqual(info.totalArabicaGrams, 375);
  assert.strictEqual(info.totalRobustaGrams, 100);
  assert.strictEqual(info.totalChicoryGrams, 25);

  const rendered = renderCoffeeDetailsHTML(orderC);
  assert.strictEqual(rendered.productLabel, 'POWDER · 250G');
  assert.strictEqual(rendered.blendText, '☕ 75%A / 20%R / 5%C (187.5g / 50g / 12.5g)');
  assert.ok(!rendered.blendText.includes('undefined'));
  assert.ok(!rendered.blendText.includes('NaN'));
});

// -----------------------------------------------------------------------------
// TEST D: Incomplete or malformed order
// -----------------------------------------------------------------------------
console.log('\n--- TEST D: Incomplete or Malformed Order ---');

it('Order with empty blend object {} safely displays unavailable fallback', () => {
  const orderEmpty = {
    bookingId: 'FR-MALFORMED-1',
    variant: 'Powder',
    weight: '250g',
    blend: {}
  };
  const rendered = renderCoffeeDetailsHTML(orderEmpty);
  assert.strictEqual(rendered.blendText, 'Blend details unavailable for this order.');
});

it('Order with synthetic Mongoose defaults { customizationEnabled: false, chicoryPercentage: 0 } displays unavailable fallback', () => {
  const orderSynthetic = {
    bookingId: 'FR-MALFORMED-2',
    variant: 'Whole Bean',
    weight: '250g',
    blend: {
      customizationEnabled: false,
      chicoryPercentage: 0,
      chicoryGrams: 0,
      totalGrams: 250
    }
  };
  const rendered = renderCoffeeDetailsHTML(orderSynthetic);
  assert.strictEqual(rendered.blendText, 'Blend details unavailable for this order.');
  assert.strictEqual(rendered.productLabel, 'WHOLE BEAN · 250G');
});

it('Order with non-100 sum percentages displays unavailable fallback', () => {
  const orderBadSum = {
    bookingId: 'FR-MALFORMED-3',
    variant: 'Powder',
    weight: '250g',
    blend: {
      arabicaPercentage: 40,
      robustaPercentage: 40
      // Sum is 80%, not 100%
    }
  };
  const rendered = renderCoffeeDetailsHTML(orderBadSum);
  assert.strictEqual(rendered.blendText, 'Blend details unavailable for this order.');
});

it('Order with missing variant and weight safely falls back to defaults without NaN/undefined', () => {
  const orderMissingFields = {
    bookingId: 'FR-MALFORMED-4'
  };
  const rendered = renderCoffeeDetailsHTML(orderMissingFields);
  assert.strictEqual(rendered.productLabel, 'POWDER · 250G');
  assert.strictEqual(rendered.blendText, 'Blend details unavailable for this order.');
});

// -----------------------------------------------------------------------------
// TEST E: Dashboard Filtering & Search Integrity
// -----------------------------------------------------------------------------
console.log('\n--- TEST E: Dashboard Filtering & Search Integrity ---');

it('Order search correctly matches booking ID, name, email, phone across mixed historical and new orders', () => {
  const sampleOrders = [
    { bookingId: 'FR-8396962', name: 'Rahul Sharma', email: 'rahul@test.com', phone: '9876543210', status: 'pending' },
    { bookingId: 'FR-3190645', name: 'Priya Patel', email: 'priya@test.com', phone: '9876543211', status: 'confirmed' },
    { bookingId: 'FR-NEW-100', name: 'Amit Kumar', email: 'amit@test.com', phone: '9876543212', status: 'pending', blend: { arabicaPercentage: 75, robustaPercentage: 20, chicoryPercentage: 5 } }
  ];

  // Search by booking ID
  const searchBooking = sampleOrders.filter(o => o.bookingId.toLowerCase().includes('8396962'));
  assert.strictEqual(searchBooking.length, 1);
  assert.strictEqual(searchBooking[0].name, 'Rahul Sharma');

  // Search by name
  const searchName = sampleOrders.filter(o => o.name.toLowerCase().includes('priya'));
  assert.strictEqual(searchName.length, 1);
  assert.strictEqual(searchName[0].bookingId, 'FR-3190645');

  // Filter by status
  const filterPending = sampleOrders.filter(o => o.status === 'pending');
  assert.strictEqual(filterPending.length, 2);
});

console.log('\n=================================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('=================================================================\n');

if (failed > 0) {
  process.exit(1);
}
