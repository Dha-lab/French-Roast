import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  tokenHash: {
    type: String,
    required: true,
    index: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  revoked: {
    type: Boolean,
    default: false
  },
  replacedByTokenHash: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

refreshTokenSchema.methods.isExpired = function() {
  return new Date() >= this.expiresAt;
};

const RefreshToken = mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema);

export default RefreshToken;
