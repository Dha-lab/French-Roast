import assert from 'node:assert';
process.env.NODE_ENV = 'test';

import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { dataStore } from '../config/dataStore.js';
import { createOrder } from '../controllers/orderController.js';
import { getOrderConfirmationTemplate } from '../services/emailTemplates.js';

console.log('\n======================================================================');
console.log('🧪 RUNNING FRENCH ROAST AUTHORITATIVE PRICING & HISTORICAL INTEGRITY SUITE');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.stack || err.message}`);
  }
}

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
}

// --- SUITE 1: Schema Defaults for New Whole Bean Orders ---
console.log('--- SUITE 1: Schema Defaults for New Whole Bean Orders ---');

await test('Mongoose Order schema defaults unitPrice, itemTotal, subtotal, and finalTotal to ₹599', () => {
  const paths = Order.schema.paths;
  assert.strictEqual(paths.unitPrice.defaultValue, 599, 'unitPrice default must be 599');
  assert.strictEqual(paths.itemTotal.defaultValue, 599, 'itemTotal default must be 599');
  assert.strictEqual(paths.subtotal.defaultValue, 599, 'subtotal default must be 599');
  assert.strictEqual(paths.finalTotal.defaultValue, 599, 'finalTotal default must be 599');
  assert.strictEqual(paths.variant.defaultValue, 'Whole Bean', 'variant default must be Whole Bean');
  assert.strictEqual(paths.weight.defaultValue, '250g', 'weight default must be 250g');
});

await test('New Order document instantiated without explicit prices defaults to ₹599', () => {
  const orderDoc = new Order({
    fullName: 'Coffee Lover',
    phone: '9876543210',
    email: 'lover@example.com',
    address: 'Indiranagar, Bengaluru',
    pinCode: '560038'
  });

  assert.strictEqual(orderDoc.unitPrice, 599);
  assert.strictEqual(orderDoc.itemTotal, 599);
  assert.strictEqual(orderDoc.subtotal, 599);
  assert.strictEqual(orderDoc.finalTotal, 599);
  assert.strictEqual(orderDoc.variant, 'Whole Bean');
  assert.strictEqual(orderDoc.weight, '250g');
});

// --- SUITE 2: Product Model Authoritative Price ---
console.log('\n--- SUITE 2: Active Product Model Authoritative Price ---');

await test('Product schema defaults price to ₹599 for Whole Bean', () => {
  const paths = Product.schema.paths;
  assert.strictEqual(paths.price.defaultValue, 599, 'Product default price must be 599');
  assert.strictEqual(paths.variant.defaultValue, 'Whole Bean');
  assert.strictEqual(paths.weight.defaultValue, '250g');
});

await test('dataStore active product catalog exposes Whole Bean at ₹599', async () => {
  const products = await dataStore.getProducts();
  const wholeBean = products.find(p => p.variant === 'Whole Bean');
  assert.ok(wholeBean, 'Whole Bean product must exist');
  assert.strictEqual(wholeBean.price, 599, 'Whole Bean price must be 599');
});

// --- SUITE 3: Customer Price Tampering Resistance ---
console.log('\n--- SUITE 3: Customer Price Tampering Resistance ---');

await test('Backend strictly calculates totals from authoritative price and ignores customer-submitted prices', async () => {
  // Tampered payload attempting to buy for ₹1
  const req = {
    body: {
      fullName: 'Sneaky Shopper',
      phone: '9876543210',
      email: 'sneaky@example.com',
      address: 'Indiranagar 100ft Road',
      pinCode: '560038',
      variant: 'Whole Bean',
      packSize: '250g',
      quantity: 3,
      // Tampered values
      unitPrice: 1,
      itemTotal: 3,
      subtotal: 3,
      finalTotal: 3,
      price: 1,
      paymentMode: 'test',
      paymentStatus: 'simulated_success'
    }
  };

  const res = createMockRes();
  await createOrder(req, res);

  assert.strictEqual(res.statusCode, 201, 'Order should be created');
  assert.strictEqual(res.body.success, true);
  const createdOrder = res.body.data;

  // Expected: 3 packs * 599 = 1797
  assert.strictEqual(createdOrder.unitPrice, 599, 'Backend must force unitPrice to 599');
  assert.strictEqual(createdOrder.itemTotal, 1797, 'itemTotal must be 3 * 599 = 1797');
  assert.strictEqual(createdOrder.finalTotal, 1797, 'finalTotal must be 1797');
  assert.strictEqual(createdOrder.subtotal, 1797, 'subtotal must be 1797');
});

// --- SUITE 4: Historical Orders Pricing Preservation ---
console.log('\n--- SUITE 4: Historical Orders Pricing Preservation ---');

await test('Historical Powder orders retain their stored ₹499 price and totals', async () => {
  // Create a simulated historical order with stored ₹499 pricing
  const historicalOrder = new Order({
    bookingId: 'FR-HIST-499',
    fullName: 'Legacy Customer',
    phone: '9876543210',
    email: 'legacy@example.com',
    address: 'Old Airport Road, Bengaluru',
    pinCode: '560008',
    variant: 'Powder',
    coffeeType: 'Powder',
    weight: '250g',
    quantity: 1,
    unitPrice: 499,
    itemTotal: 499,
    subtotal: 499,
    finalTotal: 499,
    status: 'delivered',
    createdAt: new Date('2026-08-01')
  });

  // Verify fields are preserved without mutation
  assert.strictEqual(historicalOrder.unitPrice, 499);
  assert.strictEqual(historicalOrder.itemTotal, 499);
  assert.strictEqual(historicalOrder.finalTotal, 499);
  assert.strictEqual(historicalOrder.variant, 'Powder');

  // Verify email template renders historical ₹499 order correctly
  const emailContent = getOrderConfirmationTemplate(historicalOrder);
  assert.ok(emailContent.textContent.includes('499'), 'Historical email must display 499');
  assert.ok(emailContent.textContent.includes('Powder'), 'Historical email must display Powder');
});

// --- SUITE 5: Rejection of Discontinued Variants and Sizes ---
console.log('\n--- SUITE 5: Rejection of Discontinued Variants and Sizes ---');

await test('Orders attempting to purchase discontinued Powder are strictly rejected (HTTP 400)', async () => {
  const req = {
    body: {
      fullName: 'Powder Requester',
      phone: '9876543210',
      email: 'powder@example.com',
      address: 'MG Road, Bengaluru',
      pinCode: '560001',
      variant: 'Powder',
      packSize: '250g',
      quantity: 1
    }
  };

  const res = createMockRes();
  await createOrder(req, res);

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.code, 'PRODUCT_DISCONTINUED');
});

await test('Orders attempting to request non-250g pack sizes (e.g. 500g, 1kg) are strictly rejected (HTTP 400)', async () => {
  const req500 = {
    body: {
      fullName: 'Size Requester',
      phone: '9876543210',
      email: 'size@example.com',
      address: 'Indiranagar, Bengaluru',
      pinCode: '560038',
      variant: 'Whole Bean',
      packSize: '500g',
      quantity: 1
    }
  };

  const res = createMockRes();
  await createOrder(req500, res);

  assert.strictEqual(res.statusCode, 400);
  assert.ok(res.body.message.includes('Only 250g pack size is currently available'));
});

// --- SUMMARY ---
console.log('\n======================================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('======================================================================\n');

if (totalTests !== passedTests) {
  process.exit(1);
}
