import assert from 'node:assert';
process.env.NODE_ENV = 'test';

import { dataStore } from '../config/dataStore.js';
import { notifyWaitingCustomers, getWaitingPreOrders } from '../controllers/inventoryController.js';
import { sendWaitingRestockEmail } from '../services/brevoService.js';
import Order from '../models/Order.js';

console.log('\n======================================================================');
console.log('🧪 RUNNING RESTOCK NOTIFICATION DEDUPLICATION & CONCURRENCY TEST SUITE');
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

// Helper mock response object for Express handlers
function createMockRes() {
  const res = {
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
  return res;
}

// --- SUITE 1: Schema & Data Store Fields Verification ---
console.log('--- SUITE 1: Schema & Field Integrity ---');

await test('Order schema defines restock notification and atomic claim fields', () => {
  const paths = Order.schema.paths;
  assert.ok(paths.restockNotificationSent, 'Order schema must have restockNotificationSent');
  assert.strictEqual(paths.restockNotificationSent.defaultValue, false);
  assert.ok(paths.restockNotificationSentAt, 'Order schema must have restockNotificationSentAt');
  assert.ok(paths.restockNotificationMessageId, 'Order schema must have restockNotificationMessageId');
  assert.ok(paths.restockNotificationError, 'Order schema must have restockNotificationError');
  assert.ok(paths.restockClaimedAt, 'Order schema must have restockClaimedAt');
});

await test('dataStore initializes restock notification fields on created order', async () => {
  const order = await dataStore.createOrder({
    fullName: 'Test Customer',
    email: 'customer.test@example.com',
    phone: '9876543210',
    address: 'Bengaluru',
    pinCode: '560001',
    quantity: 1,
    status: 'waiting',
    isWaitingPreorder: true
  });

  assert.strictEqual(order.restockNotificationSent, false);
  assert.strictEqual(order.restockNotificationSentAt, null);
  assert.strictEqual(order.restockNotificationMessageId, null);
  assert.strictEqual(order.restockNotificationError, null);
  assert.strictEqual(order.restockClaimedAt, null);
});

// --- SUITE 2: Eligible Waiting Orders Identification ---
console.log('\n--- SUITE 2: Eligible Waiting Orders Identification ---');

await test('Only waiting orders with restockNotificationSent !== true are eligible for notification', async () => {
  // Clear any existing orders in dataStore memory
  const existing = await dataStore.getOrders();
  for (const o of existing) {
    await dataStore.deleteOrder(o.bookingId || o._id);
  }

  // 1. Eligible waiting order
  const eligibleOrder = await dataStore.createOrder({
    fullName: 'Eligible Customer',
    email: 'eligible@example.com',
    phone: '9876543211',
    address: 'Indiranagar',
    pinCode: '560038',
    quantity: 1,
    status: 'waiting',
    isWaitingPreorder: true
  });

  // 2. Already notified waiting order
  const alreadyNotifiedOrder = await dataStore.createOrder({
    fullName: 'Already Notified',
    email: 'notified@example.com',
    phone: '9876543212',
    address: 'Indiranagar',
    pinCode: '560038',
    quantity: 1,
    status: 'waiting',
    isWaitingPreorder: true,
    restockNotificationSent: true,
    restockNotificationSentAt: new Date().toISOString()
  });

  // 3. Normal in-stock pending order
  const pendingOrder = await dataStore.createOrder({
    fullName: 'Normal Customer',
    email: 'normal@example.com',
    phone: '9876543213',
    address: 'Indiranagar',
    pinCode: '560038',
    quantity: 1,
    status: 'pending'
  });

  const all = await dataStore.getOrders();
  const eligible = all.filter(o => (o.status || '').toLowerCase() === 'waiting' && !o.restockNotificationSent);

  assert.strictEqual(eligible.length, 1);
  assert.strictEqual(eligible[0].bookingId, eligibleOrder.bookingId);
});

// --- SUITE 3: Successful Notification Dispatch & State Recording ---
console.log('\n--- SUITE 3: Successful Notification Dispatch ---');

await test('Successfully sends notification, records sent status, timestamp, and message ID', async () => {
  // Clear store
  const existing = await dataStore.getOrders();
  for (const o of existing) {
    await dataStore.deleteOrder(o.bookingId || o._id);
  }

  const waitingOrder = await dataStore.createOrder({
    fullName: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    phone: '9876543220',
    address: 'Koramangala 4th Block',
    pinCode: '560034',
    quantity: 2,
    variant: 'Whole Bean',
    weight: '250g',
    status: 'waiting',
    isWaitingPreorder: true
  });

  const req = { admin: { username: 'testadmin' }, headers: {} };
  const res = createMockRes();

  await notifyWaitingCustomers(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.notifiedCount, 1);
  assert.strictEqual(res.body.failedCount, 0);

  const updatedOrder = await dataStore.getOrderById(waitingOrder.bookingId);
  assert.strictEqual(updatedOrder.restockNotificationSent, true);
  assert.ok(updatedOrder.restockNotificationSentAt, 'Timestamp must be recorded');
  assert.ok(updatedOrder.restockNotificationMessageId, 'MessageId must be recorded');
  assert.strictEqual(updatedOrder.restockNotificationError, null);
  assert.strictEqual(updatedOrder.restockClaimedAt, null);
});

// --- SUITE 4: Repeated Clicks Idempotency ---
console.log('\n--- SUITE 4: Repeated Clicks Idempotency ---');

await test('Subsequent click skips already notified order with zero duplicate emails', async () => {
  const req = { admin: { username: 'testadmin' }, headers: {} };
  const res = createMockRes();

  // Call a second time on the already-notified order
  await notifyWaitingCustomers(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.notifiedCount, 0);
  assert.strictEqual(res.body.failedCount, 0);
  assert.ok(res.body.message.includes('No unnotified waiting pre-orders found'));
});

// --- SUITE 5: Direct Brevo Service Duplicate Protection ---
console.log('\n--- SUITE 5: Direct Brevo Service Guard ---');

await test('sendWaitingRestockEmail directly skips orders where restockNotificationSent is true', async () => {
  const mockOrder = {
    email: 'test.duplicate@example.com',
    fullName: 'Duplicate Tester',
    variant: 'Whole Bean',
    weight: '250g',
    quantity: 1,
    bookingId: 'FR-TEST-DUP-1',
    restockNotificationSent: true
  };

  const result = await sendWaitingRestockEmail(mockOrder);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.skipped, true);
  assert.ok(result.message.includes('already been sent'));
});

