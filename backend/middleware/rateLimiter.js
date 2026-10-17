import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // max 30 requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});

// Configurable Order Creation Rate Limiter (Public Storefront Pre-Orders)
// Protects inventory reservation and SMS/Email transactional quotas from automation
export const orderLimiter = rateLimit({
  windowMs: Number(process.env.ORDER_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
  max: Number(process.env.ORDER_RATE_LIMIT_MAX) || 10, // 10 order creation attempts per IP default
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many pre-order requests from this IP address. Please wait a few minutes before trying again or contact customer support.'
  }
});

