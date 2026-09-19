import http from 'http';
import https from 'https';

export const sendTransactionalEmail = async ({
  toEmail,
  toName,
  subject,
  htmlContent,
  textContent
}) => {
  let apiKey = (process.env.BREVO_API_KEY || '').trim();
  apiKey = apiKey.replace(/^["']|["']$/g, '').replace(/[\r\n\t]/g, '').trim();

  let senderEmail = (process.env.BREVO_SENDER_EMAIL || '').trim();
  senderEmail = senderEmail.replace(/^["']|["']$/g, '').replace(/[\r\n\t]/g, '').trim();

  let senderName = (process.env.BREVO_SENDER_NAME || 'French Roast').trim();
  senderName = senderName.replace(/^["']|["']$/g, '').replace(/[\r\n\t]/g, '').trim();

  if (!apiKey) {
    return {
      success: false,
      error: 'BREVO_API_KEY environment variable is not configured on the backend.'
    };
  }

  if (!senderEmail) {
    return {
      success: false,
      error: 'BREVO_SENDER_EMAIL environment variable is not configured on the backend.'
    };
  }

  const payload = JSON.stringify({
    sender: {
      name: senderName,
      email: senderEmail
    },
    to: [
      {
        email: toEmail.toLowerCase().trim(),
        name: toName || 'Valued Customer'
      }
    ],
    subject,
    htmlContent,
    textContent
  });

  return new Promise((resolve) => {
    const req = https.request(
      'https://api.brevo.com/v3/smtp/email',
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
              messageId: json?.messageId || `brevo-${Date.now()}`
            });
          } else {
            const errorMsg = json?.message || json?.code || `HTTP ${res.statusCode}: ${responseData}`;
            resolve({
              success: false,
              error: `Brevo API Error: ${errorMsg}`
            });
          }
        });
      }
    );

    req.on('error', (err) => {
      resolve({
        success: false,
        error: `Network Error connecting to Brevo API: ${err.message}`
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Brevo API request timed out (10s)'
      });
    });

    req.write(payload);
    req.end();
  });
};

export const sendOrderConfirmationEmail = async (order) => {
  if (!order || !order.email) {
    return { success: false, error: 'No order or recipient email provided.' };
  }

  // Duplicate email protection
  if (order.confirmationEmailSent) {
    return {
      success: true,
      skipped: true,
      message: 'Confirmation email already sent for this order.'
    };
  }

  try {
    const { getOrderConfirmationTemplate } = await import('./emailTemplates.js');
    const template = getOrderConfirmationTemplate(order);
    const customerName = order.fullName || order.name || 'Valued Customer';

    const result = await sendTransactionalEmail({
      toEmail: order.email,
      toName: customerName,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent
    });

    // Update order delivery status safely if Mongoose document
    if (typeof order.save === 'function') {
      if (result.success) {
        order.confirmationEmailSent = true;
        order.confirmationEmailSentAt = new Date();
        order.confirmationEmailMessageId = result.messageId || null;
        order.confirmationEmailError = null;
      } else {
        order.confirmationEmailSent = false;
        order.confirmationEmailError = result.error || 'Failed to dispatch confirmation email';
      }
      try {
        await order.save();
      } catch (saveErr) {
        console.warn('⚠️ Could not update order email tracking status:', saveErr.message);
      }
    }

    return result;
  } catch (err) {
    console.error('❌ Error executing sendOrderConfirmationEmail:', err.message);
    return {
      success: false,
      error: `Order confirmation email dispatch failed: ${err.message}`
    };
  }
};

