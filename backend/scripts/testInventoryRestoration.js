import assert from 'node:assert';
import { updateOrderStatus, deleteOrder, createOrder } from '../controllers/orderController.js';
import { dataStore } from '../config/dataStore.js';
import StockHistory from '../models/StockHistory.js';
import Order from '../models/Order.js';

console.log('\n======================================================================');
console.log('🧪 RUNNING INVENTORY RESTORATION & IDEMPOTENCY TEST SUITE');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

function it(description, fn) {
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

async function itAsync(description, fn) {
  try {
    await fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// Helper to mock Express response object
function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

// ---------------------------------------------------------------------------
// SUITE 1: Model Schema Verification
// ---------------------------------------------------------------------------
console.log('--- SUITE 1: Schema & Action Type Verification ---');

it('StockHistory schema accepts actionType: ORDER_RESTORE', () => {
  const allowed = StockHistory.schema.path('actionType').enumValues;
  assert.ok(allowed.includes('ORDER_RESTORE'), 'actionType enum must include ORDER_RESTORE');
  assert.ok(allowed.includes('ORDER_DEDUCTION'), 'actionType enum must include ORDER_DEDUCTION');
});

it('Order schema includes stockDeducted, stockRestored, stockRestoredAt', () => {
  assert.ok(Order.schema.path('stockDeducted'), 'Order schema must have stockDeducted');
  assert.ok(Order.schema.path('stockRestored'), 'Order schema must have stockRestored');
  assert.ok(Order.schema.path('stockRestoredAt'), 'Order schema must have stockRestoredAt');
});

// ---------------------------------------------------------------------------
// SUITE 2: In-Stock Order Cancellation Restoration (MemoryStore / Controller)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 2: In-Stock Order Cancellation Restoration ---');

await itAsync('In-stock order cancellation restores Whole Bean quantity and decrements totalSold exactly once', async () => {
  // Set initial product stock in memoryStore
  await dataStore.updateProduct('prod_french_roast_250g_wholebean', { stock: 10, totalSold: 0 });

  // 1. Create in-stock order for 2 packs
  const order = await dataStore.createOrder({
    fullName: 'Rahul Dravid',
    phone: '9876543210',
    email: 'rahul.dravid@example.com',
    address: '100ft Road, Indiranagar',
    pinCode: '560038',
    variant: 'Whole Bean',
    quantity: 2,
    orderType: 'preorder',
    paymentMode: 'test',
    paymentStatus: 'simulated_success'
  });

  const prodAfterOrder = (await dataStore.getProducts()).find(p => p.variant === 'Whole Bean');
  assert.strictEqual(order.quantity, 2);
  assert.strictEqual(order.stockDeducted, true, 'In-stock order must record stockDeducted: true');
  assert.strictEqual(order.stockRestored, false, 'New order must have stockRestored: false');
  assert.strictEqual(prodAfterOrder.stock, 8, 'Stock must drop from 10 to 8 after 2 packs ordered');
  assert.strictEqual(prodAfterOrder.totalSold, 2, 'Total sold must increment by 2');

  // 2. Cancel the order via controller
  const req = {
    params: { id: order.bookingId },
    body: { status: 'cancelled' },
    admin: { _id: 'adm_123', username: 'StoreManager' }
  };
  const res = createMockRes();

  await updateOrderStatus(req, res);

  const prodAfterCancel = (await dataStore.getProducts()).find(p => p.variant === 'Whole Bean');
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.data.status, 'cancelled');
  assert.strictEqual(res.data.data.stockRestored, true, 'Order must record stockRestored: true');
  assert.strictEqual(prodAfterCancel.stock, 10, 'Whole Bean stock must be restored back from 8 to 10');
  assert.strictEqual(prodAfterCancel.totalSold, 0, 'Total sold must decrement back to 0');
});

// ---------------------------------------------------------------------------
// SUITE 3: Double Restoration Prevention on Repeated Cancellation
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 3: Double-Restoration Prevention on Repeated Cancellation ---');

await itAsync('Repeated cancellation of the same order does NOT restore stock twice', async () => {
  await dataStore.updateProduct('prod_french_roast_250g_wholebean', { stock: 10, totalSold: 0 });

  const order = await dataStore.createOrder({
    fullName: 'Anil Kumble',
    phone: '9876543211',
    email: 'anil.kumble@example.com',
    address: 'MG Road, Bengaluru',
    pinCode: '560001',
    variant: 'Whole Bean',
    quantity: 2,
    orderType: 'preorder',
    paymentMode: 'test',
    paymentStatus: 'simulated_success'
  });

  const prodAfterOrder = (await dataStore.getProducts()).find(p => p.variant === 'Whole Bean');
  assert.strictEqual(prodAfterOrder.stock, 8);

  // First cancellation
  const req1 = {
    params: { id: order.bookingId },
    body: { status: 'cancelled' },
    admin: { username: 'Admin' }
  };
  const res1 = createMockRes();
  await updateOrderStatus(req1, res1);

  const prodAfterFirstCancel = (await dataStore.getProducts()).find(p => p.variant === 'Whole Bean');
  assert.strictEqual(prodAfterFirstCancel.stock, 10, 'Stock restored to 10 on first cancellation');

  // Second (repeated) cancellation call on the same order
  const req2 = {
    params: { id: order.bookingId },
    body: { status: 'cancelled' },
    admin: { username: 'Admin' }
  };
  const res2 = createMockRes();
  await updateOrderStatus(req2, res2);

  const prodAfterSecondCancel = (await dataStore.getProducts()).find(p => p.variant === 'Whole Bean');
  assert.strictEqual(res2.statusCode, 200);
  assert.strictEqual(prodAfterSecondCancel.stock, 10, 'Stock MUST remain 10 and NOT increase to 12');
  assert.strictEqual(prodAfterSecondCancel.totalSold, 0, 'Total sold MUST remain 0');
});

// ---------------------------------------------------------------------------
// SUITE 4: Waiting Pre-Order Cancellation (Never Deducted Stock)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 4: Waiting Pre-Orders (Zero Stock Modification) ---');

await itAsync('Cancellation of a waiting pre-order does NOT restore stock', async () => {
  await dataStore.updateProduct('prod_french_roast_250g_wholebean', { stock: 0, totalSold: 5 });

  const waitingOrder = await dataStore.createOrder({
    fullName: 'Waitlist Customer',
    phone: '9876543212',
    email: 'waitlist@example.com',
    address: 'Koramangala 4th Block',
    pinCode: '560034',
    variant: 'Whole Bean',
    quantity: 3,
    status: 'waiting',
    orderType: 'preorder',
    paymentMode: 'none',
    paymentStatus: 'unpaid'
  });

  const prodAfterWaiting = (await dataStore.getProducts()).find(p => p.variant === 'Whole Bean');
  assert.strictEqual(waitingOrder.status, 'waiting');
  assert.strictEqual(waitingOrder.stockDeducted, false, 'Waiting order must have stockDeducted: false');
  assert.strictEqual(prodAfterWaiting.stock, 0, 'Stock must remain 0 when waiting pre-order is placed');

  // Cancel waiting pre-order
  const req = {
    params: { id: waitingOrder.bookingId },
    body: { status: 'cancelled' },
    admin: { username: 'Admin' }
  };
  const res = createMockRes();
  await updateOrderStatus(req, res);

  const prodAfterWaitingCancel = (await dataStore.getProducts()).find(p => p.variant === 'Whole Bean');
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.data.data.status, 'cancelled');
  assert.strictEqual(prodAfterWaitingCancel.stock, 0, 'Stock must NOT be artificially created on waiting pre-order cancellation');
  assert.strictEqual(prodAfterWaitingCancel.totalSold, 5, 'Total sold must not be changed');
});

// ---------------------------------------------------------------------------
// SUITE 5: Deletion of In-Stock Order
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 5: Deletion of Active In-Stock Orders ---');

await itAsync('Deleting an active in-stock order restores stock if not previously cancelled', async () => {
  await dataStore.updateProduct('prod_french_roast_250g_wholebean', { stock: 10, totalSold: 0 });

  const order = await dataStore.createOrder({
    fullName: 'Javagal Srinath',
    phone: '9876543213',
    email: 'srinath@example.com',
    address: 'Jayanagar, Bengaluru',
    pinCode: '560011',
    variant: 'Whole Bean',
    quantity: 3,
    paymentMode: 'test',
    paymentStatus: 'simulated_success'
  });

  const prodAfterOrder = (await dataStore.getProducts()).find(p => p.variant === 'Whole Bean');
  assert.strictEqual(prodAfterOrder.stock, 7, 'Stock dropped from 10 to 7');
  assert.strictEqual(prodAfterOrder.totalSold, 3);

  // Directly delete the order
  const req = {
    params: { id: order.bookingId },
    admin: { username: 'Admin' }
  };
  const res = createMockRes();
  await deleteOrder(req, res);

  const prodAfterDelete = (await dataStore.getProducts()).find(p => p.variant === 'Whole Bean');
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(prodAfterDelete.stock, 10, 'Stock must be restored from 7 back to 10 on deletion');
  assert.strictEqual(prodAfterDelete.totalSold, 0, 'Total sold must decrement back to 0 on deletion');

  // Verify order is removed from store
  const fetched = await dataStore.getOrderById(order.bookingId);
  assert.strictEqual(fetched, null, 'Deleted order must no longer exist in dataStore');
});

// ---------------------------------------------------------------------------
// SUITE 6: Deletion of Already-Cancelled Order (Double-Restoration Prevention)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 6: Deletion of Already-Cancelled Orders ---');

await itAsync('Deleting an order that was ALREADY cancelled does NOT restore stock twice', async () => {
  await dataStore.updateProduct('prod_french_roast_250g_wholebean', { stock: 10, totalSold: 0 });

  const order = await dataStore.createOrder({
    fullName: 'Venkatesh Prasad',
    phone: '9876543214',
    email: 'prasad@example.com',
    address: 'Malleshwaram, Bengaluru',
    pinCode: '560003',
    variant: 'Whole Bean',
    quantity: 2,
    paymentMode: 'test'
  });

  const prodAfterOrder = (await dataStore.getProducts()).find(p => p.variant === 'Whole Bean');
  assert.strictEqual(prodAfterOrder.stock, 8);

  // Step 1: Cancel order -> Stock restored to 10
  const reqCancel = {
    params: { id: order.bookingId },
    body: { status: 'cancelled' },
    admin: { username: 'Admin' }
  };
  await updateOrderStatus(reqCancel, createMockRes());

  const prodAfterCancel = (await dataStore.getProducts()).find(p => p.variant === 'Whole Bean');
  assert.strictEqual(prodAfterCancel.stock, 10);

  // Step 2: Now delete the cancelled order
  const reqDelete = {
    params: { id: order.bookingId },
    admin: { username: 'Admin' }
  };
  const resDelete = createMockRes();
  await deleteOrder(reqDelete, resDelete);

  const prodAfterDelete = (await dataStore.getProducts()).find(p => p.variant === 'Whole Bean');
  assert.strictEqual(resDelete.statusCode, 200);
  assert.strictEqual(prodAfterDelete.stock, 10, 'Stock MUST remain 10 and NOT increase to 12 upon deleting cancelled order');
  assert.strictEqual(prodAfterDelete.totalSold, 0);
});

// ---------------------------------------------------------------------------
// SUITE 7: Deletion of Waiting Pre-Order (Zero Stock Restoration)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 7: Deletion of Waiting Pre-Orders ---');

await itAsync('Deleting a waiting pre-order does NOT restore stock', async () => {
  await dataStore.updateProduct('prod_french_roast_250g_wholebean', { stock: 5, totalSold: 2 });

  const waitingOrder = await dataStore.createOrder({
    fullName: 'Waitlist Delete Test',
    phone: '9876543215',
    email: 'waitdelete@example.com',
    address: 'Whitefield, Bengaluru',
    pinCode: '560066',
    variant: 'Whole Bean',
    quantity: 4,
    status: 'waiting',
    paymentMode: 'none',
    paymentStatus: 'unpaid'
  });

  const prodAfterWaiting = (await dataStore.getProducts()).find(p => p.variant === 'Whole Bean');
  assert.strictEqual(prodAfterWaiting.stock, 5, 'Stock unaffected by waiting pre-order');

  const reqDelete = {
    params: { id: waitingOrder.bookingId },
    admin: { username: 'Admin' }
  };
  const resDelete = createMockRes();
  await deleteOrder(reqDelete, resDelete);

  const prodAfterDelete = (await dataStore.getProducts()).find(p => p.variant === 'Whole Bean');
  assert.strictEqual(resDelete.statusCode, 200);
  assert.strictEqual(prodAfterDelete.stock, 5, 'Stock MUST remain 5 and NOT increase');
  assert.strictEqual(prodAfterDelete.totalSold, 2, 'Total sold MUST remain 2');
});

// ---------------------------------------------------------------------------
// SUITE 8: Repeated Deletion (Idempotent 404 Handling)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 8: Repeated Deletion Idempotency ---');

await itAsync('Deleting an already deleted order safely returns 404 without modifying stock', async () => {
  const products = await dataStore.getProducts();
  const prod = products.find(p => p.variant === 'Whole Bean');
  const initialStock = prod.stock;

  const reqDelete = {
    params: { id: 'FR-NONEXISTENT-999' },
    admin: { username: 'Admin' }
  };
  const resDelete = createMockRes();
  await deleteOrder(reqDelete, resDelete);

  const prodAfterNonexistent = (await dataStore.getProducts()).find(p => p.variant === 'Whole Bean');
  assert.strictEqual(resDelete.statusCode, 404);
  assert.strictEqual(prodAfterNonexistent.stock, initialStock, 'Stock must not change when order not found');
});

console.log('\n======================================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('======================================================================\n');

if (failed > 0) process.exit(1);
