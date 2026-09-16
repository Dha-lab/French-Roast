import { dataStore } from '../config/dataStore.js';

// GET ALL PRODUCTS
export const getProducts = async (req, res, next) => {
  try {
    const products = await dataStore.getProducts();
    return res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    next(error);
  }
};

// GET PRODUCT BY ID
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await dataStore.getProductById(id);
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
    const updated = await dataStore.updateProduct(id, req.body);
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
