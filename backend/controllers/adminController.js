import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { generateSecret, generateURI, verify as verifyTOTP } from 'otplib';
import QRCode from 'qrcode';
import Admin from '../models/Admin.js';
import RefreshToken from '../models/RefreshToken.js';
import AuditLog from '../models/AuditLog.js';
import NotificationSubscriber from '../models/NotificationSubscriber.js';
import Order from '../models/Order.js';
import NotificationLog from '../models/NotificationLog.js';
import { sendTransactionalEmail } from '../services/brevoService.js';
import { getPreorderOpenTemplate } from '../services/emailTemplates.js';
import { validatePassword } from '../utils/passwordPolicy.js';
import { logAuditEvent } from '../utils/auditLogger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'french_roast_jwt_secret_key_2026_super_secure_auth_token_hash_89123';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

// Helpers
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateAccessToken = (admin) => {
  return jwt.sign(
    { id: admin._id, username: admin.username, role: admin.role },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

const createAndSetRefreshToken = async (res, adminId) => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    tokenHash,
    adminId,
    expiresAt
  });

  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', rawToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    expires: expiresAt,
    path: '/api/admin'
  });

  return rawToken;
};

// 1. LOGIN STEP 1 (Username + Password)
export const loginStep1 = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const admin = await Admin.findOne({ username: String(username).trim().toLowerCase() })
      .select('+passwordHash +twoFactorSecret');

    if (!admin) {
      await logAuditEvent({ username, action: 'LOGIN_FAILED', req, details: { reason: 'User not found' } });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Account Lockout check
    if (admin.isLocked()) {
      await logAuditEvent({ adminId: admin._id, username: admin.username, action: 'LOGIN_LOCKED', req });
      return res.status(401).json({
        success: false,
        message: 'Account locked due to repeated failed login attempts. Please try again later.'
      });
    }

    if (!admin.isActive) {
      await logAuditEvent({ adminId: admin._id, username: admin.username, action: 'LOGIN_DISABLED', req });
      return res.status(403).json({
        success: false,
        message: 'Account disabled. Please contact system administrator.'
      });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      admin.failedLoginAttempts += 1;
      if (admin.failedLoginAttempts >= 5) {
        admin.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      }
      await admin.save();
      await logAuditEvent({ adminId: admin._id, username: admin.username, action: 'LOGIN_FAILED', req });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Step 1 Success
    if (admin.twoFactorEnabled) {
      const mfaTicket = jwt.sign(
        { id: admin._id, scope: '2fa_required' },
        JWT_SECRET,
        { expiresIn: '5m' }
      );
      await logAuditEvent({ adminId: admin._id, username: admin.username, action: 'LOGIN_STEP1_SUCCESS', req });
      return res.json({
        success: true,
        require2FA: true,
        mfaTicket,
        message: 'Two-factor authentication code required'
      });
    }

    // 2FA not enabled
    admin.failedLoginAttempts = 0;
    admin.lockedUntil = null;
    admin.lastLoginAt = new Date();
    await admin.save();

    const accessToken = generateAccessToken(admin);
    await createAndSetRefreshToken(res, admin._id);

    await logAuditEvent({ adminId: admin._id, username: admin.username, action: 'LOGIN_SUCCESS', req });

    return res.json({
      success: true,
      require2FA: false,
      accessToken,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        twoFactorEnabled: false
      }
    });
  } catch (error) {
    next(error);
  }
};

