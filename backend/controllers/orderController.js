import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import StockHistory from '../models/StockHistory.js';
import NotificationSubscriber from '../models/NotificationSubscriber.js';
import { dataStore } from '../config/dataStore.js';
import { logAuditEvent } from '../utils/auditLogger.js';
import { sendOrderConfirmationEmail } from '../services/brevoService.js';
import { sendOrderConfirmationSMS } from '../services/smsService.js';
import { validateDeliveryLocation, normalizePincode } from '../config/deliveryAreas.js';
import { fetchActiveTaxSettings } from './taxSettingsController.js';

const useMemoryStore = () => !process.env.MONGODB_URI || mongoose.connection.readyState === 0;

export const roundCurrency = (val) => Math.round((Number(val) || 0) * 100) / 100;

export const calculateOrderTotals = (unitPrice, quantity, gstRate = 5, cgstRate = 2.5) => {
  const qty = Math.max(1, Number(quantity) || 1);
  const price = roundCurrency(unitPrice);
  const subtotal = roundCurrency(price * qty);

  const gRate = Math.max(0, Number(gstRate) || 0);
  const cRate = Math.max(0, Number(cgstRate) || 0);
  const sRate = Math.max(0, roundCurrency(gRate - cRate));

  const taxableUnitValue = roundCurrency(price / (1 + gRate / 100));
  const gstUnitAmount = roundCurrency(price - taxableUnitValue);
  const cgstUnitAmount = roundCurrency(taxableUnitValue * cRate / 100);
  const sgstUnitAmount = roundCurrency(taxableUnitValue * sRate / 100);

  const gstAmount = roundCurrency(gstUnitAmount * qty);
  const cgstAmount = roundCurrency(cgstUnitAmount * qty);
  const sgstAmount = roundCurrency(sgstUnitAmount * qty);
  const deliveryCharge = 0;
  const finalTotal = subtotal;

  return {
    subtotal,
    gstRate: gRate,
    gstAmount,
    cgstRate: cRate,
    cgstAmount,
    sgstRate: sRate,
    sgstAmount,
    deliveryCharge,
    finalTotal,
    currency: 'INR'
  };
};

// Helper to format order document with backward-compatible fields for legacy UI & Admin panel
const formatOrder = (doc) => {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const variant = obj.variant || obj.coffeeType || 'Powder';
  const qty = Math.max(1, Number(obj.quantity) || 1);
  const unitPrice = typeof obj.unitPrice === 'number' ? obj.unitPrice : (variant === 'Whole Bean' ? 599 : 499);
  const itemTotal = typeof obj.itemTotal === 'number' ? obj.itemTotal : (unitPrice * qty);

  const defaultTotals = calculateOrderTotals(unitPrice, qty);
  const totals = {
    subtotal: typeof obj.subtotal === 'number' ? obj.subtotal : itemTotal,
    gstRate: typeof obj.gstRate === 'number' ? obj.gstRate : 5,
    gstAmount: typeof obj.gstAmount === 'number' ? obj.gstAmount : defaultTotals.gstAmount,
    cgstRate: typeof obj.cgstRate === 'number' ? obj.cgstRate : 2.5,
    cgstAmount: typeof obj.cgstAmount === 'number' ? obj.cgstAmount : defaultTotals.cgstAmount,
    sgstRate: typeof obj.sgstRate === 'number' ? obj.sgstRate : 2.5,
    sgstAmount: typeof obj.sgstAmount === 'number' ? obj.sgstAmount : defaultTotals.sgstAmount,
    deliveryCharge: typeof obj.deliveryCharge === 'number' ? obj.deliveryCharge : 0,
    finalTotal: typeof obj.finalTotal === 'number' ? obj.finalTotal : itemTotal,
    currency: obj.currency || 'INR'
  };

  return {
    ...obj,
    name: obj.fullName || obj.name,
    coffeeType: variant,
    packSize: obj.weight || obj.packSize || '250g',
    unitPrice,
    itemTotal,
    ...totals,
    paymentMode: obj.paymentMode !== undefined ? obj.paymentMode : 'test',
    paymentStatus: obj.paymentStatus !== undefined ? obj.paymentStatus : 'simulated_success',
    status: obj.status || 'pending',
    isWaitingPreorder: obj.status === 'waiting' || obj.paymentMode === 'none',
    pinCode: obj.pinCode || '',
    deliveryArea: obj.deliveryArea || 'Bengaluru',
    confirmationEmailSent: !!obj.confirmationEmailSent,
    confirmationEmailSentAt: obj.confirmationEmailSentAt || null,
    smsConfirmationSent: !!obj.smsConfirmationSent,
    smsSentAt: obj.smsSentAt || null,
    smsMessageId: obj.smsMessageId || null,
    smsError: obj.smsError || null
  };
};

