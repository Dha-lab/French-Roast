import express from 'express';
import {
  loginStep1,
  verify2FA,
  refreshToken,
  logout,
  setup2FA,
  enable2FA,
  disable2FA,
  regenerateRecoveryCodes,
  changePassword,
  getAuditLogs,
  getNotificationSubscribersCount,
  getNotificationSubscribers,
  triggerPreorderNotification
} from '../controllers/adminController.js';
import { protectAdmin } from '../middleware/authMiddleware.js';
import { loginLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public Auth Endpoints (Rate Limited)
router.post('/login', loginLimiter, loginStep1);
router.post('/verify-2fa', loginLimiter, verify2FA);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

// Protected Admin Endpoints
router.post('/setup-2fa', protectAdmin, setup2FA);
router.post('/enable-2fa', protectAdmin, enable2FA);
router.post('/disable-2fa', protectAdmin, disable2FA);
router.post('/regenerate-recovery-codes', protectAdmin, regenerateRecoveryCodes);
router.post('/change-password', protectAdmin, changePassword);
router.get('/audit-logs', protectAdmin, getAuditLogs);
router.get('/notifications/subscribers-count', protectAdmin, getNotificationSubscribersCount);
router.get('/notifications/subscribers', protectAdmin, getNotificationSubscribers);
router.post('/notifications/preorder-open', protectAdmin, triggerPreorderNotification);

export default router;
