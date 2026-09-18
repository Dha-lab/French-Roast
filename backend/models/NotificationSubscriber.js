import mongoose from 'mongoose';

const notificationSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      trim: true,
      default: 'Coffee Enthusiast'
    },
    emailOptIn: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

const NotificationSubscriber =
  mongoose.models.NotificationSubscriber ||
  mongoose.model('NotificationSubscriber', notificationSubscriberSchema);

export default NotificationSubscriber;
