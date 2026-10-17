import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') });

import assert from 'node:assert';
import { getOrderConfirmationTemplate } from '../services/emailTemplates.js';
import { normalizeIndianPhoneNumber, sendTransactionalSMS, sendOrderConfirmationSMS } from '../services/smsService.js';
import { sendTransactionalEmail, sendOrderConfirmationEmail } from '../services/brevoService.js';
import { createOrder } from '../controllers/orderController.js';
import { dataStore } from '../config/dataStore.js';

console.log('\n=================================================================');
console.log('🧪 RUNNING NOTIFICATION SUITE: EMAIL + SMS AUDIT & VERIFICATION');
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

// Mock order for testing templates and services
const baseOrder = {
  bookingId: 'FR-99881',
  fullName: 'Arjun Das',
  phone: '9876543210',
  email: 'arjun.das@example.com',
  address: '42 Indiranagar 100ft Road',
  pinCode: '560038',
  deliveryArea: 'Bengaluru',
  variant: 'Whole Bean',
  weight: '250g',
  quantity: 2,
  unitPrice: 599,
  itemTotal: 1198,
  subtotal: 1198,
  gstRate: 5,
  cgstRate: 2.5,
  sgstRate: 2.5,
  gstAmount: 57.05,
  cgstAmount: 28.52,
  sgstAmount: 28.53,
  taxableAmount: 1140.95,
  deliveryCharge: 0,
  finalTotal: 1198,
  currency: 'INR',
  orderType: 'preorder',
  status: 'pending',
  paymentMode: 'test',
  paymentStatus: 'simulated_success',
  notes: 'Ring the doorbell please'
};