// --- SUITE 6: Failed Email Handling & Error State ---
console.log('\n--- SUITE 6: Failed Email Handling ---');

await test('Failed email send does NOT mark order as notified and allows future retry', async () => {
  // Clear store
  const existing = await dataStore.getOrders();
  for (const o of existing) {
    await dataStore.deleteOrder(o.bookingId || o._id);
  }

  // Create waiting order with empty email to intentionally trigger dispatch failure
  const invalidOrder = await dataStore.createOrder({
    fullName: 'Invalid Recipient',
    email: '',
    phone: '9876543230',
    address: 'Whitefield',
    pinCode: '560066',
    quantity: 1,
    status: 'waiting',
    isWaitingPreorder: true
  });

  const req = { admin: { username: 'testadmin' }, headers: {} };
  const res = createMockRes();

  await notifyWaitingCustomers(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.notifiedCount, 0);
  assert.strictEqual(res.body.failedCount, 1);

  const checkOrder = await dataStore.getOrderById(invalidOrder.bookingId);
  assert.strictEqual(checkOrder.restockNotificationSent, false, 'Failed order must NOT be marked notified');
  assert.ok(checkOrder.restockNotificationError, 'Error message must be recorded');
  assert.strictEqual(checkOrder.restockClaimedAt, null, 'Claim must be released for retry');
});

// --- SUITE 7: Concurrent Requests Idempotency (Atomic Claiming) ---
console.log('\n--- SUITE 7: Concurrent Requests Concurrency Protection ---');

await test('Concurrent admin requests notify eligible orders exactly once without duplicate emails', async () => {
  // Clear store
  const existing = await dataStore.getOrders();
  for (const o of existing) {
    await dataStore.deleteOrder(o.bookingId || o._id);
  }

  // Seed 4 waiting orders
  const orders = [];
  for (let i = 1; i <= 4; i++) {
    const o = await dataStore.createOrder({
      fullName: `Concurrent Customer ${i}`,
      email: `concurrent${i}@example.com`,
      phone: `987654324${i}`,
      address: 'Bengaluru',
      pinCode: '560001',
      quantity: 1,
      variant: 'Whole Bean',
      weight: '250g',
      status: 'waiting',
      isWaitingPreorder: true
    });
    orders.push(o);
  }

  // Fire 3 concurrent requests simultaneously
  const req1 = { admin: { username: 'admin1' }, headers: {} };
  const req2 = { admin: { username: 'admin2' }, headers: {} };
  const req3 = { admin: { username: 'admin3' }, headers: {} };

  const res1 = createMockRes();
  const res2 = createMockRes();
  const res3 = createMockRes();

  await Promise.all([
    notifyWaitingCustomers(req1, res1),
    notifyWaitingCustomers(req2, res2),
    notifyWaitingCustomers(req3, res3)
  ]);

  // Total notified across all 3 concurrent responses must equal EXACTLY 4
  const totalNotified = (res1.body?.notifiedCount || 0) +
                        (res2.body?.notifiedCount || 0) +
                        (res3.body?.notifiedCount || 0);

  assert.strictEqual(totalNotified, 4, `Total notified orders across concurrent runs must be exactly 4 (was ${totalNotified})`);

  // Verify all 4 orders in store are marked notified with restockClaimedAt released
  const allUpdated = await dataStore.getOrders();
  for (const o of allUpdated) {
    if (o.status === 'waiting') {
      assert.strictEqual(o.restockNotificationSent, true);
      assert.ok(o.restockNotificationSentAt);
      assert.strictEqual(o.restockClaimedAt, null);
    }
  }
});

// --- SUMMARY ---
console.log('\n======================================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('======================================================================\n');

if (totalTests !== passedTests) {
  process.exit(1);
}
