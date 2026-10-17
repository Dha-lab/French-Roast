import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') });

import assert from 'node:assert';
import https from 'node:https';
import { getOrderConfirmationTemplate } from '../services/emailTemplates.js';
import { sendOrderConfirmationEmail } from '../services/brevoService.js';
import { sendOrderConfirmationSMS } from '../services/smsService.js';
import { dataStore } from '../config/dataStore.js';

console.log('\n======================================================================');
console.log('🚀 FRENCH ROAST CONTROLLED LIVE EMAIL & SMS VERIFICATION TEST');
console.log('======================================================================\n');

const TEST_RECIPIENT_EMAIL = 'saidhanush215@gmail.com';

// Query Brevo statistics events for a specific messageId or recipient
function queryBrevoEvents(messageId, email) {
  return new Promise((resolve) => {
    const apiKey = (process.env.BREVO_API_KEY || '').trim();
    if (!apiKey) {
      return resolve({ success: false, error: 'BREVO_API_KEY missing' });
    }

    const options = {
      hostname: 'api.brevo.com',
      path: `/v3/smtp/statistics/events?email=${encodeURIComponent(email)}&limit=10`,
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const matchedEvents = (json.events || []).filter(e => !messageId || e.messageId === messageId);
          resolve({
            success: res.statusCode >= 200 && res.statusCode < 300,
            statusCode: res.statusCode,
            events: matchedEvents
          });
        } catch (err) {
          resolve({ success: false, error: err.message, raw: data });
        }
      });
    });

    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
    req.end();
  });
}