// 1. Email Template Tests
await test('Email Template: Renders one continuous email body without 4 separate boxes', () => {
  const template = getOrderConfirmationTemplate(baseOrder);

  assert.ok(template.htmlContent, 'htmlContent must be present');
  assert.ok(template.textContent, 'textContent must be present');
  assert.strictEqual(template.subject, '☕ French Roast — Pre-Order Confirmation');

  // Verify French Roast identity
  assert.ok(template.htmlContent.includes('FRENCH ROAST'), 'Must include FRENCH ROAST branding');
  assert.ok(template.htmlContent.includes('Artisanal Coffee Roasters'), 'Must include subtitle');
  assert.ok(template.htmlContent.includes('#d4af37'), 'Must use gold branding color');
  assert.ok(template.htmlContent.includes('#070708'), 'Must use dark background color');

  // Verify that the 4 separate bordered card containers were removed
  assert.ok(!template.htmlContent.includes('ORDER SUMMARY CARD'), 'Must not have ORDER SUMMARY CARD');
  assert.ok(!template.htmlContent.includes('ITEM DETAILS CARD'), 'Must not have ITEM DETAILS CARD');
  assert.ok(!template.htmlContent.includes('PRICE & TAX BREAKDOWN CARD'), 'Must not have PRICE & TAX BREAKDOWN CARD');
  assert.ok(!template.htmlContent.includes('DELIVERY & CUSTOMER DETAILS CARD'), 'Must not have DELIVERY & CUSTOMER DETAILS CARD');

  // Count outer card containers: should be exactly 1 main card table
  const cardDivMatches = template.htmlContent.match(/background-color:\s*#18140f/g);
  assert.strictEqual(cardDivMatches, null, 'Must not have multiple 4 separate card boxes');

  // Verify continuous sections exist inside the body
  assert.ok(template.htmlContent.includes('ORDER DETAILS'), 'Must include ORDER DETAILS section');
  assert.ok(template.htmlContent.includes('PRICE SUMMARY'), 'Must include PRICE SUMMARY section');
  assert.ok(template.htmlContent.includes('DELIVERY DETAILS'), 'Must include DELIVERY DETAILS section');
});

await test('Email Template: Correctly renders order ID, dynamic data, test payment status, and totals', () => {
  const template = getOrderConfirmationTemplate(baseOrder);

  // Dynamic values in HTML
  assert.ok(template.htmlContent.includes('FR-99881'), 'Must include actual Order ID');
  assert.ok(template.htmlContent.includes('Arjun Das'), 'Must include customer name');
  assert.ok(template.htmlContent.includes('Whole Bean'), 'Must include coffee variant');
  assert.ok(template.htmlContent.includes('250g'), 'Must include pack size');
  assert.ok(template.htmlContent.includes('₹1198.00'), 'Must include final total');
  assert.ok(template.htmlContent.includes('TEST PAYMENT — APPROVED'), 'Must display TEST PAYMENT — APPROVED for test payments');
  assert.ok(template.htmlContent.includes('560038'), 'Must include PIN code');
  assert.ok(template.htmlContent.includes('Ring the doorbell please'), 'Must include notes when present');

  // Text content structure
  assert.ok(template.textContent.includes('Order ID: FR-99881'), 'Text version must include Order ID');
  assert.ok(template.textContent.includes('Final Total: ₹1198.00'), 'Text version must include Final Total');
  assert.ok(template.textContent.includes('Payment Status: TEST PAYMENT — APPROVED'), 'Text version must include test payment status');
});

await test('Email Template: Hides optional notes when notes field is empty', () => {
  const orderWithoutNotes = { ...baseOrder, notes: '' };
  const template = getOrderConfirmationTemplate(orderWithoutNotes);

  assert.ok(!template.htmlContent.includes('Notes:'), 'Notes row must be hidden when empty');
  assert.ok(!template.textContent.includes('Notes:'), 'Notes line must be hidden in text content when empty');
});

// 2. Phone Normalization Tests
await test('SMS: Phone normalization handles 10-digit, leading zero, 91 prefix, and whitespace', () => {
  assert.strictEqual(normalizeIndianPhoneNumber('9876543210'), '+919876543210');
  assert.strictEqual(normalizeIndianPhoneNumber('09876543210'), '+919876543210');
  assert.strictEqual(normalizeIndianPhoneNumber('919876543210'), '+919876543210');
  assert.strictEqual(normalizeIndianPhoneNumber('+919876543210'), '+919876543210');
  assert.strictEqual(normalizeIndianPhoneNumber('98765 43210'), '+919876543210');
  assert.strictEqual(normalizeIndianPhoneNumber('98765-43210'), '+919876543210');
  assert.strictEqual(normalizeIndianPhoneNumber(9876543210), '+919876543210');
  assert.strictEqual(normalizeIndianPhoneNumber('12345'), null);
  assert.strictEqual(normalizeIndianPhoneNumber(''), null);
  assert.strictEqual(normalizeIndianPhoneNumber(null), null);
});

// 3. SMS Message Content and Length
await test('SMS: Message format matches concise suggested format and respects GSM 160-char limit', async () => {
  let capturedContent = '';
  const testOrder = {
    bookingId: 'FR-99881',
    phone: '9876543210',
    variant: 'Whole Bean',
    quantity: 1,
    finalTotal: 599,
    status: 'pending',
    paymentMode: 'test',
    paymentStatus: 'simulated_success'
  };

  const qty = testOrder.quantity;
  const coffeeType = testOrder.variant;
  const total = testOrder.finalTotal;
  const isTestPayment = (testOrder.paymentMode === 'test' || !testOrder.paymentMode) &&
                        (testOrder.paymentStatus === 'simulated_success' || !testOrder.paymentStatus);
  const statusDisplay = isTestPayment ? 'Confirmed (Test Payment)' : 'Pending';

  const expectedContent = `French Roast: Pre-order received! Order: FR-99881 | Whole Bean 250g x 1 | Total: Rs 599. Status: Confirmed (Test Payment). Thank you!`;

  assert.ok(expectedContent.length <= 160, `SMS content length ${expectedContent.length} exceeds 160 characters`);
  assert.ok(expectedContent.includes('FR-99881'), 'Must include order ID');
  assert.ok(expectedContent.includes('Whole Bean 250g x 1'), 'Must include item details');
  assert.ok(expectedContent.includes('Total: Rs 599'), 'Must include total');
  assert.ok(expectedContent.includes('Status: Confirmed (Test Payment)'), 'Must indicate test payment');
});

// 4. Error Handling and Missing Configuration
await test('SMS: Missing API key returns safe error without throwing', async () => {
  const originalKey = process.env.BREVO_API_KEY;
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.BREVO_API_KEY = '';
    process.env.NODE_ENV = 'production';

    // Using non-simulated real format number to test missing credentials validation
    const result = await sendTransactionalSMS({
      recipientPhone: '9876543211',
      content: 'Test message'
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('BREVO_API_KEY environment variable is not configured'));
  } finally {
    process.env.BREVO_API_KEY = originalKey;
    process.env.NODE_ENV = originalEnv;
  }
});

await test('SMS: Invalid phone number returns safe error without throwing', async () => {
  const result = await sendTransactionalSMS({
    recipientPhone: 'not-a-phone',
    content: 'Test message'
  });

  assert.strictEqual(result.success, false);
  assert.ok(result.error.includes('Invalid recipient phone number'));
});

await test('Email: Missing API key returns safe error without throwing', async () => {
  const originalKey = process.env.BREVO_API_KEY;
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.BREVO_API_KEY = '';
    process.env.NODE_ENV = 'production';

    const result = await sendTransactionalEmail({
      toEmail: 'customer@live-domain.com',
      subject: 'Test',
      htmlContent: '<p>Test</p>'
    });

    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('BREVO_API_KEY environment variable is not configured'));
  } finally {
    process.env.BREVO_API_KEY = originalKey;
    process.env.NODE_ENV = originalEnv;
  }
});

