import express from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getBlendSettings
} from '../controllers/productController.js';
import { protectAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(getProducts)
  .post(protectAdmin, createProduct);

router.route('/blend-settings')
  .get(getBlendSettings);

router.route('/:id')
  .get(getProductById)
  .put(protectAdmin, updateProduct)
  .patch(protectAdmin, updateProduct)
  .delete(protectAdmin, deleteProduct);

export default router;
