import express from 'express';
import { protectAdmin } from '../middleware/authMiddleware.js';
import {
  getInventorySummary,
  getProducts,
  updateStock,
  addStock,
  removeStock,
  setStock,
  getStockHistory,
  getWaitingPreOrders,
  updateSettings,
  updateThreshold,
  notifyWaitingCustomers,
  getInventoryInsights,
  exportStockReport,
  updatePrice,
  getBlendSettings,
  updateBlendSettings
} from '../controllers/inventoryController.js';

const router = express.Router();

// Apply admin authentication to all inventory routes
router.use(protectAdmin);

router.get('/summary', getInventorySummary);
router.get('/products', getProducts);

router.get('/blend-settings', getBlendSettings);
router.post('/blend-settings', updateBlendSettings);
router.put('/blend-settings', updateBlendSettings);

router.post('/price', updatePrice);
router.post('/stock', updateStock);
router.post('/add-stock', addStock);
router.post('/remove-stock', removeStock);
router.post('/set-stock', setStock);

router.get('/history', getStockHistory);
router.get('/waiting-orders', getWaitingPreOrders);
router.get('/insights', getInventoryInsights);

router.post('/settings', updateSettings);
router.patch('/threshold', updateThreshold);

router.post('/notify-waiting', notifyWaitingCustomers);
router.get('/export', exportStockReport);

export default router;