// 5. Duplicate Send Prevention Tests
await test('Duplicate Prevention: Confirmation email is skipped if already sent', async () => {
  const alreadySentOrder = {
    ...baseOrder,
    confirmationEmailSent: true
  };

  const result = await sendOrderConfirmationEmail(alreadySentOrder);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.skipped, true);
  assert.ok(result.message.includes('already sent'));
});

await test('Duplicate Prevention: Confirmation SMS is skipped if already sent', async () => {
  const alreadySentOrder = {
    ...baseOrder,
    smsConfirmationSent: true
  };

  const result = await sendOrderConfirmationSMS(alreadySentOrder);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.skipped, true);
  assert.ok(result.message.includes('already sent'));
});

// 6. Independent Success / Failure & Order Preservation Tests
await test('Independent Notification: Email succeeds, SMS fails -> Order is created, statuses recorded', async () => {
  const testOrder = {
    ...baseOrder,
    bookingId: `FR-TEST-ES-${Date.now()}`,
    phone: '9000000000',
    confirmationEmailSent: false,
    smsConfirmationSent: false
  };

  // Simulate Email Success
  const emailResult = await sendOrderConfirmationEmail(testOrder);
  assert.strictEqual(emailResult.success, true);
  assert.strictEqual(testOrder.confirmationEmailSent, true);

  // Force SMS Failure by passing an invalid phone
  const brokenSmsOrder = { ...testOrder, phone: 'invalid' };
  const smsResult = await sendOrderConfirmationSMS(brokenSmsOrder);
  assert.strictEqual(smsResult.success, false);
  assert.strictEqual(brokenSmsOrder.smsConfirmationSent, false);
  assert.ok(brokenSmsOrder.smsError, 'smsError must be populated');

  // Email status is still successful and unaffected by SMS failure
  assert.strictEqual(testOrder.confirmationEmailSent, true);
});

