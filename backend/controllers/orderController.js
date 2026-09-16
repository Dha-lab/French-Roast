import { dataStore } from '../config/dataStore.js';

// CREATE ORDER / PRE-BOOK REQUEST
export const createOrder = async (req, res, next) => {
  try {
    const { fullName, name, phone, email, address, variant, coffeeType } = req.body;

    const customerName = (fullName || name || '').trim();
    const customerPhone = (phone || '').trim();
    const customerEmail = (email || '').trim().toLowerCase();
    const customerAddress = (address || '').trim();
    const selectedVariant = variant || coffeeType || 'Powder';

    // Validation
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

    const newOrder = await dataStore.createOrder(req.body);
    return res.status(201).json({
      success: true,
      message: newOrder.orderType === 'purchase' ? 'Order placed successfully' : 'Pre-book order request submitted successfully',
      data: newOrder
    });
  } catch (error) {
    next(error);
  }
};

// GET ALL ORDERS (FOR ADMIN & AUDIT)
export const getOrders = async (req, res, next) => {
  try {
    const orders = await dataStore.getOrders();
    return res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    next(error);
  }
};

// GET SINGLE ORDER BY ID OR BOOKING ID
export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await dataStore.getOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    return res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// UPDATE ORDER STATUS (ADMIN)
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await dataStore.updateOrderStatus(id, status);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    return res.json({ success: true, message: 'Order status updated', data: updated });
  } catch (error) {
    next(error);
  }
};

// DELETE ORDER (ADMIN)
export const deleteOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const success = await dataStore.deleteOrder(id);
    if (!success) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    return res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    next(error);
  }
};
