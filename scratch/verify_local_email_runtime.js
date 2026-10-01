import { getOrderConfirmationTemplate } from '../backend/services/emailTemplates.js';

async function verifyLocalRuntime() {
  console.log('=== 1. TESTING LOCAL TEMPLATE GENERATOR OUTPUT ===');
  const dummyOrder = {
    bookingId: 'FR-TEST999',
    _id: '6abe1c896d2d654eefefad99',
    fullName: 'Local Runtime Tester',
    email: 'hello@frenchroast.in',
    phone: '9876543210',
    address: '123 MG Road, Indiranagar',
    pinCode: '560038',
    deliveryArea: 'Bengaluru',
    variant: 'Powder',
    weight: '250g',
    quantity: 1,
    unitPrice: 499,
    taxableAmount: 475.24,
    cgstRate: 2.5,
    cgstAmount: 11.88,
    sgstRate: 2.5,
    sgstAmount: 11.88,
    gstRate: 5,
    gstAmount: 23.76,
    deliveryCharge: 0,
    finalTotal: 499,
    orderType: 'preorder',
    status: 'pending',
    paymentMode: 'test',
    paymentStatus: 'simulated_success',
    notes: 'Testing runtime path'
  };

  const template = getOrderConfirmationTemplate(dummyOrder);
  console.log('Subject:', template.subject);
  console.log('Contains NEW header ("☕ Pre-Order Confirmation"):', template.htmlContent.includes('☕ Pre-Order Confirmation'));
  console.log('Contains NEW card header ("ORDER SUMMARY"):', template.htmlContent.includes('ORDER SUMMARY'));
  console.log('Contains NEW card header ("ITEM DETAILS"):', template.htmlContent.includes('ITEM DETAILS'));
  console.log('Contains NEW card header ("PRICE & TAX BREAKDOWN"):', template.htmlContent.includes('PRICE &amp; TAX BREAKDOWN'));
  console.log('Contains NEW card header ("DELIVERY & CUSTOMER INFORMATION"):', template.htmlContent.includes('DELIVERY &amp; CUSTOMER INFORMATION'));
  console.log('Contains OLD string ("Your order has been successfully received."):', template.htmlContent.includes('Your order has been successfully received.'));

  console.log('\n=== 2. PLACING CONTROLLED LOCAL TEST ORDER ON HTTP://LOCALHOST:5000 ===');
  const payload = {
    fullName: 'Local Order Verification',
    phone: '9876543210',
    email: 'hello@frenchroast.in',
    address: '123 MG Road, Indiranagar',
    pinCode: '560038',
    deliveryArea: 'Bengaluru',
    variant: 'Powder',
    weight: '250g',
    quantity: 1,
    notes: 'Controlled local runtime email test',
    emailOptIn: true
  };

  try {
    const res = await fetch('http://localhost:5000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('Local Server HTTP Status:', res.status);
    console.log('Saved Order Booking ID:', data.data?.bookingId);
    console.log('Brevo Email Sent Status:', data.emailSent);
    console.log('Brevo Message ID:', data.data?.confirmationEmailMessageId);
  } catch (err) {
    console.error('Error placing order:', err.message);
  }
}

verifyLocalRuntime();