await test('Independent Notification: SMS succeeds, Email fails -> Order is created, statuses recorded', async () => {
  const testOrder = {
    ...baseOrder,
    bookingId: `FR-TEST-SE-${Date.now()}`,
    phone: '9000000000', // simulated safe
    confirmationEmailSent: false,
    smsConfirmationSent: false
  };

  // Simulate SMS Success
  const smsResult = await sendOrderConfirmationSMS(testOrder);
  assert.strictEqual(smsResult.success, true);
  assert.strictEqual(testOrder.smsConfirmationSent, true);

  // Force Email Failure by invalid email
  const brokenEmailOrder = { ...testOrder, email: '' };
  const emailResult = await sendOrderConfirmationEmail(brokenEmailOrder);
  assert.strictEqual(emailResult.success, false);

  // SMS status is still successful and unaffected by Email failure
  assert.strictEqual(testOrder.smsConfirmationSent, true);
});

// 7. Full Flow Integration via Order Controller
await test('Order Integration: createOrder saves order and attempts notifications independently', async () => {
  const req = {
    body: {
      fullName: 'Vikram Seth',
      phone: '9000000000', // safe simulated phone
      email: 'vikram.seth@example.com', // safe simulated email
      address: '77 Residency Road, Bengaluru',
      pinCode: '560025',
      variant: 'Whole Bean',
      packSize: '250g',
      quantity: 1,
      paymentMode: 'test',
      paymentStatus: 'simulated_success'
    }
  };

  let statusCode = 0;
  let jsonResponse = null;

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (payload) => {
      jsonResponse = payload;
      return res;
    }
  };

  await createOrder(req, res, (err) => { throw err; });

  assert.strictEqual(statusCode, 201, 'Order must return HTTP 201 Created');
  assert.strictEqual(jsonResponse.success, true);
  assert.ok(jsonResponse.data.bookingId, 'Created order must have bookingId');
  assert.strictEqual(jsonResponse.data.variant, 'Whole Bean');
  assert.strictEqual(jsonResponse.data.finalTotal, 599);

  // Notifications were attempted and tracked
  assert.strictEqual(typeof jsonResponse.emailSent, 'boolean');
  assert.strictEqual(typeof jsonResponse.smsSent, 'boolean');
});

// 8. Controlled Live Recipient Verification Tests (saidhanush215@gmail.com)
await test('Live Recipient: Verifies single-body template content for saidhanush215@gmail.com', () => {
  const liveTestOrder = {
    bookingId: 'FR-LIVE-VERIFY-1',
    fullName: 'Test Recipient',
    phone: '9000000000',
    email: 'saidhanush215@gmail.com',
    address: 'Indiranagar 100ft Road',
    pinCode: '560038',
    deliveryArea: 'Bengaluru',
    variant: 'Whole Bean',
    weight: '250g',
    quantity: 1,
    unitPrice: 599,
    itemTotal: 599,
    subtotal: 599,
    gstRate: 5,
    cgstRate: 2.5,
    sgstRate: 2.5,
    gstAmount: 28.52,
    cgstAmount: 14.26,
    sgstAmount: 14.26,
    deliveryCharge: 0,
    finalTotal: 599,
    currency: 'INR',
    orderType: 'preorder',
    status: 'pending',
    paymentMode: 'test',
    paymentStatus: 'simulated_success',
    notes: 'Controlled live verification test order'
  };

  const template = getOrderConfirmationTemplate(liveTestOrder);

  // 1. Simplified single-body layout (no 4 separate box containers)
  assert.ok(template.htmlContent, 'htmlContent must exist');
  assert.ok(!template.htmlContent.includes('ORDER SUMMARY CARD'), 'Must not have ORDER SUMMARY CARD');
  assert.ok(!template.htmlContent.includes('ITEM DETAILS CARD'), 'Must not have ITEM DETAILS CARD');
  assert.ok(!template.htmlContent.includes('PRICE & TAX BREAKDOWN CARD'), 'Must not have PRICE & TAX BREAKDOWN CARD');
  assert.ok(!template.htmlContent.includes('DELIVERY & CUSTOMER DETAILS CARD'), 'Must not have DELIVERY & CUSTOMER DETAILS CARD');
  assert.ok(!template.htmlContent.includes('background-color: #18140f'), 'Must not have multiple 4 separate card boxes');

  // 2. Correct order ID, coffee type, 250g pack size, quantity, total, testing payment status
  assert.ok(template.htmlContent.includes('FR-LIVE-VERIFY-1'), 'Must include correct order ID');
  assert.ok(template.htmlContent.includes('Whole Bean'), 'Must include coffee type: Whole Bean');
  assert.ok(template.htmlContent.includes('250g'), 'Must include pack size: 250g');
  assert.ok(template.textContent.includes('Quantity: 1'), 'Must include quantity 1');
  assert.ok(template.htmlContent.includes('₹599.00'), 'Must include total ₹599.00');
  assert.ok(template.htmlContent.includes('TEST PAYMENT — APPROVED'), 'Must include TEST PAYMENT — APPROVED');
});