// 2. VERIFY 2FA / RECOVERY CODE (STEP 2)
export const verify2FA = async (req, res, next) => {
  try {
    const { mfaTicket, code } = req.body;

    if (!mfaTicket || !code) {
      return res.status(400).json({
        success: false,
        message: 'Authentication ticket and 2FA code are required'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(mfaTicket, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: '2FA session expired or invalid. Please log in again.'
      });
    }

    if (decoded.scope !== '2fa_required') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication scope'
      });
    }

    const admin = await Admin.findById(decoded.id).select('+twoFactorSecret +recoveryCodes');
    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account not found or disabled'
      });
    }

    const cleanCode = String(code).trim().replace(/[\s-]/g, '').toUpperCase();
    let is2FAValid = false;
    let usedRecoveryCode = false;

    if (cleanCode.length === 6 && /^\d+$/.test(cleanCode)) {
      // TOTP Code
      if (admin.twoFactorSecret) {
        const verification = await verifyTOTP({ token: cleanCode, secret: admin.twoFactorSecret });
        is2FAValid = !!verification.valid;
      }
    } else {
      // One-time Recovery Code
      const inputHash = hashToken(cleanCode);
      const codeIndex = admin.recoveryCodes.findIndex(rc => rc.codeHash === inputHash && !rc.used);
      if (codeIndex !== -1) {
        is2FAValid = true;
        usedRecoveryCode = true;
        admin.recoveryCodes[codeIndex].used = true;
        admin.recoveryCodes[codeIndex].usedAt = new Date();
      }
    }

    if (!is2FAValid) {
      await logAuditEvent({ adminId: admin._id, username: admin.username, action: '2FA_FAILED', req });
      return res.status(401).json({
        success: false,
        message: 'Invalid 2FA code or recovery code'
      });
    }

    admin.failedLoginAttempts = 0;
    admin.lockedUntil = null;
    admin.lastLoginAt = new Date();
    await admin.save();

    const accessToken = generateAccessToken(admin);
    await createAndSetRefreshToken(res, admin._id);

    await logAuditEvent({
      adminId: admin._id,
      username: admin.username,
      action: usedRecoveryCode ? 'RECOVERY_CODE_USED' : '2FA_SUCCESS',
      req
    });

    return res.json({
      success: true,
      accessToken,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        twoFactorEnabled: admin.twoFactorEnabled
      }
    });
  } catch (error) {
    next(error);
  }
};

// 3. REFRESH ACCESS TOKEN
export const refreshToken = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken || req.headers['x-refresh-token'];
    if (!rawToken) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token provided'
      });
    }

    const currentHash = hashToken(rawToken);
    const storedToken = await RefreshToken.findOne({ tokenHash: currentHash });

    if (!storedToken || storedToken.revoked || storedToken.isExpired()) {
      res.clearCookie('refreshToken', { path: '/api/admin' });
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired or revoked'
      });
    }

    const admin = await Admin.findById(storedToken.adminId);
    if (!admin || !admin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account not active'
      });
    }

    // Token Rotation
    const newRawToken = crypto.randomBytes(40).toString('hex');
    const newHash = hashToken(newRawToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    storedToken.revoked = true;
    storedToken.replacedByTokenHash = newHash;
    await storedToken.save();

    await RefreshToken.create({
      tokenHash: newHash,
      adminId: admin._id,
      expiresAt
    });

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', newRawToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      expires: expiresAt,
      path: '/api/admin'
    });

    const newAccessToken = generateAccessToken(admin);

    return res.json({
      success: true,
      accessToken
    });
  } catch (error) {
    next(error);
  }
};

// 4. LOGOUT
export const logout = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.refreshToken || req.headers['x-refresh-token'];
    if (rawToken) {
      const currentHash = hashToken(rawToken);
      await RefreshToken.updateOne({ tokenHash: currentHash }, { revoked: true });
    }

    if (req.admin) {
      await logAuditEvent({ adminId: req.admin._id, username: req.admin.username, action: 'LOGOUT', req });
    }

    res.clearCookie('refreshToken', { path: '/api/admin' });
    return res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// 5. SETUP 2FA (Generates QR Code & Secret)
export const setup2FA = async (req, res, next) => {
  try {
    const admin = req.admin;
    const secret = generateSecret();
    const otpauth = generateURI({ secret, label: admin.username, issuer: 'FrenchRoastAdmin' });
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Save secret temporarily
    admin.twoFactorSecret = secret;
    await admin.save();

    await logAuditEvent({ adminId: admin._id, username: admin.username, action: '2FA_SETUP_INITIATED', req });

    return res.json({
      success: true,
      secret,
      qrCodeUrl
    });
  } catch (error) {
    next(error);
  }
};

