import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import StockHistory from '../models/StockHistory.js';
import { dataStore } from '../config/dataStore.js';
import { logAuditEvent } from '../utils/auditLogger.js';
import { sendOrderConfirmationEmail, sendWaitingRestockEmail } from '../services/brevoService.js';
import { sendOrderConfirmationSMS } from '../services/smsService.js';

const useMemoryStore = () => !process.env.MONGODB_URI || mongoose.connection.readyState === 0;

// Helper to ensure Whole Bean product exists in MongoDB with correct default pricing and blend settings
async function ensureProductsExist() {
  if (useMemoryStore()) return;
  const items = [
    { variant: 'Whole Bean', defaultPrice: 599 }
  ];
  for (const item of items) {
    let prod = await Product.findOne({ variant: item.variant });
    if (!prod) {
      await Product.create({
        name: 'French Roast',
        variant: item.variant,
        weight: '250g',
        price: item.defaultPrice,
        stock: 10,
        lowStockThreshold: 10,
        totalSold: 0,
        status: 'available',
        blendSettings: {
          customizationEnabled: true,
          minArabica: 80,
          maxArabica: 100,
          minRobusta: 0,
          maxRobusta: 20,
          step: 1,
          defaultArabica: 80,
          defaultRobusta: 20,
          defaultChicory: 0,
          version: 1
        }
      });
    } else {
      let needsSave = false;
      if (prod.price === 499) {
        prod.price = 599;
        needsSave = true;
      }
      if (!prod.blendSettings || prod.blendSettings.minArabica !== 80) {
        prod.blendSettings = {
          customizationEnabled: true,
          minArabica: 80,
          maxArabica: 100,
          minRobusta: 0,
          maxRobusta: 20,
          step: 1,
          defaultArabica: 80,
          defaultRobusta: 20,
          defaultChicory: 0,
          version: 1
        };
        needsSave = true;
      }
      if (needsSave) {
        await prod.save();
      }
    }
  }
}

