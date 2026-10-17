import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: 'French Roast'
    },
    variant: {
      type: String,
      enum: ['Whole Bean', 'Powder'],
      default: 'Whole Bean'
    },
    weight: {
      type: String,
      default: '250g'
    },
    price: {
      type: Number,
      default: 599
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 10
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0
    },
    totalSold: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['available', 'sold_out'],
      default: 'available'
    },
    image: {
      type: String,
      default: '/src/assets/hero-product.jpg'
    },
    description: {
      type: String,
      default: 'French Roast Coffee — Thoughtfully Roasted, Premium Whole Bean Coffee'
    },
    blendSettings: {
      customizationEnabled: {
        type: Boolean,
        default: true
      },
      packWeight: {
        type: Number,
        default: 250,
        min: 1
      },
      defaultArabica: {
        type: Number,
        default: 80,
        min: 0,
        max: 100
      },
      defaultRobusta: {
        type: Number,
        default: 20,
        min: 0,
        max: 100
      },
      defaultChicory: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      arabicaAdjustable: {
        type: Boolean,
        default: true
      },
      robustaAdjustable: {
        type: Boolean,
        default: true
      },
      chicoryAdjustable: {
        type: Boolean,
        default: false
      },
      minArabica: {
        type: Number,
        default: 80,
        min: 0,
        max: 100
      },
      maxArabica: {
        type: Number,
        default: 100,
        min: 0,
        max: 100
      },
      minRobusta: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      maxRobusta: {
        type: Number,
        default: 20,
        min: 0,
        max: 100
      },
      minChicory: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      maxChicory: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      step: {
        type: Number,
        default: 1,
        min: 1,
        max: 50
      },
      allowedPresets: {
        type: [mongoose.Schema.Types.Mixed],
        default: ['80/20']
      },
      productType: {
        type: String,
        default: 'Whole Bean'
      },
      version: {
        type: Number,
        default: 1
      }
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook to compute status based on stock: stock > 0 ? 'available' : 'sold_out'
productSchema.pre('save', function (next) {
  this.status = this.stock > 0 ? 'available' : 'sold_out';
  next();
});

productSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update && typeof update.stock === 'number') {
    update.status = update.stock > 0 ? 'available' : 'sold_out';
  } else if (update && update.$set && typeof update.$set.stock === 'number') {
    update.$set.status = update.$set.stock > 0 ? 'available' : 'sold_out';
  }
  next();
});

const Product = mongoose.model('Product', productSchema);
export default Product;
