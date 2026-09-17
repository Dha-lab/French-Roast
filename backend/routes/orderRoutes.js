import express from 'express';
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder
} from '../controllers/orderController.js';
import { protectAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Customer pre-orders endpoint (POST) remains 100% PUBLIC/UNAUTHENTICATED
// GET endpoint is protected for Admin Panel
router.route('/')
  .post(createOrder)
  .get(protectAdmin, getOrders);

router.route('/:id')
  .get(protectAdmin, getOrderById)
  .delete(protectAdmin, deleteOrder);

router.route('/:id/status')
  .patch(protectAdmin, updateOrderStatus);

export default router;
