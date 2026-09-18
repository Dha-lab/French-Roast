import crypto from 'crypto';

// Helper to generate a tamper-evident unsubscribe token
export const generateUnsubscribeToken = (email) => {
  const secret = process.env.JWT_SECRET || 'french_roast_unsub_secret_key_2026';
  return crypto.createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex').substring(0, 16);
};

export const getPreorderOpenTemplate = ({ name, email, publicSiteUrl }) => {
  const customerName = name || 'Valued Customer';
  const siteUrl = (publicSiteUrl || process.env.PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const token = generateUnsubscribeToken(email);
  const unsubscribeUrl = `${siteUrl}/api/notifications/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;

  const subject = '☕ French Roast Pre-Orders Are Open';

  const textContent = `Hello ${customerName},

Fresh French Roast stock is now available.

Pre-orders are now open.

Available coffee:
• Powder
• Whole Bean

Pack sizes:
• 250g

Place your pre-order through the French Roast website: ${siteUrl}

Unsubscribe from notifications: ${unsubscribeUrl}

Thank you,
French Roast`;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>French Roast Pre-Orders Are Open</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070708; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4efe6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #070708; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #12100d; border: 1px solid #382e22; border-radius: 16px; overflow: hidden; padding: 32px;">
          
          <!-- Header Logo / Title -->
          <tr>
            <td align="center" style="padding-bottom: 24px; border-bottom: 1px solid #221c16;">
              <span style="font-family: Georgia, serif; font-size: 22px; font-weight: bold; letter-spacing: 2px; color: #d4af37; text-transform: uppercase;">FRENCH ROAST</span>
              <div style="font-size: 11px; letter-spacing: 1.5px; color: #a8a196; text-transform: uppercase; margin-top: 4px;">Artisanal Coffee Roasters</div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 28px 0; color: #f4efe6; font-size: 15px; line-height: 1.6;">
              <p style="margin-top: 0; font-size: 16px; font-weight: 600; color: #f4efe6;">Hello ${customerName},</p>
              
              <p style="color: #d4ceb8;">Fresh French Roast stock is now available.</p>
              <p style="color: #ebd49d; font-weight: bold; font-size: 17px; margin: 20px 0 10px 0;">Pre-orders are now open.</p>

              <div style="background-color: #18140f; border: 1px solid #282018; border-radius: 12px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #d4af37; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Available Variants:</p>
                <ul style="margin: 0; padding-left: 20px; color: #f4efe6;">
                  <li style="margin-bottom: 6px;">Powder (Fine Ground)</li>
                  <li style="margin-bottom: 6px;">Whole Bean</li>
                </ul>
                <p style="margin: 14px 0 6px 0; font-weight: bold; color: #d4af37; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Pack Sizes:</p>
                <ul style="margin: 0; padding-left: 20px; color: #f4efe6;">
                  <li>250g</li>
                </ul>
              </div>

              <p style="color: #a8a196; font-size: 14px;">Place your pre-order through the French Roast website to reserve your freshly roasted batch.</p>
            </td>
          </tr>

          <!-- Call to Action Button -->
          <tr>
            <td align="center" style="padding: 10px 0 30px 0;">
              <a href="${siteUrl}" target="_blank" style="display: inline-block; background-color: #d4af37; color: #070708; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; text-decoration: none; padding: 14px 32px; border-radius: 30px; border: 1px solid #ebd49d;">PRE-ORDER NOW →</a>
            </td>
          </tr>

          <!-- Sign-off & Footer -->
          <tr>
            <td style="border-top: 1px solid #221c16; pt-20; padding-top: 20px; font-size: 12px; color: #8c8275; text-align: center;">
              <p style="margin: 0 0 12px 0;">Thank you,<br><strong style="color: #f4efe6;">French Roast Team</strong></p>
              <p style="margin: 16px 0 0 0; font-size: 11px; color: #6e6457;">
                You received this email because you opted in to French Roast pre-order notifications.<br>
                <a href="${unsubscribeUrl}" style="color: #a8a196; text-decoration: underline;">Unsubscribe from notifications</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, textContent, htmlContent };
};

export const getOrderConfirmationTemplate = (order) => {
  const customerName = order.fullName || order.name || 'Valued Customer';
  const bookingId = order.bookingId || order._id || 'FR-PENDING';
  const coffeeType = order.variant || order.coffeeType || 'Powder';
  const packSize = order.weight || order.packSize || '250g';
  const quantity = order.quantity || 1;
  const customerEmail = order.email || '';
  const customerPhone = order.phone || '';
  const customerAddress = order.address || '';
  const pinCode = order.pinCode || '';
  const deliveryArea = order.deliveryArea || 'Bengaluru';
  const notes = (order.notes || '').trim();

  const subject = '☕ French Roast — Pre-Order Confirmation';

  const notesTextBlock = notes ? `\nNotes: ${notes}` : '';
  const notesHtmlBlock = notes ? `
                <tr style="border-top: 1px dashed #282018;">
                  <td style="padding: 8px 0; color: #a8a196;">Notes:</td>
                  <td style="padding: 8px 0; color: #f4efe6; text-align: right; font-style: italic;">${escapeHTML(notes)}</td>
                </tr>` : '';

  const textContent = `French Roast

Thank you for your pre-order.
Your order has been successfully received.

--- ORDER DETAILS ---
Order ID: ${bookingId}
Customer Name: ${customerName}
Coffee Type: ${coffeeType}
Pack Size: ${packSize}
Quantity: ${quantity}
Order Type: Pre-Order
Status: Pending

--- CUSTOMER & DELIVERY DETAILS ---
Email: ${customerEmail}
Mobile: ${customerPhone}
Delivery Address: ${customerAddress}
PIN Code: ${pinCode}
Delivery Area: ${deliveryArea}${notesTextBlock}

We've received your pre-order and will process it shortly.
Deliveries are currently fulfilled exclusively within Bengaluru.

Thank you,
French Roast Team`;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>French Roast — Pre-Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070708; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4efe6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #070708; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #12100d; border: 1px solid #382e22; border-radius: 16px; overflow: hidden; padding: 32px;">
          
          <!-- Header Logo / Title -->
          <tr>
            <td align="center" style="padding-bottom: 24px; border-bottom: 1px solid #221c16;">
              <span style="font-family: Georgia, serif; font-size: 22px; font-weight: bold; letter-spacing: 2px; color: #d4af37; text-transform: uppercase;">FRENCH ROAST</span>
              <div style="font-size: 11px; letter-spacing: 1.5px; color: #a8a196; text-transform: uppercase; margin-top: 4px;">Artisanal Coffee Roasters</div>
            </td>
          </tr>

          <!-- Main Greeting -->
          <tr>
            <td style="padding: 28px 0 16px 0; color: #f4efe6; font-size: 15px; line-height: 1.6;">
              <p style="margin-top: 0; font-size: 18px; font-weight: 600; color: #d4af37;">Thank you for your pre-order.</p>
              <p style="color: #f4efe6; margin-bottom: 0;">Your order has been successfully received.</p>
            </td>
          </tr>

          <!-- Order Summary Card -->
          <tr>
            <td style="padding-bottom: 24px;">
              <div style="background-color: #18140f; border: 1px solid #282018; border-radius: 12px; padding: 20px;">
                <div style="font-size: 11px; font-weight: bold; color: #d4af37; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 14px; border-bottom: 1px solid #282018; padding-bottom: 8px;">Order Details</div>
                
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px; line-height: 1.8;">
                  <tr>
                    <td style="color: #a8a196;">Order ID:</td>
                    <td style="color: #d4af37; font-weight: bold; font-family: monospace; font-size: 14px; text-align: right;">${escapeHTML(bookingId)}</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">Customer Name:</td>
                    <td style="color: #f4efe6; font-weight: 600; text-align: right;">${escapeHTML(customerName)}</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">Coffee Type:</td>
                    <td style="color: #f4efe6; text-align: right;">${escapeHTML(coffeeType)}</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">Pack Size:</td>
                    <td style="color: #f4efe6; text-align: right;">${escapeHTML(packSize)}</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">Quantity:</td>
                    <td style="color: #f4efe6; font-weight: bold; text-align: right;">${quantity}</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">Order Type:</td>
                    <td style="color: #f4efe6; text-align: right;">Pre-Order</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">Status:</td>
                    <td style="color: #ebd49d; font-weight: 600; text-align: right;">Pending</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Customer & Delivery Details Card -->
          <tr>
            <td style="padding-bottom: 24px;">
              <div style="background-color: #18140f; border: 1px solid #282018; border-radius: 12px; padding: 20px;">
                <div style="font-size: 11px; font-weight: bold; color: #d4af37; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 14px; border-bottom: 1px solid #282018; padding-bottom: 8px;">Customer &amp; Delivery Details</div>
                
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px; line-height: 1.8;">
                  <tr>
                    <td style="color: #a8a196;">Email:</td>
                    <td style="color: #f4efe6; text-align: right;">${escapeHTML(customerEmail)}</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">Mobile:</td>
                    <td style="color: #f4efe6; text-align: right;">${escapeHTML(customerPhone)}</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196; vertical-align: top;">Delivery Address:</td>
                    <td style="color: #f4efe6; text-align: right; max-width: 250px;">${escapeHTML(customerAddress)}</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">PIN Code:</td>
                    <td style="color: #d4af37; font-weight: bold; font-family: monospace; text-align: right;">${escapeHTML(pinCode)}</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">Delivery Area:</td>
                    <td style="color: #f4efe6; font-weight: 600; text-align: right;">${escapeHTML(deliveryArea)}</td>
                  </tr>${notesHtmlBlock}
                </table>
              </div>
            </td>
          </tr>

          <!-- Informational Notice -->
          <tr>
            <td style="padding: 12px 0 24px 0; color: #a8a196; font-size: 13px; line-height: 1.6; text-align: center;">
              <p style="margin: 0 0 6px 0; color: #f4efe6;">We've received your pre-order and will process it shortly.</p>
              <p style="margin: 0; font-size: 12px; color: #8c8275;">Deliveries are currently fulfilled exclusively within Bengaluru.</p>
            </td>
          </tr>

          <!-- Sign-off & Footer -->
          <tr>
            <td style="border-top: 1px solid #221c16; padding-top: 20px; font-size: 12px; color: #8c8275; text-align: center;">
              <p style="margin: 0;">Thank you,<br><strong style="color: #f4efe6;">French Roast Team</strong></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, textContent, htmlContent };
};

function escapeHTML(str) {
  return String(str || '').replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

