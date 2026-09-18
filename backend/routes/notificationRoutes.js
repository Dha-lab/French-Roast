import express from 'express';
import NotificationSubscriber from '../models/NotificationSubscriber.js';
import { generateUnsubscribeToken } from '../services/emailTemplates.js';

const router = express.Router();

// GET /api/notifications/unsubscribe (Handles email click link)
router.get('/unsubscribe', async (req, res, next) => {
  try {
    const { email, token } = req.query;

    if (!email || !token) {
      return res.status(400).send(renderUnsubscribeHTML('Invalid Request', 'Missing email or token parameters.', false));
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const expectedToken = generateUnsubscribeToken(cleanEmail);

    if (token !== expectedToken) {
      return res.status(403).send(renderUnsubscribeHTML('Verification Failed', 'Invalid or expired unsubscribe link.', false));
    }

    const subscriber = await NotificationSubscriber.findOne({ email: cleanEmail });

    if (subscriber) {
      subscriber.emailOptIn = false;
      await subscriber.save();
    }

    return res.send(renderUnsubscribeHTML('Unsubscribed Successfully', `The email address <strong>${escapeHTML(cleanEmail)}</strong> has been unsubscribed from French Roast pre-order notifications.`, true));
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/unsubscribe (API endpoint)
router.post('/unsubscribe', async (req, res, next) => {
  try {
    const { email, token } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const cleanEmail = String(email).toLowerCase().trim();

    if (token) {
      const expectedToken = generateUnsubscribeToken(cleanEmail);
      if (token !== expectedToken) {
        return res.status(403).json({ success: false, message: 'Invalid unsubscribe token' });
      }
    }

    const subscriber = await NotificationSubscriber.findOne({ email: cleanEmail });
    if (subscriber) {
      subscriber.emailOptIn = false;
      await subscriber.save();
    }

    return res.json({
      success: true,
      message: `Unsubscribed ${cleanEmail} from pre-order notifications.`
    });
  } catch (err) {
    next(err);
  }
});

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function renderUnsubscribeHTML(title, message, isSuccess) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} — French Roast</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { background-color: #070708; color: #f4efe6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background-color: #12100d; border: 1px solid #382e22; border-radius: 16px; padding: 36px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .logo { font-family: Georgia, serif; font-size: 20px; font-weight: bold; color: #d4af37; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 24px; }
    .status-icon { font-size: 42px; margin-bottom: 16px; }
    h1 { font-size: 20px; margin: 0 0 12px 0; color: ${isSuccess ? '#d4af37' : '#f87171'}; }
    p { font-size: 14px; color: #a8a196; line-height: 1.6; margin: 0 0 24px 0; }
    a { display: inline-block; background-color: #1c1712; border: 1px solid #d4af37; color: #d4af37; text-decoration: none; padding: 10px 24px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
    a:hover { background-color: #282018; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">French Roast</div>
    <div class="status-icon">${isSuccess ? '✅' : '⚠️'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/">Return to French Roast Website</a>
  </div>
</body>
</html>`;
}

export default router;