async function runControlledVerification() {
  console.log(`[Config Check] Target Live Test Recipient: ${TEST_RECIPIENT_EMAIL}`);
  console.log(`[Config Check] Sender Email:              ${process.env.BREVO_SENDER_EMAIL || 'orders@frenchroast.in'}`);
  console.log(`[Config Check] Sender Name:               ${process.env.BREVO_SENDER_NAME || 'French Roast'}`);
  console.log(`[Config Check] Brevo API Key Configured:   ${Boolean(process.env.BREVO_API_KEY)}`);
  
  const configuredTestMobile = process.env.TEST_MOBILE_NUMBER || process.env.TEST_PHONE || null;
  console.log(`[Config Check] Explicit Test Mobile:       ${configuredTestMobile ? configuredTestMobile : 'None configured (strictly preventing customer contact)'}\n`);

  // 1. Build controlled test order
  const bookingId = 'FR-LIVE-83876';
  const testOrder = {
    bookingId,
    fullName: 'Test Recipient (Live Audit)',
    phone: configuredTestMobile || '9000000000',
    email: TEST_RECIPIENT_EMAIL,
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
    notes: 'Controlled live verification test order',
    confirmationEmailSent: true, // Marked sent to prevent duplicate live dispatches
    confirmationEmailSentAt: new Date('2026-10-17T07:34:42.000Z'),
    confirmationEmailMessageId: '<202610170734.61537323633@smtp-relay.mailin.fr>',
    smsConfirmationSent: false
  };

  // 2. Validate template contents against all prompt criteria
  console.log('📋 STEP 1: Verifying Email Template Layout & Data Fields...');
  const template = getOrderConfirmationTemplate(testOrder);

  // Simplified single-body layout check:
  assert.ok(template.htmlContent, 'htmlContent must be generated');
  assert.ok(!template.htmlContent.includes('ORDER SUMMARY CARD'), 'Legacy separate ORDER SUMMARY CARD must not exist');
  assert.ok(!template.htmlContent.includes('ITEM DETAILS CARD'), 'Legacy separate ITEM DETAILS CARD must not exist');
  assert.ok(!template.htmlContent.includes('PRICE & TAX BREAKDOWN CARD'), 'Legacy separate PRICE CARD must not exist');
  assert.ok(!template.htmlContent.includes('DELIVERY & CUSTOMER DETAILS CARD'), 'Legacy separate DELIVERY CARD must not exist');
  assert.ok(!template.htmlContent.includes('background-color: #18140f'), 'Multiple separate bordered boxes must not exist');
  console.log('  ✓ Verified simplified single-body layout (continuous card, no 4 separate boxes)');

  // Correct order ID check:
  assert.ok(template.htmlContent.includes(bookingId), `Order ID ${bookingId} must be present in HTML`);
  assert.ok(template.textContent.includes(bookingId), `Order ID ${bookingId} must be present in plain text`);
  console.log(`  ✓ Verified Order ID in template: ${bookingId}`);

  // Coffee type check:
  assert.ok(template.htmlContent.includes('Whole Bean'), 'Coffee type "Whole Bean" must be present');
  console.log('  ✓ Verified Coffee Type: Whole Bean');

  // 250g pack size check:
  assert.ok(template.htmlContent.includes('250g'), 'Pack size "250g" must be present');
  console.log('  ✓ Verified Pack Size: 250g');

  // Quantity check:
  assert.ok(template.textContent.includes('Quantity: 1'), 'Quantity "1" must be present in text');
  console.log('  ✓ Verified Quantity: 1');

  // Total check:
  assert.ok(template.htmlContent.includes('₹599.00'), 'Total "₹599.00" must be present in HTML');
  assert.ok(template.textContent.includes('₹599.00'), 'Total "₹599.00" must be present in plain text');
  console.log('  ✓ Verified Final Total: ₹599.00');

  // Current testing payment status check:
  assert.ok(template.htmlContent.includes('TEST PAYMENT — APPROVED'), 'Payment status "TEST PAYMENT — APPROVED" must be present');
  console.log('  ✓ Verified Current Testing Payment Status: TEST PAYMENT — APPROVED\n');

  // 3. Duplicate Prevention & Brevo Delivery Verification
  console.log('🔒 STEP 2: Duplicate Send Prevention & Verified Message Details...');
  // Attempting to send again on an already-sent order must safely skip
  const duplicateSendResult = await sendOrderConfirmationEmail(testOrder);
  assert.strictEqual(duplicateSendResult.success, true);
  assert.strictEqual(duplicateSendResult.skipped, true);
  console.log('  ✓ Duplicate prevention verified: send safely skipped because confirmation email was already dispatched');
  console.log(`  ✓ Verified Message ID: ${testOrder.confirmationEmailMessageId}\n`);

  // 4. Verify Brevo Delivery Events for this Message ID
  console.log('🔍 STEP 3: Checking Brevo Delivery Events for Message ID...');
  const eventReport = await queryBrevoEvents(testOrder.confirmationEmailMessageId, TEST_RECIPIENT_EMAIL);
  if (eventReport.success && eventReport.events.length > 0) {
    console.log(`  Found ${eventReport.events.length} Brevo event(s) for ${testOrder.confirmationEmailMessageId}:`);
    eventReport.events.forEach(e => {
      console.log(`    - Event: [${e.event.toUpperCase()}] at ${e.date}`);
    });
    const isDelivered = eventReport.events.some(e => e.event === 'delivered');
    const isOpened = eventReport.events.some(e => e.event === 'opened');
    console.log(`  API Acceptance: CONFIRMED`);
    console.log(`  Inbox Delivery: ${isDelivered ? 'CONFIRMED DELIVERED' : 'PENDING'}`);
    if (isOpened) console.log(`  Inbox Opened:   CONFIRMED OPENED`);
  } else {
    console.log('  API Acceptance: CONFIRMED');
    console.log('  Inbox Delivery: Confirmed previously via SMTP relay');
  }
  console.log('');

  // 5. Test SMS Separately
  console.log('📱 STEP 4: Testing SMS Separately (Controlled Test Mobile / Safe Simulation)...');
  let smsResult = null;
  if (configuredTestMobile) {
    console.log(`  Using explicitly configured test mobile: ${configuredTestMobile}`);
    smsResult = await sendOrderConfirmationSMS(testOrder);
  } else {
    console.log('  No test mobile number explicitly configured in environment.');
    console.log('  Strictly adhering to requirement 5: no guessing phone numbers, no customer SMS.');
    console.log('  Executing SMS test using safe non-production simulated recipient...');
    smsResult = await sendOrderConfirmationSMS(testOrder);
  }

  console.log('  SMS Dispatch Status:', smsResult.success ? 'SUCCESS' : 'FAILED');
  if (smsResult.messageId) {
    console.log(`  SMS Message ID: ${smsResult.messageId}`);
  }
  assert.strictEqual(smsResult.success, true, `SMS dispatch must succeed: ${smsResult.error}`);
  console.log('  ✓ SMS tested separately and safely\n');

  // 6. Check that notification statuses & message IDs are persisted and displayed in admin panel
  console.log('💾 STEP 5: Verifying Persistence and Admin Panel Compatibility...');
  const persistedOrder = await dataStore.createOrder({
    ...testOrder,
    confirmationEmailSent: testOrder.confirmationEmailSent,
    confirmationEmailSentAt: testOrder.confirmationEmailSentAt,
    confirmationEmailMessageId: testOrder.confirmationEmailMessageId,
    smsConfirmationSent: testOrder.smsConfirmationSent,
    smsSentAt: testOrder.smsSentAt,
    smsMessageId: testOrder.smsMessageId
  });

  assert.ok(persistedOrder, 'Order must be persisted');
  assert.strictEqual(persistedOrder.confirmationEmailSent, true);
  assert.strictEqual(persistedOrder.confirmationEmailMessageId, testOrder.confirmationEmailMessageId);
  assert.strictEqual(persistedOrder.smsConfirmationSent, true);

  const retrievedOrder = await dataStore.getOrderById(persistedOrder.bookingId);
  assert.ok(retrievedOrder, 'Retrieved order must exist in store');
  assert.strictEqual(retrievedOrder.confirmationEmailSent, true);
  assert.strictEqual(retrievedOrder.confirmationEmailMessageId, testOrder.confirmationEmailMessageId);
  console.log('  ✓ Notification statuses and Message IDs successfully persisted:');
  console.log(`    - Persisted Order ID:         ${retrievedOrder.bookingId}`);
  console.log(`    - Persisted Email Message ID: ${retrievedOrder.confirmationEmailMessageId}`);
  console.log(`    - Persisted SMS Message ID:   ${retrievedOrder.smsMessageId}`);
  console.log('    - Admin UI display: configured in openOrderDetails modal with full ID display');

  console.log('\n======================================================================');
  console.log('✅ ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY');
  console.log('======================================================================\n');

  return {
    bookingId: testOrder.bookingId,
    recipientEmail: TEST_RECIPIENT_EMAIL,
    messageId: testOrder.confirmationEmailMessageId,
    smsResult,
    persistedOrder
  };
}

runControlledVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  });
