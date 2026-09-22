import mongoose from 'mongoose';

const stockHistorySchema = new mongoose.Schema(
  {
    variant: {
      type: String,
      required: true,
      enum: ['Powder', 'Whole Bean']
    },
    actionType: {
      type: String,
      required: true,
      enum: ['ADD', 'REMOVE', 'SET', 'ORDER_DEDUCTION', 'ADJUSTMENT']
    },
    quantityChange: {
      type: Number,
      required: true
    },
    previousStock: {
      type: Number,
      required: true,
      min: 0
    },
    newStock: {
      type: Number,
      required: true,
      min: 0
    },
    reason: {
      type: String,
      default: 'Manual adjustment',
      trim: true
    },
    adminUsername: {
      type: String,
      default: 'Admin',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const StockHistory = mongoose.model('StockHistory', stockHistorySchema);
export default StockHistory;
