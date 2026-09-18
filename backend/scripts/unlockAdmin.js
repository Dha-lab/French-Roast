import dns from 'dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Admin from '../models/Admin.js';
import AuditLog from '../models/AuditLog.js';

// Setup environment and DNS resolution for Windows/Atlas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (dnsErr) {
  // Ignore if DNS server override is not permitted by environment
}

async function unlockAdminAccount() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI environment variable is missing.');
    process.exit(1);
  }

  const targetUsername = String(process.env.ADMIN_USERNAME || 'frenchroastadmin').trim().toLowerCase();

  try {
    await mongoose.connect(mongoUri);
    console.log('🍃 Connected to MongoDB Atlas for admin unlock maintenance.');

    const admin = await Admin.findOne({ username: targetUsername })
      .select('+passwordHash +twoFactorSecret +recoveryCodes');

    if (!admin) {
      console.error(`❌ Admin account "${targetUsername}" was not found.`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log('🔍 Admin account located.');

    // Record pre-unlock state for verification
    const initialValues = {
      username: admin.username,
      passwordHash: admin.passwordHash,
      twoFactorEnabled: admin.twoFactorEnabled,
      twoFactorSecret: admin.twoFactorSecret,
      recoveryCodesCount: (admin.recoveryCodes || []).length,
      failedLoginAttempts: admin.failedLoginAttempts,
      lockedUntil: admin.lockedUntil
    };

    // Reset ONLY lockout fields
    admin.failedLoginAttempts = 0;
    admin.lockedUntil = null;

    await admin.save();
    console.log('🔓 Temporary lockout cleared (failedLoginAttempts = 0, lockedUntil = null).');

    // Audit trail logging
    try {
      await AuditLog.create({
        adminId: admin._id,
        username: admin.username,
        action: 'ADMIN_ACCOUNT_UNLOCKED',
        ipAddress: '127.0.0.1',
        userAgent: 'Local Admin Unlock Script (unlockAdmin.js)',
        targetId: String(admin._id),
        details: { reason: 'Development/admin maintenance unlock' }
      });
      console.log('📝 Audit event ADMIN_ACCOUNT_UNLOCKED recorded.');
    } catch (auditErr) {
      console.warn('⚠️ Could not write audit log:', auditErr.message);
    }

    // Re-fetch document for post-unlock verification
    const verifiedAdmin = await Admin.findOne({ _id: admin._id })
      .select('+passwordHash +twoFactorSecret +recoveryCodes');

    // Verification assertions
    const isUsernameUnchanged = verifiedAdmin.username === initialValues.username;
    const isPasswordHashUnchanged = verifiedAdmin.passwordHash === initialValues.passwordHash;
    const is2FAUnchanged = verifiedAdmin.twoFactorEnabled === initialValues.twoFactorEnabled &&
                           verifiedAdmin.twoFactorSecret === initialValues.twoFactorSecret;
    const isRecoveryCodesUnchanged = (verifiedAdmin.recoveryCodes || []).length === initialValues.recoveryCodesCount;
    const isLockoutCleared = verifiedAdmin.failedLoginAttempts === 0 && verifiedAdmin.lockedUntil === null;

    console.log('\n--- UNLOCK VERIFICATION RESULTS ---');
    console.log(`- Admin account located: ${admin ? 'PASS' : 'FAIL'}`);
    console.log(`- Lockout cleared: ${isLockoutCleared ? 'PASS' : 'FAIL'}`);
    console.log(`- Password unchanged: ${isPasswordHashUnchanged ? 'PASS' : 'FAIL'}`);
    console.log(`- 2FA unchanged: ${is2FAUnchanged ? 'PASS' : 'FAIL'}`);
    console.log(`- Recovery codes unchanged: ${isRecoveryCodesUnchanged ? 'PASS' : 'FAIL'}`);

    if (isUsernameUnchanged && isPasswordHashUnchanged && is2FAUnchanged && isRecoveryCodesUnchanged && isLockoutCleared) {
      console.log('\n✅ SAFE UNLOCK COMPLETED SUCCESSFULLY.');
    } else {
      console.error('\n❌ UNLOCK VERIFICATION FAILED! Unexpected field changes detected.');
    }

    await mongoose.disconnect();
    console.log('🍃 Disconnected from MongoDB Atlas.');
  } catch (err) {
    console.error('❌ Error executing admin unlock:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

unlockAdminAccount();