// CREATE ORDER / PRE-BOOK REQUEST
export const createOrder = async (req, res, next) => {
  try {
    const { fullName, name, phone, email, address, pinCode, pincode, pin, variant, coffeeType, weight, packSize, quantity, notes, emailOptIn, notificationOptIn, marketingOptIn, preorderNotificationOptIn, optin, paymentMode, paymentStatus } = req.body;

    const selectedPaymentMode = (paymentMode || 'test').toString().toLowerCase();
    const selectedPaymentStatus = (paymentStatus || 'simulated_success').toString().toLowerCase();

    if (selectedPaymentStatus === 'simulated_failed' || selectedPaymentStatus === 'failed') {
      return res.status(400).json({
        success: false,
        message: 'Test payment failed. Pre-order was not created and inventory was not modified.'
      });
    }

    const customerName = (fullName || name || '').trim();
    const customerPhone = (phone || '').trim();
    const customerEmail = (email || '').trim().toLowerCase();
    const customerAddress = (address || '').trim();
    const rawPin = pinCode || pincode || pin || '';
    const cleanPin = normalizePincode(rawPin);
    const selectedVariant = variant || coffeeType || 'Powder';
    const selectedPackSize = weight || packSize || '250g';
    const parsedQty = Math.max(1, Number(quantity) || 1);
    
    const rawOptIn = emailOptIn ?? notificationOptIn ?? marketingOptIn ?? preorderNotificationOptIn ?? optin;
    const isOptedIn = rawOptIn === true || rawOptIn === 'true' || rawOptIn === 'on' || rawOptIn === 1 || rawOptIn === '1';

    if (!customerName) {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }
    if (!customerPhone || !/^[0-9]{10}$/.test(customerPhone.replace(/[\s-]/g, ''))) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit mobile phone number is required' });
    }
    if (!customerEmail || !/\S+@\S+\.\S+/.test(customerEmail)) {
      return res.status(400).json({ success: false, message: 'Valid email address is required' });
    }
    if (!customerAddress) {
      return res.status(400).json({ success: false, message: 'Delivery location/address is required' });
    }
    if (!['Powder', 'Whole Bean'].includes(selectedVariant)) {
      return res.status(400).json({ success: false, message: 'Valid coffee variant (Powder or Whole Bean) is required' });
    }
    if (selectedPackSize !== '250g') {
      return res.status(400).json({ success: false, message: 'Only 250g pack size is currently available' });
    }

    // Strict Backend Delivery Location Validation (Primary Authority)
    const locationCheck = validateDeliveryLocation(cleanPin);
    if (!locationCheck.valid) {
      return res.status(400).json({
        success: false,
        code: locationCheck.code || 'OUTSIDE_DELIVERY_AREA',
        message: locationCheck.message || 'French Roast currently delivers only within Bengaluru.'
      });
    }

    // Handle Explicit Customer Email Opt-In Subscription
    if (isOptedIn && customerEmail) {
      try {
        await NotificationSubscriber.findOneAndUpdate(
          { email: customerEmail },
          { name: customerName, phone: customerPhone, emailOptIn: true },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (subErr) {
        console.warn('Failed to upsert notification subscriber:', subErr.message);
      }
    }

    if (useMemoryStore()) {
      try {
        const prod = memoryStore.products.find(p => p.variant === selectedVariant);
        const availableStock = prod ? (typeof prod.stock === 'number' ? prod.stock : 0) : 0;
        const isWaitingPreorder = Boolean(availableStock <= 0 || availableStock < parsedQty || req.body.status === 'waiting' || req.body.isWaitingPreorder);

        const newOrder = await dataStore.createOrder({
          ...req.body,
          fullName: customerName,
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
          address: customerAddress,
          pinCode: cleanPin,
          deliveryArea: locationCheck.area || 'Bengaluru',
          variant: selectedVariant,
          weight: selectedPackSize,
          quantity: parsedQty,
          orderType: 'preorder',
          paymentMode: isWaitingPreorder ? 'none' : 'test',
          paymentStatus: isWaitingPreorder ? 'unpaid' : 'simulated_success',
          status: isWaitingPreorder ? 'waiting' : 'pending',
          notes: notes || ''
        });

        let emailResult = null;
        let smsResult = null;

        if (!isWaitingPreorder) {
          try {
            emailResult = await sendOrderConfirmationEmail(newOrder);
          } catch (emailErr) {
            console.warn('⚠️ Order confirmation email failed (memory store):', emailErr.message);
          }

          try {
            smsResult = await sendOrderConfirmationSMS(newOrder);
          } catch (smsErr) {
            console.warn('⚠️ Order confirmation SMS failed (memory store):', smsErr.message);
          }
        }

        return res.status(201).json({
          success: true,
          isWaitingPreorder,
          message: isWaitingPreorder
            ? 'Waiting pre-order registered successfully. You will be notified when stock arrives.'
            : 'Pre-book order request submitted successfully',
          data: formatOrder(newOrder),
          emailSent: emailResult ? emailResult.success : false,
          smsSent: smsResult ? smsResult.success : false
        });
      } catch (memErr) {
        if (memErr.code === 'INSUFFICIENT_STOCK') {
          return res.status(400).json({
            success: false,
            code: 'INSUFFICIENT_STOCK',
            message: memErr.message
          });
        }
        throw memErr;
      }
    }

    // Determine price from MongoDB product source of truth
    let unitPrice = selectedVariant === 'Whole Bean' ? 599 : 499;

    const existingProduct = await Product.findOne({ variant: selectedVariant });
    const currentStock = existingProduct ? (typeof existingProduct.stock === 'number' ? existingProduct.stock : 0) : 0;
    if (existingProduct && typeof existingProduct.price === 'number' && existingProduct.price > 0) {
      unitPrice = existingProduct.price;
    }

    // Determine if this order should be a Waiting Pre-Order (stock is 0, insufficient, or requested waiting)
    let isWaitingPreorder = Boolean(currentStock <= 0 || currentStock < parsedQty || req.body.status === 'waiting' || req.body.isWaitingPreorder);

    let previousStock = currentStock;
    let newStock = currentStock;

    if (!isWaitingPreorder) {
      // Atomic stock check and deduction in MongoDB to prevent overselling / race conditions
      let product = await Product.findOneAndUpdate(
        { variant: selectedVariant, stock: { $gte: parsedQty } },
        {
          $inc: { stock: -parsedQty, totalSold: parsedQty }
        },
        { new: false }
      );

      if (!product) {
        // Race condition: another order took remaining stock right before this query.
        // Fallback to waiting pre-order so customer reservation is not lost.
        isWaitingPreorder = true;
      } else {
        if (typeof product.price === 'number' && product.price > 0) {
          unitPrice = product.price;
        }
        previousStock = product.stock;
        newStock = Math.max(0, previousStock - parsedQty);

        try {
          await StockHistory.create({
            variant: selectedVariant,
            actionType: 'ORDER_DEDUCTION',
            quantityChange: -parsedQty,
            previousStock,
            newStock,
            reason: `Order placed by ${customerName}`,
            adminUsername: 'System'
          });
        } catch (stockHistErr) {
          console.warn('StockHistory log skipped:', stockHistErr.message);
        }
      }
    }

    const itemTotal = unitPrice * parsedQty;
    const activeTax = await fetchActiveTaxSettings();
    const totals = calculateOrderTotals(unitPrice, parsedQty, activeTax.gstRate, activeTax.cgstRate);

    // 1. Create and save order in MongoDB
    const newOrder = await Order.create({
      fullName: customerName,
      phone: customerPhone,
      email: customerEmail,
      address: customerAddress,
      pinCode: cleanPin,
      deliveryArea: locationCheck.area || 'Bengaluru',
      product: 'French Roast',
      variant: selectedVariant,
      weight: selectedPackSize,
      quantity: parsedQty,
      unitPrice,
      itemTotal,
      ...totals,
      orderType: 'preorder',
      paymentMode: isWaitingPreorder ? 'none' : 'test',
      paymentStatus: isWaitingPreorder ? 'unpaid' : 'simulated_success',
      status: isWaitingPreorder ? 'waiting' : 'pending',
      notes: notes || ''
    });

    let emailResult = null;
    let smsResult = null;

    if (!isWaitingPreorder) {
      // 2. Send automatic order confirmation email (unconditional for in-stock orders)
      try {
        emailResult = await sendOrderConfirmationEmail(newOrder);
      } catch (emailErr) {
        console.error('❌ Order confirmation email error:', emailErr.message);
        // Order MUST NOT be deleted if email fails
      }

      // 3. Send automatic order confirmation SMS (unconditional for in-stock orders)
      try {
        smsResult = await sendOrderConfirmationSMS(newOrder);
      } catch (smsErr) {
        console.error(`❌ Order confirmation SMS error for order ${newOrder.bookingId || newOrder._id}:`, smsErr.message);
        // Order MUST NOT be deleted if SMS fails
      }
    }

    const responseData = formatOrder(newOrder);

    return res.status(201).json({
      success: true,
      isWaitingPreorder,
      message: isWaitingPreorder
        ? 'Waiting pre-order registered successfully. You will be notified when stock arrives.'
        : 'Pre-book order request submitted successfully',
      data: responseData,
      emailSent: emailResult ? emailResult.success : false,
      smsSent: smsResult ? smsResult.success : false
    });
  } catch (error) {
    next(error);
  }
};

export const getOrders = async (req, res, next) => {
  try {
    if (useMemoryStore()) {
      const orders = await dataStore.getOrders();
      return res.json({ success: true, count: orders.length, data: orders.map(formatOrder) });
    }

    const orders = await Order.find().sort({ createdAt: -1 });
    const formattedOrders = orders.map(formatOrder);
    return res.json({ success: true, count: formattedOrders.length, data: formattedOrders });
  } catch (error) {
    next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid order identifier' });
    }

    if (useMemoryStore()) {
      const order = await dataStore.getOrderById(id);
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      return res.json({ success: true, data: formatOrder(order) });
    }

    const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { bookingId: id }] } : { bookingId: id };
    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    return res.json({ success: true, data: formatOrder(order) });
  } catch (error) {
    next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid order identifier' });
    }

    if (useMemoryStore()) {
      const order = await dataStore.updateOrderStatus(id, status || 'Pending');
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      return res.json({ success: true, message: 'Order status updated', data: formatOrder(order) });
    }

    const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { bookingId: id }] } : { bookingId: id };
    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    order.status = (status || 'pending').toLowerCase();
    await order.save();

    if (req.admin) {
      await logAuditEvent({
        adminId: req.admin._id,
        username: req.admin.username,
        action: 'UPDATE_ORDER_STATUS',
        req,
        targetId: order.bookingId,
        details: { status: order.status }
      });
    }

    return res.json({ success: true, message: 'Order status updated', data: formatOrder(order) });
  } catch (error) {
    next(error);
  }
};

export const deleteOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid order identifier' });
    }

    if (useMemoryStore()) {
      const result = await dataStore.deleteOrder(id);
      if (!result) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      return res.json({ success: true, message: 'Order deleted successfully' });
    }

    const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { bookingId: id }] } : { bookingId: id };
    const orderToDelete = await Order.findOne(query);
    if (!orderToDelete) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const targetBookingId = orderToDelete.bookingId;
    await Order.deleteOne({ _id: orderToDelete._id });

    if (req.admin) {
      await logAuditEvent({
        adminId: req.admin._id,
        username: req.admin.username,
        action: 'DELETE_ORDER',
        req,
        targetId: targetBookingId || id
      });
    }

    return res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    next(error);
  }
};
