import mongoose from 'mongoose';

const notificationLogSchema = new mongoose.Schema(
  {
    subscriberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NotificationSubscriber',
      required: false
    },
    preorderBatchId: {
      type: String,
      required: [true, 'Preorder batch ID is required'],
      index: true
    },
    type: {
      type: String,
      enum: ['PREORDER_OPEN'],
      default: 'PREORDER_OPEN'
    },
    channel: {
      type: String,
      enum: ['EMAIL'],
      default: 'EMAIL'
    },
    status: {
      type: String,
      enum: ['SENT', 'FAILED', 'SKIPPED'],
      required: true,
      index: true
    },
    recipientEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    providerMessageId: {
      type: String,
      default: null
    },
    error: {
      type: String,
      default: null
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound index for duplicate checking
notificationLogSchema.index(
  { subscriberId: 1, preorderBatchId: 1, type: 1, channel: 1, status: 1 },
  { name: 'duplicate_send_check_idx' }
);

const NotificationLog =
  mongoose.models.NotificationLog ||
  mongoose.model('NotificationLog', notificationLogSchema);

export default NotificationLog;
