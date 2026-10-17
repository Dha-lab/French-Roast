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

// GET BLEND SETTINGS (PUBLIC)
export const getBlendSettings = async (req, res, next) => {
  try {
    if (useMemoryStore()) {
      const settings = await dataStore.getBlendSettings();
      return res.json({ success: true, data: settings });
    }
    const powder = await Product.findOne({ variant: 'Powder' });
    let settings = powder?.blendSettings ? (powder.blendSettings.toObject ? powder.blendSettings.toObject() : { ...powder.blendSettings }) : null;
    const defaultA = typeof settings?.defaultArabica === 'number' ? settings.defaultArabica : 70;
    const defaultR = 100 - defaultA;

    if (!settings || settings.defaultChicory !== 0 || settings.defaultRobusta !== defaultR || settings.chicoryAdjustable !== false) {
      settings = {
        customizationEnabled: settings?.customizationEnabled !== undefined ? settings.customizationEnabled : true,
        packWeight: settings?.packWeight || 250,
        defaultArabica: defaultA,
        defaultRobusta: defaultR,
        defaultChicory: 0,
        arabicaAdjustable: settings?.arabicaAdjustable !== undefined ? settings.arabicaAdjustable : true,
        robustaAdjustable: settings?.robustaAdjustable !== undefined ? settings.robustaAdjustable : true,
        chicoryAdjustable: false,
        minArabica: typeof settings?.minArabica === 'number' ? settings.minArabica : 0,
        maxArabica: typeof settings?.maxArabica === 'number' ? settings.maxArabica : 100,
        minRobusta: typeof settings?.minRobusta === 'number' ? settings.minRobusta : 0,
        maxRobusta: typeof settings?.maxRobusta === 'number' ? settings.maxRobusta : 100,
        minChicory: 0,
        maxChicory: 0,
        step: settings?.step || 5,
        allowedPresets: ['70/30', '80/20', '60/40', '75/25'],
        productType: 'Powder',
        version: (settings?.version || 1) + 1
      };
      if (powder) {
        powder.blendSettings = settings;
        await powder.save();
      }
    }
    return res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

