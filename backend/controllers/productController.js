import mongoose from 'mongoose';
import Product from '../models/Product.js';
import { dataStore } from '../config/dataStore.js';

const useMemoryStore = () => !process.env.MONGODB_URI || mongoose.connection.readyState === 0;

// GET ALL PRODUCTS
export const getProducts = async (req, res, next) => {
  try {
    if (useMemoryStore()) {
      const products = await dataStore.getProducts();
      return res.json({ success: true, count: products.length, data: products });
    }
    const products = await Product.find({});
    return res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    next(error);
  }
};

// GET PRODUCT BY ID
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid product identifier' });
    }

    if (useMemoryStore()) {
      const product = await dataStore.getProductById(id);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      return res.json({ success: true, data: product });
    }

    let product = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id).lean();
    }

    if (!product) {
      product = await Product.findOne({
        $or: [
          { variant: new RegExp(`^${id}$`, 'i') },
          { name: new RegExp(`^${id}$`, 'i') }
        ]
      }).lean();
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// CREATE PRODUCT
export const createProduct = async (req, res, next) => {
  try {
    const newProduct = await dataStore.createProduct(req.body);
    return res.status(201).json({ success: true, message: 'Product created successfully', data: newProduct });
  } catch (error) {
    next(error);
  }
};

// UPDATE PRODUCT
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (useMemoryStore()) {
      const updated = await dataStore.updateProduct(id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      return res.json({ success: true, message: 'Product updated successfully', data: updated });
    }
    let updated = await Product.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) {
      updated = await Product.findOneAndUpdate(
        { $or: [{ _id: id }, { id: id }, { variant: id }] },
        req.body,
        { new: true }
      );
    }
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.json({ success: true, message: 'Product updated successfully', data: updated });
  } catch (error) {
    next(error);
  }
};

// DELETE PRODUCT
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const success = await dataStore.deleteProduct(id);
    if (!success) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};
