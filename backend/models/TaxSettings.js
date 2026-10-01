import mongoose from 'mongoose';

const taxSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'default_tax_settings',
      unique: true
    },
    gstRate: {
      type: Number,
      required: [true, 'GST rate is required'],
      default: 5,
      min: [0, 'GST Rate cannot be negative']
    },
    cgstRate: {
      type: Number,
      required: [true, 'CGST rate is required'],
      default: 2.5,
      min: [0, 'CGST Rate cannot be negative']
    },
    sgstRate: {
      type: Number,
      required: [true, 'SGST rate is required'],
      default: 2.5,
      min: [0, 'SGST Rate cannot be negative']
    },
    currency: {
      type: String,
      default: 'INR'
    }
  },
  {
    timestamps: true
  }
);

const TaxSettings = mongoose.model('TaxSettings', taxSettingsSchema);
export default TaxSettings;