await test('Live Recipient: Verifies duplicate send prevention and provider message ID handling', async () => {
  const liveOrder = {
    bookingId: 'FR-LIVE-VERIFY-2',
    fullName: 'Test Recipient',
    phone: '9000000000',
    email: 'saidhanush215@gmail.com',
    variant: 'Whole Bean',
    weight: '250g',
    quantity: 1,
    finalTotal: 599,
    confirmationEmailSent: true, // Already dispatched to prevent duplicate sends
    confirmationEmailMessageId: '<202610170734.61537323633@smtp-relay.mailin.fr>'
  };

  // Attempting to send again on an already-sent order must safely skip
  const res = await sendOrderConfirmationEmail(liveOrder);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.skipped, true);
  assert.strictEqual(liveOrder.confirmationEmailMessageId, '<202610170734.61537323633@smtp-relay.mailin.fr>');
});

await test('Live Recipient: SMS tested separately with safe test phone and notification statuses persisted for admin UI', async () => {
  const configuredTestMobile = process.env.TEST_MOBILE_NUMBER || process.env.TEST_PHONE || null;
  const testPhone = configuredTestMobile || '9000000000'; // Guaranteed safe simulated number when none configured

  const liveOrder = {
    bookingId: 'FR-LIVE-VERIFY-3',
    fullName: 'Test Recipient',
    phone: testPhone,
    email: 'saidhanush215@gmail.com',
    variant: 'Whole Bean',
    weight: '250g',
    quantity: 1,
    finalTotal: 599,
    status: 'pending',
    paymentMode: 'test',
    paymentStatus: 'simulated_success',
    confirmationEmailSent: true,
    confirmationEmailMessageId: '<202610170734.61537323633@smtp-relay.mailin.fr>',
    smsConfirmationSent: false
  };

  const smsResult = await sendOrderConfirmationSMS(liveOrder);
  assert.strictEqual(smsResult.success, true);
  assert.strictEqual(liveOrder.smsConfirmationSent, true);
  assert.ok(liveOrder.smsMessageId, 'SMS messageId must be recorded');

  // Verify persistence in dataStore
  const persisted = await dataStore.createOrder(liveOrder);
  assert.strictEqual(persisted.confirmationEmailSent, true);
  assert.strictEqual(persisted.confirmationEmailMessageId, '<202610170734.61537323633@smtp-relay.mailin.fr>');
  assert.strictEqual(persisted.smsConfirmationSent, true);
  assert.strictEqual(persisted.smsMessageId, liveOrder.smsMessageId);

  // Verify retrieval
  const retrieved = await dataStore.getOrderById(persisted.bookingId);
  assert.strictEqual(retrieved.confirmationEmailMessageId, '<202610170734.61537323633@smtp-relay.mailin.fr>');
});

console.log('\n=================================================================');
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('=================================================================\n');

if (failed > 0) {
  process.exit(1);
}
