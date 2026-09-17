import AuditLog from '../models/AuditLog.js';

export const logAuditEvent = async ({ adminId, username, action, req, targetId = '', details = {} }) => {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '') : '';
    const userAgent = req ? (req.headers['user-agent'] || '') : '';

    // Sanitize details to ensure sensitive keys are NEVER logged
    const sanitizedDetails = { ...details };
    const sensitiveKeys = ['password', 'passwordHash', 'token', 'secret', 'twoFactorSecret', 'currentPassword', 'newPassword'];
    sensitiveKeys.forEach(key => delete sanitizedDetails[key]);

    await AuditLog.create({
      adminId: adminId || null,
      username: username || (adminId ? 'admin' : 'system'),
      action,
      ipAddress: String(ipAddress).split(',')[0].trim(),
      userAgent: String(userAgent),
      targetId: String(targetId),
      details: sanitizedDetails
    });
  } catch (err) {
    console.error('Failed to write Audit Log:', err.message);
  }
};
