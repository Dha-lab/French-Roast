import https from 'https';

/**
 * Safely normalizes an Indian mobile phone number to E.164 format (+91XXXXXXXXXX)
 * @param {string} phone 
 * @returns {string|null}
 */
export const normalizeIndianPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return null;

  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+91${digits}`;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  } else if (phone.trim().startsWith('+') && digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
};

/**
 * Sends a transactional SMS via Brevo HTTP API
 * POST https://api.brevo.com/v3/transactionalSMS/sms
 */
export const sendTransactionalSMS = async ({ recipientPhone, senderName, content }) => {
  let apiKey = (process.env.BREVO_API_KEY || '').trim();
  apiKey = apiKey.replace(/^["']|["']$/g, '').replace(/[\r\n\t]/g, '').trim();

  let sender = (senderName || process.env.BREVO_SMS_SENDER || 'FROAST').trim();
  sender = sender.replace(/^["']|["']$/g, '').replace(/[\r\n\t]/g, '').trim();

  if (!apiKey) {
    return {
      success: false,
      error: 'BREVO_API_KEY environment variable is not configured on the backend.'
    };
  }

  if (!sender) {
    return {
      success: false,
      error: 'BREVO_SMS_SENDER environment variable is not configured on the backend.'
    };
  }

  const normalizedPhone = normalizeIndianPhoneNumber(recipientPhone);
  if (!normalizedPhone) {
    return {
      success: false,
      error: `Invalid recipient phone number provided for SMS dispatch: "${recipientPhone}".`
    };
  }

  const payload = JSON.stringify({
    sender,
    recipient: normalizedPhone,
    content,
    type: 'transactional'
  });

  return new Promise((resolve) => {
    const req = https.request(
      'https://api.brevo.com/v3/transactionalSMS/sms',
      {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': apiKey,
          'content-length': Buffer.byteLength(payload)
        },
        timeout: 10000
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(responseData);
          } catch (e) {}

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              messageId: json?.messageId || json?.reference || `brevo-sms-${Date.now()}`
            });
          } else {
            const errorMsg = json?.message || json?.code || `HTTP ${res.statusCode}: ${responseData}`;
            resolve({
              success: false,
              error: `Brevo SMS API Error: ${errorMsg}`
            });
          }
        });
      }
    );

    req.on('error', (err) => {
      resolve({
        success: false,
        error: `Network Error connecting to Brevo SMS API: ${err.message}`
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Brevo SMS API request timed out (10s)'
      });
    });

    req.write(payload);
    req.end();
  });
};

/**
 * Sends order confirmation SMS for a created order
 * Duplicate-safe & non-blocking for order creation
 */
export const sendOrderConfirmationSMS = async (order) => {
  if (!order || !order.phone) {
    return { success: false, error: 'No order or recipient phone number provided.' };
  }

  // Duplicate SMS protection
  if (order.smsConfirmationSent) {
    return {
      success: true,
      skipped: true,
      message: 'Confirmation SMS already sent for this order.'
    };
  }

  try {
    const orderId = order.bookingId || order._id || 'Order';
    const qty = order.quantity || 1;
    const coffeeType = order.variant || order.coffeeType || 'Powder';
    const smsContent = `French Roast: Your order ${orderId} has been confirmed. ${qty} x 250g ${coffeeType}. Thank you for ordering!`;

    const result = await sendTransactionalSMS({
      recipientPhone: order.phone,
      content: smsContent
    });

    // Safely update order tracking status if Mongoose document
    if (typeof order.save === 'function') {
      if (result.success) {
        order.smsConfirmationSent = true;
        order.smsSentAt = new Date();
        order.smsMessageId = result.messageId || null;
        order.smsError = null;
      } else {
        order.smsConfirmationSent = false;
        order.smsError = result.error || 'Failed to dispatch confirmation SMS';
      }
      try {
        await order.save();
      } catch (saveErr) {
        console.warn('⚠️ Could not update order SMS tracking status:', saveErr.message);
      }
    }

    if (!result.success) {
      console.warn(`⚠️ SMS send failed for order ${orderId}: ${result.error}`);
    }

    return result;
  } catch (err) {
    console.error('❌ Error executing sendOrderConfirmationSMS:', err.message);
    return {
      success: false,
      error: `Order confirmation SMS dispatch failed: ${err.message}`
    };
  }
};