// 6. ENABLE 2FA (Verifies QR Code scan & returns recovery codes)
export const enable2FA = async (req, res, next) => {
  try {
    const { code } = req.body;
    const admin = await Admin.findById(req.admin._id).select('+twoFactorSecret +recoveryCodes');

    if (!admin.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: '2FA setup was not initiated'
      });
    }

    const verification = await verifyTOTP({ token: String(code).trim(), secret: admin.twoFactorSecret });
    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 2FA verification code'
      });
    }

    // Generate 8 One-Time Recovery Codes (e.g. XXXX-XXXX)
    const rawRecoveryCodes = [];
    const hashedCodes = [];

    for (let i = 0; i < 8; i++) {
      const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const codeStr = `${part1}-${part2}`;
      rawRecoveryCodes.push(codeStr);
      hashedCodes.push({
        codeHash: hashToken(codeStr.replace('-', '')),
        used: false
      });
    }

    admin.twoFactorEnabled = true;
    admin.recoveryCodes = hashedCodes;
    await admin.save();

    await logAuditEvent({ adminId: admin._id, username: admin.username, action: '2FA_ENABLED', req });

    return res.json({
      success: true,
      message: 'Two-factor authentication enabled successfully',
      recoveryCodes: rawRecoveryCodes
    });
  } catch (error) {
    next(error);
  }
};

// 7. DISABLE 2FA (Requires Password Re-authentication)
export const disable2FA = async (req, res, next) => {
  try {
    const { currentPassword } = req.body;
    const admin = await Admin.findById(req.admin._id).select('+passwordHash');

    if (!currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is required to disable 2FA'
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    admin.twoFactorEnabled = false;
    admin.twoFactorSecret = null;
    admin.recoveryCodes = [];
    await admin.save();

    await logAuditEvent({ adminId: admin._id, username: admin.username, action: '2FA_DISABLED', req });

    return res.json({
      success: true,
      message: 'Two-factor authentication disabled successfully'
    });
  } catch (error) {
    next(error);
  }
};

// 8. REGENERATE RECOVERY CODES (Requires Password Re-authentication)
export const regenerateRecoveryCodes = async (req, res, next) => {
  try {
    const { currentPassword } = req.body;
    const admin = await Admin.findById(req.admin._id).select('+passwordHash +recoveryCodes');

    if (!admin.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled for this account'
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    const rawRecoveryCodes = [];
    const hashedCodes = [];

    for (let i = 0; i < 8; i++) {
      const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const codeStr = `${part1}-${part2}`;
      rawRecoveryCodes.push(codeStr);
      hashedCodes.push({
        codeHash: hashToken(codeStr.replace('-', '')),
        used: false
      });
    }

    admin.recoveryCodes = hashedCodes;
    await admin.save();

    await logAuditEvent({ adminId: admin._id, username: admin.username, action: 'RECOVERY_CODES_REGENERATED', req });

    return res.json({
      success: true,
      message: 'New recovery codes generated successfully',
      recoveryCodes: rawRecoveryCodes
    });
  } catch (error) {
    next(error);
  }
};

// 9. CHANGE PASSWORD
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }

    const check = validatePassword(newPassword);
    if (!check.valid) {
      return res.status(400).json({
        success: false,
        message: check.message
      });
    }

    const admin = await Admin.findById(req.admin._id).select('+passwordHash');
    const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    const salt = await bcrypt.genSalt(12);
    admin.passwordHash = await bcrypt.hash(newPassword, salt);
    await admin.save();

    // Revoke all refresh tokens for this admin
    await RefreshToken.updateMany({ adminId: admin._id }, { revoked: true });
    res.clearCookie('refreshToken', { path: '/api/admin' });

    await logAuditEvent({ adminId: admin._id, username: admin.username, action: 'PASSWORD_CHANGED', req });

    return res.json({
      success: true,
      message: 'Password changed successfully. Please log in again.'
    });
  } catch (error) {
    next(error);
  }
};

