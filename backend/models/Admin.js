import mongoose from 'mongoose';

const recoveryCodeSchema = new mongoose.Schema({
  codeHash: { type: String, required: true },
  used: { type: Boolean, default: false },
  usedAt: { type: Date, default: null }
}, { _id: false });

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required'],
    select: false
  },
  role: {
    type: String,
    enum: ['admin'],
    default: 'admin'
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    default: null,
    select: false
  },
  recoveryCodes: {
    type: [recoveryCodeSchema],
    default: [],
    select: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: {
    type: Date,
    default: null
  },
  lastLoginAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

adminSchema.methods.isLocked = function() {
  return !!(this.lockedUntil && this.lockedUntil > new Date());
};

const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);

export default Admin;
