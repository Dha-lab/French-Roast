import crypto from 'crypto';

// Helper to generate a tamper-evident unsubscribe token
export const generateUnsubscribeToken = (email) => {
  const secret = process.env.JWT_SECRET || 'french_roast_unsub_secret_key_2026';
  return crypto.createHmac('sha256', secret).update(email.toLowerCase().trim()).digest('hex').substring(0, 16);
};

export const getPreorderOpenTemplate = ({ name, email, publicSiteUrl }) => {
  const customerName = name || 'Valued Customer';
  const siteUrl = 'https://french-roast.onrender.com/';
  const token = generateUnsubscribeToken(email || '');
  const unsubscribeUrl = `${siteUrl}api/notifications/unsubscribe?email=${encodeURIComponent(email || '')}&token=${token}`;

  const subject = 'French Roast — Pre-Orders Are Now Open ☕';

  const textContent = `Hello ${customerName},

Great news — French Roast pre-orders are now open.

Freshly roasted coffee is now available in:

250g Whole Bean

Available for delivery in Bengaluru.

Pre-orders are limited, so place yours while the batch is open.

PRE-ORDER NOW →
${siteUrl}

Thank you,
French Roast`;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>French Roast — Pre-Orders Are Now Open ☕</title>
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
              
              <p style="color: #f4efe6; margin-bottom: 16px;">Great news — French Roast pre-orders are now open.</p>
              
              <p style="color: #d4ceb8; margin-bottom: 8px;">Freshly roasted coffee is now available in:</p>
              <div style="background-color: #18140f; border: 1px solid #282018; border-radius: 12px; padding: 16px 20px; margin: 12px 0 20px 0;">
                <ul style="margin: 0; padding-left: 20px; color: #f4efe6; line-height: 1.8;">
                  <li><strong>250g Whole Bean</strong></li>
                </ul>
              </div>

              <p style="color: #f4efe6; margin-bottom: 12px;">Available for delivery in Bengaluru.</p>
              
              <p style="color: #ebd49d; font-weight: 600; margin-bottom: 24px;">Pre-orders are limited, so place yours while the batch is open.</p>
            </td>
          </tr>

          <!-- Call to Action Button -->
          <tr>
            <td align="center" style="padding: 0 0 32px 0;">
              <a href="${siteUrl}" target="_blank" style="display: inline-block; background-color: #d4af37; color: #070708; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; text-decoration: none; padding: 14px 32px; border-radius: 30px; border: 1px solid #ebd49d;">PRE-ORDER NOW →</a>
            </td>
          </tr>

          <!-- Sign-off & Footer -->
          <tr>
            <td style="border-top: 1px solid #221c16; padding-top: 20px; font-size: 12px; color: #8c8275; text-align: center;">
              <p style="margin: 0 0 12px 0;">Thank you,<br><strong style="color: #f4efe6;">French Roast</strong></p>
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
  const bookingId = order.bookingId || (order._id ? order._id.toString() : 'FR-PENDING');
  const coffeeType = order.variant || order.coffeeType || 'Whole Bean';
  const packSize = order.weight || order.packSize || '250g';
  const quantity = Math.max(1, Number(order.quantity) || 1);
  const unitPrice = typeof order.unitPrice === 'number' ? order.unitPrice : (coffeeType === 'Whole Bean' ? 599 : 499);

  const orderType = (order.orderType || 'Pre-Order').replace(/^./, c => c.toUpperCase());
  const rawStatus = order.status || 'pending';
  const orderStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);

  const finalTotal = typeof order.finalTotal === 'number' ? order.finalTotal : (typeof order.itemTotal === 'number' ? order.itemTotal : (unitPrice * quantity));
  const gstRate = typeof order.gstRate === 'number' ? order.gstRate : 5;
  const cgstRate = typeof order.cgstRate === 'number' ? order.cgstRate : 2.5;
  const sgstRate = typeof order.sgstRate === 'number' ? order.sgstRate : (gstRate - cgstRate);

  const gstAmount = typeof order.gstAmount === 'number' ? order.gstAmount : (Math.round((finalTotal - (finalTotal / (1 + gstRate / 100))) * 100) / 100);
  const cgstAmount = typeof order.cgstAmount === 'number' ? order.cgstAmount : (Math.round((gstAmount / 2) * 100) / 100);
  const sgstAmount = typeof order.sgstAmount === 'number' ? order.sgstAmount : (Math.round((gstAmount - cgstAmount) * 100) / 100);
  const taxableAmount = Math.round((finalTotal - gstAmount) * 100) / 100;
  const deliveryCharge = typeof order.deliveryCharge === 'number' ? order.deliveryCharge : 0;

  const paymentDisplay = (order.paymentMode === 'test' || !order.paymentMode) && (order.paymentStatus === 'simulated_success' || !order.paymentStatus)
    ? 'TEST PAYMENT — APPROVED'
    : `${(order.paymentMode || 'TEST').toUpperCase()} — ${(order.paymentStatus || 'APPROVED').toUpperCase()}`;

  const customerEmail = order.email || '';
  const customerPhone = order.phone || '';
  const customerAddress = order.address || '';
  const pinCode = order.pinCode || '';
  const deliveryArea = order.deliveryArea || 'Bengaluru';
  const notes = (order.notes || '').trim();

  const chicoryPartText = order.blend && order.blend.chicoryPercentage > 0
    ? ` / ${order.blend.chicoryPercentage}% Chicory (${order.blend.chicoryGrams || 0}g)`
    : (order.blend && order.blend.chicoryGrams ? ` / ${order.blend.chicoryPercentage || 0}% Chicory (${order.blend.chicoryGrams}g)` : '');
  const chicoryTotalText = order.blend && (order.blend.chicoryPercentage > 0 || order.blend.chicoryGrams > 0)
    ? ` / ${order.blend.totalChicoryGrams || ((order.blend.chicoryGrams || 0) * quantity)}g Chicory`
    : '';

  const blendInfoText = order.blend
    ? `\nBlend: ${order.blend.arabicaPercentage}% Arabica (${order.blend.arabicaGrams}g) / ${order.blend.robustaPercentage}% Robusta (${order.blend.robustaGrams}g)${chicoryPartText} per ${order.blend.totalGrams || 250}g pack${quantity > 1 ? ` (Total: ${order.blend.totalArabicaGrams || (order.blend.arabicaGrams * quantity)}g Arabica / ${order.blend.totalRobustaGrams || (order.blend.robustaGrams * quantity)}g Robusta${chicoryTotalText} across ${quantity} packs)` : ''}`
    : '';

  const blendInfoHtml = order.blend
    ? `<tr>
         <td style="color: #a8a196;">Blend:</td>
         <td style="color: #d4af37; font-weight: 600; text-align: right;">${order.blend.arabicaPercentage}% Arabica (${order.blend.arabicaGrams}g) / ${order.blend.robustaPercentage}% Robusta (${order.blend.robustaGrams}g)${chicoryPartText}${quantity > 1 ? `<div style="font-size: 11px; color: #a8a196; margin-top: 2px;">Total: ${order.blend.totalArabicaGrams || (order.blend.arabicaGrams * quantity)}g Arabica / ${order.blend.totalRobustaGrams || (order.blend.robustaGrams * quantity)}g Robusta${chicoryTotalText} across ${quantity} packs</div>` : ''}</td>
       </tr>`
    : '';

  const customerEmailRow = customerEmail ? `
                  <tr>
                    <td style="color: #a8a196; padding: 4px 0;">Email:</td>
                    <td style="color: #f4efe6; text-align: right; padding: 4px 0; word-break: break-all;">${escapeHTML(customerEmail)}</td>
                  </tr>` : '';

  const customerPhoneRow = customerPhone ? `
                  <tr>
                    <td style="color: #a8a196; padding: 4px 0;">Mobile:</td>
                    <td style="color: #f4efe6; text-align: right; padding: 4px 0;">${escapeHTML(customerPhone)}</td>
                  </tr>` : '';

  const notesRow = notes ? `
                  <tr>
                    <td style="color: #a8a196; vertical-align: top; padding: 4px 0;">Notes:</td>
                    <td style="color: #f4efe6; text-align: right; font-style: italic; padding: 4px 0;">${escapeHTML(notes)}</td>
                  </tr>` : '';

  const subject = '☕ French Roast — Pre-Order Confirmation';

  const notesTextBlock = notes ? `\nNotes: ${notes}` : '';

  const textContent = `FRENCH ROAST
ARTISANAL COFFEE ROASTERS
----------------------------------------

Pre-Order Confirmation
Order ID: ${bookingId}

Hello ${customerName},

Thank you for pre-ordering with French Roast. Your order has been received.

ORDER DETAILS
Coffee Type: ${coffeeType}
Pack Size: ${packSize}${blendInfoText}
Quantity: ${quantity}
Unit Price: ₹${unitPrice.toFixed(2)}
Order Type: ${orderType}
Order Status: ${orderStatus}
Payment Status: ${paymentDisplay}

PRICE SUMMARY
Taxable Amount: ₹${taxableAmount.toFixed(2)}
CGST (${cgstRate}%): ₹${cgstAmount.toFixed(2)}
SGST (${sgstRate}%): ₹${sgstAmount.toFixed(2)}
Total GST (${gstRate}%): ₹${gstAmount.toFixed(2)}
Delivery: ${deliveryCharge > 0 ? `₹${deliveryCharge.toFixed(2)}` : 'FREE'}
Final Total: ₹${finalTotal.toFixed(2)}

DELIVERY DETAILS
Customer Name: ${customerName}
${customerEmail ? `Email: ${customerEmail}\n` : ''}${customerPhone ? `Mobile: ${customerPhone}\n` : ''}Delivery Address: ${customerAddress}
PIN Code: ${pinCode}
Delivery Area: ${deliveryArea}${notesTextBlock}

We've received your pre-order and will process it shortly.

Thank you,
French Roast Team
French Roast — Artisanal Coffee Roasters
https://french-roast.onrender.com/`;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>French Roast — Pre-Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070708; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4efe6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #070708; padding: 32px 10px;">
    <tr>
      <td align="center">
        <!-- Single Continuous Email Body Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #12100d; border: 1px solid #382e22; border-radius: 12px; overflow: hidden; padding: 32px;">
          
          <!-- Header Logo / Title -->
          <tr>
            <td align="center" style="padding-bottom: 20px; border-bottom: 1px solid #221c16;">
              <span style="font-family: Georgia, serif; font-size: 22px; font-weight: bold; letter-spacing: 2px; color: #d4af37; text-transform: uppercase;">FRENCH ROAST</span>
              <div style="font-size: 11px; letter-spacing: 1.5px; color: #a8a196; text-transform: uppercase; margin-top: 4px;">Artisanal Coffee Roasters</div>
            </td>
          </tr>

          <!-- Pre-Order Confirmation Title & Order ID -->
          <tr>
            <td style="padding: 24px 0 16px 0;">
              <div style="font-size: 18px; font-weight: bold; color: #d4af37; letter-spacing: 0.5px;">Pre-Order Confirmation</div>
              <div style="font-size: 13px; color: #a8a196; margin-top: 4px;">Order ID: <span style="font-family: monospace; color: #d4af37; font-weight: bold;">${escapeHTML(bookingId)}</span></div>
            </td>
          </tr>

          <!-- Main Greeting -->
          <tr>
            <td style="padding-bottom: 20px; color: #f4efe6; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 6px 0; font-size: 15px; font-weight: 600; color: #f4efe6;">Hello ${escapeHTML(customerName)},</p>
              <p style="margin: 0; color: #d4ceb8;">Thank you for pre-ordering with French Roast. Your order has been received.</p>
            </td>
          </tr>

          <!-- SECTION: ORDER DETAILS -->
          <tr>
            <td style="padding-top: 8px;">
              <div style="font-size: 11px; font-weight: bold; color: #d4af37; text-transform: uppercase; letter-spacing: 1.5px; padding-bottom: 8px; border-bottom: 1px solid #221c16; margin-bottom: 12px;">ORDER DETAILS</div>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px; line-height: 1.8;">
                <tr>
                  <td style="color: #a8a196; padding: 3px 0;">Coffee Type:</td>
                  <td style="color: #f4efe6; font-weight: 600; text-align: right; padding: 3px 0;">${escapeHTML(coffeeType)}</td>
                </tr>
                <tr>
                  <td style="color: #a8a196; padding: 3px 0;">Pack Size:</td>
                  <td style="color: #f4efe6; text-align: right; padding: 3px 0;">${escapeHTML(packSize)}</td>
                </tr>
                ${blendInfoHtml}
                <tr>
                  <td style="color: #a8a196; padding: 3px 0;">Quantity:</td>
                  <td style="color: #f4efe6; font-weight: bold; text-align: right; padding: 3px 0;">${quantity}</td>
                </tr>
                <tr>
                  <td style="color: #a8a196; padding: 3px 0;">Unit Price:</td>
                  <td style="color: #d4af37; font-weight: bold; text-align: right; padding: 3px 0;">₹${unitPrice.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="color: #a8a196; padding: 3px 0;">Order Type:</td>
                  <td style="color: #f4efe6; font-weight: 600; text-align: right; padding: 3px 0;">${escapeHTML(orderType)}</td>
                </tr>
                <tr>
                  <td style="color: #a8a196; padding: 3px 0;">Order Status:</td>
                  <td style="color: #63a87a; font-weight: bold; text-align: right; padding: 3px 0;">${escapeHTML(orderStatus)}</td>
                </tr>
                <tr>
                  <td style="color: #a8a196; padding: 3px 0;">Payment Status:</td>
                  <td style="color: #d4af37; font-weight: bold; font-family: monospace; font-size: 12px; text-align: right; padding: 3px 0;">${escapeHTML(paymentDisplay)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Subtle Divider -->
          <tr>
            <td style="padding: 16px 0;">
              <div style="height: 1px; background-color: #221c16;"></div>
            </td>
          </tr>

          <!-- SECTION: PRICE SUMMARY -->
          <tr>
            <td>
              <div style="font-size: 11px; font-weight: bold; color: #d4af37; text-transform: uppercase; letter-spacing: 1.5px; padding-bottom: 8px; border-bottom: 1px solid #221c16; margin-bottom: 12px;">PRICE SUMMARY</div>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px; line-height: 1.8;">
                <tr>
                  <td style="color: #a8a196; padding: 3px 0;">Taxable Amount:</td>
                  <td style="color: #f4efe6; font-weight: 600; text-align: right; padding: 3px 0;">₹${taxableAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="color: #8c8275; padding: 3px 0;">CGST (${cgstRate}%):</td>
                  <td style="color: #a8a196; text-align: right; padding: 3px 0;">₹${cgstAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="color: #8c8275; padding: 3px 0;">SGST (${sgstRate}%):</td>
                  <td style="color: #a8a196; text-align: right; padding: 3px 0;">₹${sgstAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="color: #a8a196; padding: 3px 0;">Total GST (${gstRate}%):</td>
                  <td style="color: #f4efe6; text-align: right; padding: 3px 0;">₹${gstAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="color: #a8a196; padding: 3px 0;">Delivery:</td>
                  <td style="color: #63a87a; font-weight: bold; text-align: right; padding: 3px 0;">${deliveryCharge > 0 ? `₹${deliveryCharge.toFixed(2)}` : 'FREE'}</td>
                </tr>
                <tr style="border-top: 1px solid #221c16;">
                  <td style="color: #f4efe6; font-weight: bold; padding: 10px 0 2px 0;">Final Total:</td>
                  <td style="color: #d4af37; font-weight: bold; font-size: 16px; text-align: right; padding: 10px 0 2px 0;">₹${finalTotal.toFixed(2)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Subtle Divider -->
          <tr>
            <td style="padding: 16px 0;">
              <div style="height: 1px; background-color: #221c16;"></div>
            </td>
          </tr>

          <!-- SECTION: DELIVERY DETAILS -->
          <tr>
            <td>
              <div style="font-size: 11px; font-weight: bold; color: #d4af37; text-transform: uppercase; letter-spacing: 1.5px; padding-bottom: 8px; border-bottom: 1px solid #221c16; margin-bottom: 12px;">DELIVERY DETAILS</div>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px; line-height: 1.8;">
                <tr>
                  <td style="color: #a8a196; padding: 3px 0;">Customer Name:</td>
                  <td style="color: #f4efe6; font-weight: 600; text-align: right; padding: 3px 0;">${escapeHTML(customerName)}</td>
                </tr>
                ${customerEmailRow}
                ${customerPhoneRow}
                <tr>
                  <td style="color: #a8a196; vertical-align: top; padding: 3px 0;">Delivery Address:</td>
                  <td style="color: #f4efe6; text-align: right; max-width: 260px; padding: 3px 0; word-break: break-word;">${escapeHTML(customerAddress)}</td>
                </tr>
                <tr>
                  <td style="color: #a8a196; padding: 3px 0;">PIN Code:</td>
                  <td style="color: #d4af37; font-weight: bold; font-family: monospace; text-align: right; padding: 3px 0;">${escapeHTML(pinCode)}</td>
                </tr>
                <tr>
                  <td style="color: #a8a196; padding: 3px 0;">Delivery Area:</td>
                  <td style="color: #f4efe6; font-weight: 600; text-align: right; padding: 3px 0;">${escapeHTML(deliveryArea)}</td>
                </tr>
                ${notesRow}
              </table>
            </td>
          </tr>

          <!-- Informational Notice -->
          <tr>
            <td style="padding: 24px 0 16px 0; color: #d4ceb8; font-size: 13px; line-height: 1.6; text-align: center; border-top: 1px solid #221c16;">
              <p style="margin: 0 0 4px 0; color: #f4efe6;">We've received your pre-order and will process it shortly.</p>
              <p style="margin: 0; font-size: 12px; color: #8c8275;">Deliveries are currently fulfilled exclusively within Bengaluru.</p>
            </td>
          </tr>

          <!-- Sign-off & Footer -->
          <tr>
            <td style="padding-top: 16px; font-size: 12px; color: #8c8275; text-align: center; border-top: 1px solid #1a1612;">
              <p style="margin: 0 0 4px 0;">Thank you,<br><strong style="color: #f4efe6;">French Roast Team</strong></p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #6e6457;">
                <a href="https://french-roast.onrender.com/" style="color: #d4af37; text-decoration: underline;">French Roast — Artisanal Coffee Roasters</a>
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

export const getWaitingRestockTemplate = (order) => {
  const customerName = order.fullName || order.name || 'Valued Customer';
  const bookingId = order.bookingId || order._id || 'FR-PENDING';
  const coffeeType = order.variant || order.coffeeType || 'Whole Bean';
  const packSize = order.weight || order.packSize || '250g';
  const quantity = order.quantity || 1;
  const siteUrl = 'https://french-roast.onrender.com/';

  const subject = '☕ French Roast — Your Coffee Pre-Order is Ready!';

  const textContent = `Hello ${customerName},

Great news — your waiting pre-order for French Roast coffee is ready!

--- WAITING PRE-ORDER DETAILS ---
Booking ID: ${bookingId}
Coffee Type: ${coffeeType}
Pack Size: ${packSize}
Quantity: ${quantity}

Your selected coffee variant (${coffeeType}, ${packSize}) is now in stock and ready for delivery in Bengaluru.

Thank you for your patience while we roasted this batch!

French Roast Team
${siteUrl}`;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>French Roast — Your Coffee Pre-Order is Ready!</title>
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

          <!-- Main Greeting & Announcement -->
          <tr>
            <td style="padding: 28px 0 16px 0; color: #f4efe6; font-size: 15px; line-height: 1.6;">
              <p style="margin-top: 0; font-size: 18px; font-weight: 600; color: #d4af37;">Hello ${escapeHTML(customerName)},</p>
              <p style="color: #f4efe6; margin-bottom: 12px;">Great news — your waiting pre-order for French Roast coffee is now ready!</p>
              <p style="color: #d4ceb8; margin-bottom: 0;">Our roasters have completed fresh small-batch roasting and your requested item is in stock.</p>
            </td>
          </tr>

          <!-- Order Summary Card -->
          <tr>
            <td style="padding-bottom: 24px;">
              <div style="background-color: #18140f; border: 1px solid #282018; border-radius: 12px; padding: 20px;">
                <div style="font-size: 11px; font-weight: bold; color: #d4af37; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 14px; border-bottom: 1px solid #282018; padding-bottom: 8px;">Reserved Pre-Order</div>
                
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px; line-height: 1.8;">
                  <tr>
                    <td style="color: #a8a196;">Booking ID:</td>
                    <td style="color: #d4af37; font-weight: bold; font-family: monospace; font-size: 14px; text-align: right;">${escapeHTML(bookingId)}</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">Coffee Type:</td>
                    <td style="color: #f4efe6; font-weight: 600; text-align: right;">${escapeHTML(coffeeType)}</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">Pack Size:</td>
                    <td style="color: #f4efe6; text-align: right;">${escapeHTML(packSize)}</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">Quantity:</td>
                    <td style="color: #f4efe6; font-weight: bold; text-align: right;">${quantity} Pack(s)</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">Availability:</td>
                    <td style="color: #63a87a; font-weight: bold; text-align: right;">✓ In Stock</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Call to Action Button -->
          <tr>
            <td align="center" style="padding: 0 0 24px 0;">
              <a href="${siteUrl}" target="_blank" style="display: inline-block; background-color: #d4af37; color: #070708; font-weight: bold; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; text-decoration: none; padding: 14px 32px; border-radius: 30px; border: 1px solid #ebd49d;">VISIT FRENCH ROAST →</a>
            </td>
          </tr>

          <!-- Sign-off & Footer -->
          <tr>
            <td style="border-top: 1px solid #221c16; padding-top: 20px; font-size: 12px; color: #8c8275; text-align: center;">
              <p style="margin: 0;">Thank you for your patience,<br><strong style="color: #f4efe6;">French Roast Team</strong></p>
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

export const getWaitingPreorderConfirmationTemplate = (order) => {
  const customerName = order.fullName || order.name || 'Valued Customer';
  const bookingId = order.bookingId || order._id || 'FR-PENDING';
  const coffeeType = order.variant || order.coffeeType || 'Whole Bean';
  const packSize = order.weight || order.packSize || '250g';
  const quantity = order.quantity || 1;
  const siteUrl = 'https://french-roast.onrender.com/';
  const waitingChicoryText = order.blend && (order.blend.chicoryPercentage > 0 || order.blend.chicoryGrams > 0)
    ? ` / ${order.blend.chicoryPercentage || 0}% Chicory (${order.blend.chicoryGrams || 0}g)`
    : '';

  const waitingBlendText = order.blend
    ? `\nBlend:\n${order.blend.arabicaPercentage}% Arabica (${order.blend.arabicaGrams}g) / ${order.blend.robustaPercentage}% Robusta (${order.blend.robustaGrams}g)${waitingChicoryText} per pack\n`
    : '';

  const waitingBlendHtml = order.blend
    ? `<tr>
         <td style="color: #a8a196;">Blend:</td>
         <td style="color: #d4af37; font-weight: 600; text-align: right;">${order.blend.arabicaPercentage}% Arabica (${order.blend.arabicaGrams}g) / ${order.blend.robustaPercentage}% Robusta (${order.blend.robustaGrams}g)${waitingChicoryText}</td>
       </tr>`
    : '';

  const subject = 'French Roast — Your Waiting Pre-Order Has Been Received';

  const textContent = `Your Waiting Pre-Order Has Been Received

Thank you for your interest in French Roast.

Your request has been successfully added to our waiting list.

Coffee:
${coffeeType}

Pack:
${packSize}${waitingBlendText}
Quantity:
${quantity}

Waiting Reference:
${bookingId}

Status:
Waiting for Stock

No payment has been taken at this stage.

We will notify you when the coffee becomes available.

French Roast
Coffee for a Brighter You`;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>French Roast — Your Waiting Pre-Order Has Been Received</title>
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

          <!-- Main Greeting & Announcement -->
          <tr>
            <td style="padding: 28px 0 16px 0; color: #f4efe6; font-size: 15px; line-height: 1.6;">
              <div style="display: inline-block; padding: 4px 12px; border-radius: 20px; background-color: rgba(209, 154, 69, 0.15); border: 1px solid rgba(209, 154, 69, 0.4); color: #d4af37; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">WAITING LIST CONFIRMATION</div>
              <p style="margin-top: 0; font-size: 18px; font-weight: 600; color: #f4efe6;">Hello ${escapeHTML(customerName)},</p>
              <p style="color: #f4efe6; margin-bottom: 12px;">Thank you for your interest in French Roast.</p>
              <p style="color: #d4ceb8; margin-bottom: 0;">Your request has been successfully added to our waiting list.</p>
            </td>
          </tr>

          <!-- Waiting Pre-Order Details Card -->
          <tr>
            <td style="padding-bottom: 20px;">
              <div style="background-color: #18140f; border: 1px solid #282018; border-radius: 12px; padding: 20px;">
                <div style="font-size: 11px; font-weight: bold; color: #d4af37; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 14px; border-bottom: 1px solid #282018; padding-bottom: 8px;">WAITING PRE-ORDER DETAILS</div>
                
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px; line-height: 1.8;">
                  <tr>
                    <td style="color: #a8a196;">Coffee:</td>
                    <td style="color: #f4efe6; font-weight: 600; text-align: right;">${escapeHTML(coffeeType)}</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">Pack Size:</td>
                    <td style="color: #f4efe6; text-align: right;">${escapeHTML(packSize)}</td>
                  </tr>
                  ${waitingBlendHtml}
                  <tr>
                    <td style="color: #a8a196;">Quantity:</td>
                    <td style="color: #f4efe6; font-weight: bold; text-align: right;">${quantity} Pack(s)</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">Waiting Reference:</td>
                    <td style="color: #d4af37; font-weight: bold; font-family: monospace; font-size: 14px; text-align: right;">${escapeHTML(bookingId)}</td>
                  </tr>
                  <tr>
                    <td style="color: #a8a196;">Status:</td>
                    <td style="color: #e0bd63; font-weight: bold; text-align: right;">Waiting for Stock</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Payment Notice Card (Explicit "No payment has been taken") -->
          <tr>
            <td style="padding-bottom: 24px;">
              <div style="background-color: #15120f; border: 1px solid #3d3326; border-radius: 12px; padding: 16px 20px; text-align: center;">
                <p style="margin: 0 0 6px 0; color: #d4af37; font-size: 13px; font-weight: 600;">No payment has been taken at this stage.</p>
                <p style="margin: 0; color: #a8a196; font-size: 12px; line-height: 1.5;">We will notify you when the coffee becomes available.</p>
              </div>
            </td>
          </tr>

          <!-- Sign-off & Footer -->
          <tr>
            <td style="border-top: 1px solid #221c16; padding-top: 20px; font-size: 12px; color: #8c8275; text-align: center;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #f4efe6;">French Roast</p>
              <p style="margin: 0; font-style: italic; color: #a8a196;">Coffee for a Brighter You</p>
              <p style="margin: 16px 0 0 0; font-size: 11px; color: #6e6457;">
                <a href="${siteUrl}" style="color: #d4af37; text-decoration: underline;">French Roast — Artisanal Coffee Roasters</a>
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

function escapeHTML(str) {
  return String(str || '').replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

