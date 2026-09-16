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
      enum: ['Powder', 'Whole Bean'],
      default: 'Powder'
    },
    weight: {
      type: String,
      default: '250g'
    },
    price: {
      type: Number,
      default: 499
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 10
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
      default: 'French Roast Coffee — Thoughtfully Roasted, Premium Coffee'
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
