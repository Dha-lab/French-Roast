import mongoose from 'mongoose';
import Order from '../models/Order.js';
import NotificationSubscriber from '../models/NotificationSubscriber.js';
import { dataStore } from '../config/dataStore.js';
import { logAuditEvent } from '../utils/auditLogger.js';
import { sendOrderConfirmationEmail } from '../services/brevoService.js';
import { validateDeliveryLocation, normalizePincode } from '../config/deliveryAreas.js';

const useMemoryStore = () => !process.env.MONGODB_URI || mongoose.connection.readyState === 0;

// Helper to format order document with backward-compatible fields for legacy UI & Admin panel
const formatOrder = (doc) => {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  return {
    ...obj,
    name: obj.fullName || obj.name,
    coffeeType: obj.variant || obj.coffeeType,
    packSize: obj.weight || obj.packSize,
    status: obj.status || 'Pending',
    pinCode: obj.pinCode || '',
    deliveryArea: obj.deliveryArea || 'Bengaluru',
    confirmationEmailSent: !!obj.confirmationEmailSent,
    confirmationEmailSentAt: obj.confirmationEmailSentAt || null
  };
};

// CREATE ORDER / PRE-BOOK REQUEST
export const createOrder = async (req, res, next) => {
  try {
    const { fullName, name, phone, email, address, pinCode, pincode, pin, variant, coffeeType, weight, packSize, quantity, notes, emailOptIn, notificationOptIn, marketingOptIn, preorderNotificationOptIn, optin } = req.body;

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
          { name: customerName, emailOptIn: true },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (subErr) {
        console.warn('Failed to upsert notification subscriber:', subErr.message);
      }
    }

    if (useMemoryStore()) {
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
        status: 'Pending',
        notes: notes || ''
      });

      // Attempt automatic order confirmation email
      try {
        await sendOrderConfirmationEmail(newOrder);
      } catch (emailErr) {
        console.warn('⚠️ Order confirmation email failed (memory store):', emailErr.message);
      }

      return res.status(201).json({
        success: true,
        message: 'Pre-book order request submitted successfully',
        data: formatOrder(newOrder)
      });
    }

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
      orderType: 'preorder',
      status: 'pending',
      notes: notes || ''
    });

    // 2. Send automatic order confirmation email (unconditional)
    let emailResult = null;
    try {
      emailResult = await sendOrderConfirmationEmail(newOrder);
    } catch (emailErr) {
      console.error('❌ Order confirmation email error:', emailErr.message);
      // Order MUST NOT be deleted if email fails
    }

    const responseData = formatOrder(newOrder);

    return res.status(201).json({
      success: true,
      message: 'Pre-book order request submitted successfully',
      data: responseData,
      emailSent: emailResult ? emailResult.success : false
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
