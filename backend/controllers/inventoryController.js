import Product from '../models/Product.js';
import Order from '../models/Order.js';
import StockHistory from '../models/StockHistory.js';
import { sendOrderConfirmationEmail } from '../services/brevoService.js';
import { sendOrderConfirmationSMS } from '../services/smsService.js';

// Helper to ensure standard 2 products exist in MongoDB
async function ensureProductsExist() {
  const variants = ['Powder', 'Whole Bean'];
  for (const variant of variants) {
    let prod = await Product.findOne({ variant });
    if (!prod) {
      await Product.create({
        name: 'French Roast',
        variant,
        weight: '250g',
        price: 499,
        stock: 10,
        lowStockThreshold: 10,
        totalSold: 0,
        status: 'available'
      });
    }
  }
}

// @desc    Get complete inventory summary metrics and product list
// @route   GET /api/admin/inventory/summary
// @access  Private/Admin
export const getInventorySummary = async (req, res) => {
  try {
    await ensureProductsExist();

    const products = await Product.find({});
    const waitingOrders = await Order.find({ status: 'waiting' });

    let totalStock = 0;
    let totalSold = 0;
    let lowStockItems = 0;
    let outOfStockItems = 0;

    const productSummaries = await Promise.all(
      products.map(async (p) => {
        const stock = p.stock || 0;
        const threshold = p.lowStockThreshold || 10;
        const sold = p.totalSold || 0;

        totalStock += stock;
        totalSold += sold;

        if (stock === 0) {
          outOfStockItems += 1;
        } else if (stock <= threshold) {
          lowStockItems += 1;
        }

        const waitingCount = await Order.countDocuments({
          variant: p.variant,
          status: 'waiting'
        });

        let computedStatus = 'IN STOCK';
        if (stock === 0) {
          computedStatus = 'OUT OF STOCK';
        } else if (stock <= threshold) {
          computedStatus = 'LOW STOCK';
        }

        return {
          id: p._id,
          name: p.name,
          variant: p.variant,
          weight: p.weight,
          price: p.price,
          stock,
          lowStockThreshold: threshold,
          totalSold: sold,
          waitingCount,
          statusBadge: computedStatus,
          status: p.status
        };
      })
    );

    res.json({
      success: true,
      summary: {
        totalStock,
        totalSold,
        waitingPreOrders: waitingOrders.length,
        lowStockItems,
        outOfStockItems
      },
      products: productSummaries,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in getInventorySummary:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update stock level (Add, Remove, Set)
// @route   POST /api/admin/inventory/stock
// @access  Private/Admin
export const updateStock = async (req, res) => {
  try {
    const { variant, actionType, quantity, reason } = req.body;

    if (!variant || !['Powder', 'Whole Bean'].includes(variant)) {
      return res.status(400).json({ success: false, message: 'Invalid variant. Must be Powder or Whole Bean.' });
    }

    if (!actionType || !['ADD', 'REMOVE', 'SET'].includes(actionType)) {
      return res.status(400).json({ success: false, message: 'Invalid actionType. Must be ADD, REMOVE, or SET.' });
    }

    const numQty = parseInt(quantity, 10);
    if (isNaN(numQty) || numQty < 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a non-negative integer.' });
    }

    await ensureProductsExist();

    let product = await Product.findOne({ variant });
    const previousStock = product.stock || 0;
    let newStock = previousStock;

    if (actionType === 'ADD') {
      newStock = previousStock + numQty;
    } else if (actionType === 'REMOVE') {
      newStock = Math.max(0, previousStock - numQty);
    } else if (actionType === 'SET') {
      newStock = Math.max(0, numQty);
    }

    const quantityChange = newStock - previousStock;

    product.stock = newStock;
    await product.save();

    const historyEntry = await StockHistory.create({
      variant,
      actionType,
      quantityChange,
      previousStock,
      newStock,
      reason: reason || `Admin ${actionType.toLowerCase()} stock operation`,
      adminUsername: req.admin?.username || 'Admin'
    });

    res.json({
      success: true,
      message: `Stock updated for ${variant}. Previous: ${previousStock}, New: ${newStock}`,
      product: {
        variant: product.variant,
        stock: product.stock,
        status: product.status
      },
      history: historyEntry
    });
  } catch (error) {
    console.error('Error in updateStock:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get stock history audit log
// @route   GET /api/admin/inventory/history
// @access  Private/Admin
export const getStockHistory = async (req, res) => {
  try {
    const history = await StockHistory.find({}).sort({ createdAt: -1 }).limit(50);
    res.json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    console.error('Error in getStockHistory:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get waiting pre-orders
// @route   GET /api/admin/inventory/waiting-orders
// @access  Private/Admin
export const getWaitingPreOrders = async (req, res) => {
  try {
    const waitingOrders = await Order.find({ status: 'waiting' }).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: waitingOrders.length,
      orders: waitingOrders
    });
  } catch (error) {
    console.error('Error in getWaitingPreOrders:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update low-stock thresholds
// @route   POST /api/admin/inventory/settings
// @access  Private/Admin
export const updateSettings = async (req, res) => {
  try {
    const { powderThreshold, wholeBeanThreshold } = req.body;

    await ensureProductsExist();

    if (powderThreshold !== undefined && powderThreshold !== null) {
      await Product.updateOne(
        { variant: 'Powder' },
        { $set: { lowStockThreshold: Math.max(0, parseInt(powderThreshold, 10)) } }
      );
    }

    if (wholeBeanThreshold !== undefined && wholeBeanThreshold !== null) {
      await Product.updateOne(
        { variant: 'Whole Bean' },
        { $set: { lowStockThreshold: Math.max(0, parseInt(wholeBeanThreshold, 10)) } }
      );
    }

    res.json({
      success: true,
      message: 'Inventory threshold settings updated successfully.'
    });
  } catch (error) {
    console.error('Error in updateSettings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Notify waiting customers upon restock
// @route   POST /api/admin/inventory/notify-waiting
// @access  Private/Admin
export const notifyWaitingCustomers = async (req, res) => {
  try {
    const waitingOrders = await Order.find({ status: 'waiting' });
    if (waitingOrders.length === 0) {
      return res.json({ success: true, message: 'No waiting pre-orders found to notify.', notifiedCount: 0 });
    }

    let notifiedCount = 0;
    for (const order of waitingOrders) {
      // Send email/SMS notifications without auto-charging or deducting stock
      try {
        if (sendOrderConfirmationEmail) {
          await sendOrderConfirmationEmail(order);
        }
        if (sendOrderConfirmationSMS) {
          await sendOrderConfirmationSMS(order);
        }
        notifiedCount += 1;
      } catch (err) {
        console.error(`Error notifying waiting customer ${order.email}:`, err);
      }
    }

    res.json({
      success: true,
      message: `Successfully notified ${notifiedCount} waiting pre-order customer(s).`,
      notifiedCount
    });
  } catch (error) {
    console.error('Error in notifyWaitingCustomers:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get 7-day inventory insights / stock movement trends
// @route   GET /api/admin/inventory/insights
// @access  Private/Admin
export const getInventoryInsights = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const history = await StockHistory.find({ createdAt: { $gte: sevenDaysAgo } });

    // Aggregate trends by day
    const dailyMovement = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyMovement[dateStr] = { date: dateStr, added: 0, removed: 0 };
    }

    history.forEach((h) => {
      const dateStr = new Date(h.createdAt).toISOString().split('T')[0];
      if (dailyMovement[dateStr]) {
        if (h.quantityChange > 0) {
          dailyMovement[dateStr].added += h.quantityChange;
        } else if (h.quantityChange < 0) {
          dailyMovement[dateStr].removed += Math.abs(h.quantityChange);
        }
      }
    });

    res.json({
      success: true,
      insights: Object.values(dailyMovement)
    });
  } catch (error) {
    console.error('Error in getInventoryInsights:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Aliases for RESTful route variants
export const getProducts = async (req, res) => {
  return getInventorySummary(req, res);
};

export const addStock = async (req, res) => {
  req.body.actionType = 'ADD';
  return updateStock(req, res);
};

export const removeStock = async (req, res) => {
  req.body.actionType = 'REMOVE';
  return updateStock(req, res);
};

export const setStock = async (req, res) => {
  req.body.actionType = 'SET';
  return updateStock(req, res);
};

export const updateThreshold = async (req, res) => {
  return updateSettings(req, res);
};

export const exportStockReport = async (req, res) => {
  return getInventorySummary(req, res);
};