// 10. GET AUDIT LOGS
export const getAuditLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    return res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

const syncOrderSubscribers = async () => {
  try {
    const orders = await Order.find().select('name fullName email phone phoneNo emailOptIn notificationOptIn marketingOptIn preorderNotificationOptIn optin createdAt');
    for (const b of orders) {
      const email = (b.email || '').trim().toLowerCase();
      if (!email) continue;
      const rawOptIn = b.emailOptIn ?? b.notificationOptIn ?? b.marketingOptIn ?? b.preorderNotificationOptIn ?? b.optin;
      const isOptedIn = rawOptIn === undefined ? true : (rawOptIn === true || rawOptIn === 'true' || rawOptIn === 'on' || rawOptIn === 1 || rawOptIn === '1');
      if (isOptedIn) {
        const customerName = (b.fullName || b.name || '').trim() || 'Coffee Enthusiast';
        const customerPhone = (b.phone || b.phoneNo || '').trim() || '';
        await NotificationSubscriber.findOneAndUpdate(
          { email },
          { name: customerName, phone: customerPhone, emailOptIn: true },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }
  } catch (err) {
    console.warn('Subscriber sync warning:', err.message);
  }
};

// 11. GET NOTIFICATION SUBSCRIBERS COUNT
export const getNotificationSubscribersCount = async (req, res, next) => {
  try {
    const count = await NotificationSubscriber.countDocuments({ emailOptIn: true });
    return res.json({
      success: true,
      count
    });
  } catch (error) {
    next(error);
  }
};

// 11b. GET NOTIFICATION SUBSCRIBERS LIST
export const getNotificationSubscribers = async (req, res, next) => {
  try {
    const rawSubscribers = await NotificationSubscriber.find({ emailOptIn: true }).sort({ createdAt: -1 });

    const emailsMissingPhone = rawSubscribers.filter(s => !s.phone).map(s => s.email);
    let emailToPhoneMap = {};
    if (emailsMissingPhone.length > 0) {
      const orders = await Order.find({ email: { $in: emailsMissingPhone } }).select('email phone phoneNo').sort({ createdAt: -1 });
      orders.forEach(o => {
        const emailLower = (o.email || '').toLowerCase();
        if (emailLower && (o.phone || o.phoneNo) && !emailToPhoneMap[emailLower]) {
          emailToPhoneMap[emailLower] = o.phone || o.phoneNo;
        }
      });
    }

    const subscribers = rawSubscribers.map(sub => {
      const emailLower = (sub.email || '').toLowerCase();
      return {
        _id: sub._id,
        name: sub.name || 'Coffee Enthusiast',
        email: sub.email,
        phone: sub.phone || emailToPhoneMap[emailLower] || '—',
        emailOptIn: sub.emailOptIn === true,
        createdAt: sub.createdAt
      };
    });

    return res.json({
      success: true,
      count: subscribers.length,
      subscribers
    });
  } catch (error) {
    next(error);
  }
};

// 12. TRIGGER PREORDER OPEN NOTIFICATION BATCH (TEST MODE OR PRODUCTION)
export const triggerPreorderNotification = async (req, res, next) => {
  try {
    const { preorderBatchId, testMode } = req.body;

    if (!preorderBatchId || typeof preorderBatchId !== 'string' || !preorderBatchId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Pre-order Batch ID is required (e.g., FR-BATCH-2026-001)'
      });
    }

    const batchId = preorderBatchId.trim();
    const isTest = testMode === true;

    if (isTest) {
      const testEmail = process.env.BREVO_TEST_EMAIL || 'saidhanush215@gmail.com';
      const template = getPreorderOpenTemplate({
        name: 'Test Administrator',
        email: testEmail
      });

      const result = await sendTransactionalEmail({
        toEmail: testEmail,
        toName: 'Test Administrator',
        subject: `[TEST MODE] ${template.subject}`,
        htmlContent: template.htmlContent,
        textContent: template.textContent
      });

      await NotificationLog.create({
        preorderBatchId: batchId,
        type: 'PREORDER_OPEN',
        channel: 'EMAIL',
        status: result.success ? 'SENT' : 'FAILED',
        recipientEmail: testEmail,
        providerMessageId: result.messageId || null,
        error: result.error || null,
        sentAt: new Date()
      });

      await logAuditEvent({
        adminId: req.admin?._id,
        username: req.admin?.username,
        action: 'PREORDER_NOTIFICATION_TEST_SENT',
        req
      });

      return res.json({
        success: true,
        testMode: true,
        preorderBatchId: batchId,
        testEmail,
        totalSubscribers: 1,
        sent: result.success ? 1 : 0,
        failed: result.success ? 0 : 1,
        skipped: 0,
        result
      });
    }

    // PRODUCTION NOTIFICATION BATCH
    const subscribers = await NotificationSubscriber.find({ emailOptIn: true });

    if (!subscribers || subscribers.length === 0) {
      return res.json({
        success: true,
        preorderBatchId: batchId,
        totalSubscribers: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        message: 'Zero opted-in subscribers found in database.'
      });
    }

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const failureReasons = new Set();

    for (const sub of subscribers) {
      // Duplicate check: Check if email or subscriberId already received SENT notification for THIS batch
      const emailLower = (sub.email || '').toLowerCase().trim();
      const existingSentLog = await NotificationLog.findOne({
        $or: [
          { subscriberId: sub._id },
          { recipientEmail: emailLower }
        ],
        preorderBatchId: batchId,
        type: 'PREORDER_OPEN',
        channel: 'EMAIL',
        status: 'SENT'
      });

      if (existingSentLog) {
        skippedCount++;
        await NotificationLog.create({
          subscriberId: sub._id,
          preorderBatchId: batchId,
          type: 'PREORDER_OPEN',
          channel: 'EMAIL',
          status: 'SKIPPED',
          recipientEmail: sub.email,
          error: 'Duplicate send prevented for batch',
          sentAt: new Date()
        });
        continue;
      }

      const template = getPreorderOpenTemplate({
        name: sub.name,
        email: sub.email
      });

      const sendResult = await sendTransactionalEmail({
        toEmail: sub.email,
        toName: sub.name,
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent
      });

      console.log(`[BATCH DIAGNOSTIC] Batch: "${batchId}" | Recipient: "${sub.email}" | Executed: true | Success: ${sendResult.success} | MessageId: "${sendResult.messageId || 'NONE'}" | Error: "${sendResult.error || 'NONE'}"`);

      if (sendResult.success) {
        sentCount++;
        await NotificationLog.create({
          subscriberId: sub._id,
          preorderBatchId: batchId,
          type: 'PREORDER_OPEN',
          channel: 'EMAIL',
          status: 'SENT',
          recipientEmail: sub.email,
          providerMessageId: sendResult.messageId || null,
          sentAt: new Date()
        });
      } else {
        failedCount++;
        if (sendResult.error) failureReasons.add(sendResult.error);
        await NotificationLog.create({
          subscriberId: sub._id,
          preorderBatchId: batchId,
          type: 'PREORDER_OPEN',
          channel: 'EMAIL',
          status: 'FAILED',
          recipientEmail: sub.email,
          error: sendResult.error || 'Unknown Brevo API failure',
          sentAt: new Date()
        });
      }
    }

    await logAuditEvent({
      adminId: req.admin?._id,
      username: req.admin?.username,
      action: 'PREORDER_NOTIFICATION_BATCH_SENT',
      req
    });

    return res.json({
      success: failedCount === 0,
      preorderBatchId: batchId,
      totalSubscribers: subscribers.length,
      sent: sentCount,
      failed: failedCount,
      skipped: skippedCount,
      failureReasons: [...failureReasons].slice(0, 3)
    });

  } catch (error) {
    next(error);
  }
};

