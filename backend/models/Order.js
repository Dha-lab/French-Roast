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
    product: {
      type: String,
      default: 'French Roast'
    },
    variant: {
      type: String,
      required: [true, 'Coffee variant (Powder or Whole Bean) is required'],
      enum: ['Powder', 'Whole Bean'],
      default: 'Powder'
    },
    weight: {
      type: String,
      default: '250g'
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1
    },
    orderType: {
      type: String,
      required: [true, 'Order type (purchase or preorder) is required'],
      enum: ['purchase', 'preorder'],
      default: 'purchase'
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'delivered', 'cancelled'],
      default: 'pending'
    },
    notes: {
      type: String,
      default: ''
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