// @desc    Get complete inventory summary metrics and product list
// @route   GET /api/admin/inventory/summary
// @access  Private/Admin
export const getInventorySummary = async (req, res) => {
  try {
    if (useMemoryStore()) {
      const products = await dataStore.getProducts();
      const allOrders = await dataStore.getOrders();
      const waitingOrders = allOrders.filter(o => o.status === 'waiting');

      let totalStock = 0;
      let totalSold = 0;
      let lowStockItems = 0;
      let outOfStockItems = 0;

      const productSummaries = products.map((p) => {
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

        const waitingCount = waitingOrders.filter(
          o => (o.variant === p.variant || o.coffeeType === p.variant)
        ).length;

        let computedStatus = 'IN STOCK';
        if (stock === 0) {
          computedStatus = 'OUT OF STOCK';
        } else if (stock <= threshold) {
          computedStatus = 'LOW STOCK';
        }

        return {
          id: p._id || p.id,
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
      });

      return res.json({
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
    }

    await ensureProductsExist();

    const products = await Product.find({ variant: 'Whole Bean' });
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

    if (!variant || variant !== 'Whole Bean') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid variant. Whole Bean is the only active product available for stock adjustments.' 
      });
    }

    if (!actionType || !['ADD', 'REMOVE', 'SET'].includes(actionType)) {
      return res.status(400).json({ success: false, message: 'Invalid actionType. Must be ADD, REMOVE, or SET.' });
    }

    const numQty = parseInt(quantity, 10);
    if (isNaN(numQty) || numQty < 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a non-negative integer.' });
    }

    if (useMemoryStore()) {
      const products = await dataStore.getProducts();
      const prod = products.find(p => p.variant === 'Whole Bean');
      if (!prod) {
        return res.status(404).json({ success: false, message: 'Whole Bean product not found in store.' });
      }

      const previousStock = prod.stock || 0;
      let newStock = previousStock;
      if (actionType === 'ADD') {
        newStock = previousStock + numQty;
      } else if (actionType === 'REMOVE') {
        newStock = Math.max(0, previousStock - numQty);
      } else if (actionType === 'SET') {
        newStock = Math.max(0, numQty);
      }

      prod.stock = newStock;
      prod.status = newStock > 0 ? 'available' : 'sold_out';

      return res.json({
        success: true,
        message: `Stock updated for Whole Bean. Previous: ${previousStock}, New: ${newStock}`,
        product: {
          variant: prod.variant,
          stock: prod.stock,
          status: prod.status
        }
      });
    }

    await ensureProductsExist();

    let product = await Product.findOne({ variant: 'Whole Bean' });
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
      variant: 'Whole Bean',
      actionType,
      quantityChange,
      previousStock,
      newStock,
      reason: reason || `Admin ${actionType.toLowerCase()} stock operation`,
      adminUsername: req.admin?.username || 'Admin'
    });

    res.json({
      success: true,
      message: `Stock updated for Whole Bean. Previous: ${previousStock}, New: ${newStock}`,
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
    if (useMemoryStore()) {
      const orders = await dataStore.getOrders();
      const waitingOrders = orders.filter(o => (o.status || '').toLowerCase() === 'waiting');
      return res.json({
        success: true,
        count: waitingOrders.length,
        orders: waitingOrders
      });
    }
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

    if (useMemoryStore()) {
      const products = await dataStore.getProducts();
      const prod = products.find(p => p.variant === 'Whole Bean');
      if (prod && wholeBeanThreshold !== undefined && wholeBeanThreshold !== null) {
        prod.lowStockThreshold = Math.max(0, parseInt(wholeBeanThreshold, 10));
      }
      return res.json({
        success: true,
        message: 'Inventory threshold settings updated successfully.'
      });
    }

    await ensureProductsExist();

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

// Global in-process lock to prevent duplicate executions within the same Node process
let isRestockNotificationInProgress = false;

// @desc    Notify waiting customers upon restock
// @route   POST /api/admin/inventory/notify-waiting
// @access  Private/Admin
export const notifyWaitingCustomers = async (req, res) => {
  // Prevent concurrent requests on the same process from double triggering
  if (isRestockNotificationInProgress) {
    return res.status(409).json({
      success: false,
      code: 'NOTIFICATION_IN_PROGRESS',
      message: 'A restock notification process is already in progress. Please wait for it to complete.',
      notifiedCount: 0,
      failedCount: 0,
      skippedCount: 0
    });
  }

  isRestockNotificationInProgress = true;

  try {
    if (useMemoryStore()) {
      const allOrders = await dataStore.getOrders();
      const waitingOrders = allOrders.filter(
        o => (o.status || '').toLowerCase() === 'waiting' && !o.restockNotificationSent
      );

      if (waitingOrders.length === 0) {
        return res.json({
          success: true,
          message: 'No unnotified waiting pre-orders found to notify.',
          notifiedCount: 0,
          failedCount: 0,
          skippedCount: 0
        });
      }

      let notifiedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      for (const order of waitingOrders) {
        const orderId = order.bookingId || order._id;
        const claimed = await dataStore.claimRestockOrder(orderId);
        if (!claimed) {
          skippedCount += 1;
          continue;
        }

        try {
          if (sendWaitingRestockEmail) {
            const emailResult = await sendWaitingRestockEmail(claimed);
            if (emailResult && emailResult.success && !emailResult.skipped) {
              await dataStore.finalizeRestockNotification(orderId, emailResult);
              notifiedCount += 1;
            } else if (emailResult && emailResult.skipped) {
              await dataStore.finalizeRestockNotification(orderId, { skipped: true });
              skippedCount += 1;
            } else {
              await dataStore.finalizeRestockNotification(orderId, {
                success: false,
                error: emailResult?.error || 'Email dispatch failed'
              });
              failedCount += 1;
              console.error(`Failed to send waiting restock email to ${order.email}:`, emailResult?.error || 'Email failed');
            }
          }
          if (sendOrderConfirmationSMS) {
            await sendOrderConfirmationSMS(order);
          }
        } catch (err) {
          await dataStore.finalizeRestockNotification(orderId, {
            success: false,
            error: err.message
          });
          failedCount += 1;
          console.error(`Error notifying waiting customer ${order.email}:`, err);
        }
      }

      let message = `Successfully notified ${notifiedCount} waiting pre-order customer(s).`;
      if (failedCount > 0) message += ` ${failedCount} notification(s) failed.`;
      if (skippedCount > 0) message += ` ${skippedCount} skipped (already notified or claimed).`;

      return res.json({
        success: true,
        message,
        notifiedCount,
        failedCount,
        skippedCount
      });
    }

    // MongoDB Mode: Query candidate waiting orders that haven't received restock notification
    const waitingOrders = await Order.find({
      status: 'waiting',
      restockNotificationSent: { $ne: true }
    });

    if (waitingOrders.length === 0) {
      return res.json({
        success: true,
        message: 'No unnotified waiting pre-orders found to notify.',
        notifiedCount: 0,
        failedCount: 0,
        skippedCount: 0
      });
    }

    let notifiedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const claimExpiry = new Date(Date.now() - 30000); // 30-second stale lease recovery

    for (const order of waitingOrders) {
      // Atomic claim on the individual order in MongoDB
      const claimedOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          status: 'waiting',
          restockNotificationSent: { $ne: true },
          $or: [
            { restockClaimedAt: null },
            { restockClaimedAt: { $exists: false } },
            { restockClaimedAt: { $lt: claimExpiry } }
          ]
        },
        {
          $set: { restockClaimedAt: new Date() }
        },
        { new: true }
      );

      if (!claimedOrder) {
        skippedCount += 1;
        continue;
      }

      try {
        if (sendWaitingRestockEmail) {
          const emailResult = await sendWaitingRestockEmail(claimedOrder);
          if (emailResult && emailResult.success && !emailResult.skipped) {
            await Order.updateOne(
              { _id: claimedOrder._id },
              {
                $set: {
                  restockNotificationSent: true,
                  restockNotificationSentAt: new Date(),
                  restockNotificationMessageId: emailResult.messageId || null,
                  restockNotificationError: null,
                  restockClaimedAt: null
                }
              }
            );
            notifiedCount += 1;
          } else if (emailResult && emailResult.skipped) {
            await Order.updateOne(
              { _id: claimedOrder._id },
              { $set: { restockClaimedAt: null } }
            );
            skippedCount += 1;
          } else {
            const errMsg = emailResult?.error || 'Email dispatch failed';
            await Order.updateOne(
              { _id: claimedOrder._id },
              {
                $set: {
                  restockNotificationSent: false,
                  restockNotificationError: errMsg,
                  restockClaimedAt: null
                }
              }
            );
            failedCount += 1;
            console.error(`Failed to send waiting restock email to ${claimedOrder.email}:`, errMsg);
          }
        }
        if (sendOrderConfirmationSMS) {
          await sendOrderConfirmationSMS(claimedOrder);
        }
      } catch (err) {
        await Order.updateOne(
          { _id: claimedOrder._id },
          {
            $set: {
              restockNotificationSent: false,
              restockNotificationError: err.message,
              restockClaimedAt: null
            }
          }
        );
        failedCount += 1;
        console.error(`Error notifying waiting customer ${claimedOrder.email}:`, err);
      }
    }

    let message = `Successfully notified ${notifiedCount} waiting pre-order customer(s).`;
    if (failedCount > 0) {
      message += ` ${failedCount} notification(s) failed.`;
    }
    if (skippedCount > 0) {
      message += ` ${skippedCount} skipped (already notified or claimed).`;
    }

    if (req.admin && notifiedCount > 0) {
      await logAuditEvent({
        adminUsername: req.admin?.username || 'Admin',
        action: 'NOTIFY_WAITING_RESTOCK',
        entityType: 'ORDER',
        entityId: 'BATCH',
        details: { notifiedCount, failedCount, skippedCount },
        req
      });
    }

    res.json({
      success: true,
      message,
      notifiedCount,
      failedCount,
      skippedCount
    });
  } catch (error) {
    console.error('Error in notifyWaitingCustomers:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    isRestockNotificationInProgress = false;
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

// @desc    Update product price (Admin only)
// @route   POST /api/admin/inventory/price
// @access  Private/Admin
export const updatePrice = async (req, res) => {
  try {
    const { variant, price } = req.body;

    if (!variant || variant !== 'Whole Bean') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid variant. Whole Bean is the only active product available for price adjustments.' 
      });
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Price must be a valid positive INR amount.' });
    }

    if (useMemoryStore()) {
      const products = await dataStore.getProducts();
      const prod = products.find(p => p.variant === 'Whole Bean');
      if (prod) {
        prod.price = numPrice;
      }
      return res.json({
        success: true,
        message: `Price updated for Whole Bean to ₹${numPrice}`,
        product: {
          id: prod?._id || 'prod_french_roast_250g_wholebean',
          variant: 'Whole Bean',
          price: numPrice
        }
      });
    }

    await ensureProductsExist();

    let product = await Product.findOne({ variant: 'Whole Bean' });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Whole Bean product not found.' });
    }

    product.price = numPrice;
    await product.save();

    return res.json({
      success: true,
      message: `Price updated for Whole Bean to ₹${numPrice}`,
      product: {
        id: product._id,
        variant: product.variant,
        price: product.price
      }
    });
  } catch (error) {
    console.error('Error in updatePrice:', error);
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

// @desc    Get current blend customization rules for Whole Bean
// @route   GET /api/admin/inventory/blend-settings
// @access  Private/Admin
export const getBlendSettings = async (req, res) => {
  try {
    if (useMemoryStore()) {
      const settings = await dataStore.getBlendSettings();
      return res.json({ success: true, data: settings });
    }

    await ensureProductsExist();
    const wholeBean = await Product.findOne({ variant: 'Whole Bean' });
    if (!wholeBean) {
      return res.status(404).json({ success: false, message: 'Whole Bean product not found.' });
    }

    let settings = wholeBean.blendSettings ? (wholeBean.blendSettings.toObject ? wholeBean.blendSettings.toObject() : { ...wholeBean.blendSettings }) : null;

    if (!settings || settings.defaultChicory !== 0 || settings.minArabica !== 80 || settings.maxRobusta !== 20) {
      settings = {
        customizationEnabled: true,
        packWeight: 250,
        defaultArabica: 80,
        defaultRobusta: 20,
        defaultChicory: 0,
        arabicaAdjustable: true,
        robustaAdjustable: true,
        chicoryAdjustable: false,
        minArabica: 80,
        maxArabica: 100,
        minRobusta: 0,
        maxRobusta: 20,
        minChicory: 0,
        maxChicory: 0,
        step: 1,
        allowedPresets: ['80/20', '85/15', '90/10', '100/0'],
        productType: 'Whole Bean',
        version: (settings?.version || 1) + 1
      };
      wholeBean.blendSettings = settings;
      await wholeBean.save();
    }

    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error in getBlendSettings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update blend customization rules for Whole Bean
// @route   POST /api/admin/inventory/blend-settings
// @access  Private/Admin
export const updateBlendSettings = async (req, res) => {
  try {
    const {
      customizationEnabled,
      packWeight,
      defaultArabica,
      defaultRobusta,
      step,
      allowedPresets,
      productType
    } = req.body;

    const parsedWeight = packWeight !== undefined ? Math.max(1, Number(packWeight) || 250) : 250;
    const parsedArabica = defaultArabica !== undefined ? Math.max(80, Math.min(100, Number(defaultArabica))) : 80;
    const parsedRobusta = defaultRobusta !== undefined ? Math.max(0, Math.min(20, Number(defaultRobusta))) : (100 - parsedArabica);

    // Validate that Arabica and Robusta percentages sum to exactly 100%
    const totalPercentage = Math.round((parsedArabica + parsedRobusta) * 100) / 100;
    if (Math.abs(totalPercentage - 100) > 0.001) {
      return res.status(400).json({
        success: false,
        message: `Arabica and Robusta percentages must equal exactly 100% (currently ${totalPercentage}%: Arabica ${parsedArabica}%, Robusta ${parsedRobusta}%).`
      });
    }

    if (parsedRobusta > 20) {
      return res.status(400).json({
        success: false,
        message: 'Robusta percentage cannot exceed the maximum 20% limit.'
      });
    }

    if (parsedArabica < 80) {
      return res.status(400).json({
        success: false,
        message: 'Arabica percentage cannot be below the minimum 80% limit.'
      });
    }

    const parsedStep = step !== undefined ? Math.max(1, Math.min(10, Number(step))) : 1;

    let cleanPresets = [];
    const rawPresets = Array.isArray(allowedPresets)
      ? allowedPresets
      : (typeof allowedPresets === 'string' ? allowedPresets.split(',') : []);

    for (const item of rawPresets) {
      if (typeof item === 'string') {
        const parts = item.trim().split('/').map(s => Number(s.trim()));
        if (parts.length >= 2 && parts[0] >= 80 && parts[0] <= 100 && parts[1] >= 0 && parts[1] <= 20) {
          const sum = Math.round((parts[0] + parts[1]) * 100) / 100;
          if (Math.abs(sum - 100) <= 0.001) {
            cleanPresets.push(`${parts[0]}/${parts[1]}`);
          }
        }
      }
    }

    if (cleanPresets.length === 0) {
      cleanPresets = ['80/20', '85/15', '90/10', '100/0'];
    }

    const newSettings = {
      customizationEnabled: customizationEnabled !== undefined ? Boolean(customizationEnabled) : true,
      packWeight: parsedWeight,
      defaultArabica: parsedArabica,
      defaultRobusta: parsedRobusta,
      defaultChicory: 0,
      arabicaAdjustable: true,
      robustaAdjustable: true,
      chicoryAdjustable: false,
      minArabica: 80,
      maxArabica: 100,
      minRobusta: 0,
      maxRobusta: 20,
      minChicory: 0,
      maxChicory: 0,
      step: parsedStep,
      allowedPresets: cleanPresets,
      productType: 'Whole Bean'
    };

    if (useMemoryStore()) {
      const updated = await dataStore.updateBlendSettings(newSettings);
      return res.json({ success: true, message: 'Whole Bean blend rules updated successfully.', data: updated });
    }

    await ensureProductsExist();
    const wholeBean = await Product.findOne({ variant: 'Whole Bean' });
    if (!wholeBean) {
      return res.status(404).json({ success: false, message: 'Whole Bean product not found.' });
    }

    const currentVersion = wholeBean.blendSettings?.version || 1;
    wholeBean.blendSettings = {
      ...newSettings,
      version: currentVersion + 1
    };

    await wholeBean.save();

    if (req.admin) {
      try {
        await logAuditEvent({
          adminId: req.admin._id,
          username: req.admin.username,
          action: 'UPDATE_BLEND_SETTINGS',
          req,
          targetId: wholeBean._id,
          details: wholeBean.blendSettings
        });
      } catch (auditErr) {
        console.warn('AuditLog skipped for blend settings:', auditErr.message);
      }
    }

    return res.json({
      success: true,
      message: 'Whole Bean blend rules updated successfully.',
      data: wholeBean.blendSettings
    });
  } catch (error) {
    console.error('Error in updateBlendSettings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


