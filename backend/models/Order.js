import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      trim: true,
      lowercase: true
    },
    address: {
      type: String,
      required: [true, 'Delivery address is required'],
      trim: true
    },
    pinCode: {
      type: String,
      required: [true, 'PIN code is required'],
      trim: true
    },
    deliveryArea: {
      type: String,
      default: 'Bengaluru',
      trim: true
    },
    product: {
      type: String,
      default: 'French Roast'
    },
    variant: {
      type: String,
      required: [true, 'Coffee variant (Whole Bean) is required'],
      enum: ['Whole Bean', 'Powder'],
      default: 'Whole Bean'
    },
    weight: {
      type: String,
      default: '250g'
    },
    blend: {
      type: new mongoose.Schema(
        {
          customizationEnabled: {
            type: Boolean,
            default: false
          },
          arabicaPercentage: {
            type: Number,
            min: 0,
            max: 100
          },
          robustaPercentage: {
            type: Number,
            min: 0,
            max: 100
          },
          chicoryPercentage: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
          },
          arabicaGrams: {
            type: Number,
            min: 0
          },
          robustaGrams: {
            type: Number,
            min: 0
          },
          chicoryGrams: {
            type: Number,
            min: 0,
            default: 0
          },
          totalGrams: {
            type: Number,
            default: 250
          },
          totalArabicaGrams: {
            type: Number,
            min: 0
          },
          totalRobustaGrams: {
            type: Number,
            min: 0
          },
          totalChicoryGrams: {
            type: Number,
            min: 0,
            default: 0
          },
          configurationVersion: {
            type: Number,
            default: 1
          }
        },
        { _id: false }
      ),
      default: undefined
    },
    arabicaPercentage: {
      type: Number,
      min: 0,
      max: 100
    },
    robustaPercentage: {
      type: Number,
      min: 0,
      max: 100
    },
    chicoryPercentage: {
      type: Number,
      min: 0,
      max: 100
    },
    arabicaGrams: {
      type: Number,
      min: 0
    },
    robustaGrams: {
      type: Number,
      min: 0
    },
    chicoryGrams: {
      type: Number,
      min: 0
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1
    },
    unitPrice: {
      type: Number,
      default: 499
    },
    itemTotal: {
      type: Number,
      default: 499
    },
    subtotal: {
      type: Number,
      default: 499
    },
    gstRate: {
      type: Number,
      default: 5
    },
    gstAmount: {
      type: Number,
      default: 0
    },
    cgstRate: {
      type: Number,
      default: 2.5
    },
    cgstAmount: {
      type: Number,
      default: 0
    },
    sgstRate: {
      type: Number,
      default: 2.5
    },
    sgstAmount: {
      type: Number,
      default: 0
    },
    deliveryCharge: {
      type: Number,
      default: 0
    },
    finalTotal: {
      type: Number,
      default: 499
    },
    currency: {
      type: String,
      default: 'INR'
    },
    orderType: {
      type: String,
      required: [true, 'Order type (purchase or preorder) is required'],
      enum: ['purchase', 'preorder'],
      default: 'preorder'
    },
    status: {
      type: String,
      enum: ['pending', 'waiting', 'confirmed', 'delivered', 'cancelled'],
      default: 'pending'
    },
    notes: {
      type: String,
      default: ''
    },
    paymentMode: {
      type: String,
      default: 'test'
    },
    paymentStatus: {
      type: String,
      default: 'simulated_success'
    },
    confirmationEmailSent: {
      type: Boolean,
      default: false
    },
    confirmationEmailSentAt: {
      type: Date,
      default: null
    },
    confirmationEmailMessageId: {
      type: String,
      default: null
    },
    confirmationEmailError: {
      type: String,
      default: null
    },
    waitingConfirmationEmailSent: {
      type: Boolean,
      default: false
    },
    waitingConfirmationEmailSentAt: {
      type: Date,
      default: null
    },
    waitingConfirmationEmailMessageId: {
      type: String,
      default: null
    },
    waitingConfirmationEmailError: {
      type: String,
      default: null
    },
    restockNotificationSent: {
      type: Boolean,
      default: false
    },
    restockNotificationSentAt: {
      type: Date,
      default: null
    },
    restockNotificationMessageId: {
      type: String,
      default: null
    },
    restockNotificationError: {
      type: String,
      default: null
    },
    restockClaimedAt: {
      type: Date,
      default: null
    },
    smsConfirmationSent: {
      type: Boolean,
      default: false
    },
    smsSentAt: {
      type: Date,
      default: null
    },
    smsMessageId: {
      type: String,
      default: null
    },
    smsError: {
      type: String,
      default: null
    },
    stockDeducted: {
      type: Boolean,
      default: false
    },
    stockRestored: {
      type: Boolean,
      default: false
    },
    stockRestoredAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Auto-generate bookingId before saving if missing
orderSchema.pre('save', function (next) {
  if (!this.bookingId) {
    this.bookingId = `FR-${Date.now().toString().slice(-5)}${Math.floor(10 + Math.random() * 90)}`;
  }
  next();
});

const Order = mongoose.model('Order', orderSchema);
export default Order;
