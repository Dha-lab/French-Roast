async function runTestOrder() {
  console.log('--- PLACING 1 CONTROLLED TEST PREORDER FOR EMAIL VERIFICATION ---');

  const payload = {
    fullName: 'Approved Email Tester',
    phone: '9876543210',
    email: 'hello@frenchroast.in',
    address: '456 100ft Road, Indiranagar',
    pinCode: '560038',
    deliveryArea: 'Bengaluru',
    variant: 'Powder',
    weight: '250g',
    quantity: 1,
    notes: 'Please confirm new email template',
    emailOptIn: true
  };

  try {
    const res = await fetch('http://localhost:5000/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('Response Status:', res.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));

    if (data.success && data.data) {
      console.log('\n✓ ORDER CREATION SUCCESSFUL');
      console.log('MongoDB / Saved Order ID:', data.data.bookingId || data.data._id);
      console.log('Email Sent Status:', data.emailSent);
      console.log('Brevo Message ID:', data.data.confirmationEmailMessageId);
      console.log('Order Status:', data.data.status);
      console.log('Customer Email:', data.data.email);
    } else {
      console.error('❌ Order creation failed:', data.message);
    }
  } catch (err) {
    console.error('❌ Network error:', err.message);
  }
}

runTestOrder();
