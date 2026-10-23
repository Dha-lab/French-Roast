import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import StockHistory from '../models/StockHistory.js';
import NotificationSubscriber from '../models/NotificationSubscriber.js';
import { dataStore } from '../config/dataStore.js';
import { logAuditEvent } from '../utils/auditLogger.js';
import { sendOrderConfirmationEmail, sendWaitingPreorderConfirmationEmail } from '../services/brevoService.js';
import { sendOrderConfirmationSMS } from '../services/smsService.js';
import { validateDeliveryLocation, normalizePincode } from '../config/deliveryAreas.js';
import { fetchActiveTaxSettings } from './taxSettingsController.js';
import { APPROVED_WHOLE_BEAN_RECIPE, APPROVED_POWDER_RECIPE } from '../config/blendConfig.js';

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
  const variant = obj.variant || obj.coffeeType || 'Whole Bean';
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
    blend: (
      obj.blend &&
      typeof obj.blend.arabicaPercentage === 'number' &&
      typeof obj.blend.robustaPercentage === 'number' &&
      !isNaN(obj.blend.arabicaPercentage) &&
      !isNaN(obj.blend.robustaPercentage)
    ) ? { ...obj.blend } : (
      typeof obj.arabicaPercentage === 'number' &&
      typeof obj.robustaPercentage === 'number' &&
      !isNaN(obj.arabicaPercentage) &&
      !isNaN(obj.robustaPercentage)
    ) ? {
      customizationEnabled: obj.customizationEnabled !== undefined ? obj.customizationEnabled : true,
      arabicaPercentage: obj.arabicaPercentage,
      robustaPercentage: obj.robustaPercentage,
      chicoryPercentage: typeof obj.chicoryPercentage === 'number' ? obj.chicoryPercentage : 0,
      arabicaGrams: obj.arabicaGrams,
      robustaGrams: obj.robustaGrams,
      chicoryGrams: obj.chicoryGrams || 0,
      totalGrams: obj.totalGrams || 250,
      totalArabicaGrams: obj.totalArabicaGrams || (obj.arabicaGrams ? obj.arabicaGrams * qty : undefined),
      totalRobustaGrams: obj.totalRobustaGrams || (obj.robustaGrams ? obj.robustaGrams * qty : undefined),
      totalChicoryGrams: obj.totalChicoryGrams || (obj.chicoryGrams ? obj.chicoryGrams * qty : undefined)
    } : null,
    arabicaPercentage: obj.blend?.arabicaPercentage ?? obj.arabicaPercentage,
    robustaPercentage: obj.blend?.robustaPercentage ?? obj.robustaPercentage,
    chicoryPercentage: obj.blend?.chicoryPercentage ?? obj.chicoryPercentage ?? 0,
    confirmationEmailSent: !!obj.confirmationEmailSent,
    confirmationEmailSentAt: obj.confirmationEmailSentAt || null,
    confirmationEmailMessageId: obj.confirmationEmailMessageId || null,
    confirmationEmailError: obj.confirmationEmailError || null,
    waitingConfirmationEmailSent: !!obj.waitingConfirmationEmailSent,
    waitingConfirmationEmailSentAt: obj.waitingConfirmationEmailSentAt || null,
    waitingConfirmationEmailMessageId: obj.waitingConfirmationEmailMessageId || null,
    waitingConfirmationEmailError: obj.waitingConfirmationEmailError || null,
    smsConfirmationSent: !!obj.smsConfirmationSent,
    smsSentAt: obj.smsSentAt || null,
    smsMessageId: obj.smsMessageId || null,
    smsError: obj.smsError || null,
    stockDeducted: obj.stockDeducted !== undefined ? Boolean(obj.stockDeducted) : (obj.status !== 'waiting' && obj.paymentMode !== 'none'),
    stockRestored: Boolean(obj.stockRestored),
    stockRestoredAt: obj.stockRestoredAt || null
  };
};

// Helper to validate and calculate blend snapshot for 250g pack
// Strictly enforces Whole Bean blend rules:
// - Robusta min: 0%, max: 20%
// - Arabica min: 80%, max: 100%
// - Arabica + Robusta must equal exactly 100%
// - Chicory is excluded (0%)
// - Rejects Powder orders
export const validateAndBuildBlendSnapshot = (variant, blendInput, activeBlendSettings, quantity = 1) => {
  if (variant === 'Powder' || (typeof variant === 'string' && variant.toLowerCase() === 'powder')) {
    return {
      valid: false,
      code: 'PRODUCT_DISCONTINUED',
      message: 'Powder is discontinued and no longer available for orders. Whole Bean is the only available product.'
    };
  }

  if (variant !== 'Whole Bean') {
    return {
      valid: false,
      message: 'Valid coffee variant (Whole Bean) is required.'
    };
  }

  const parsedQty = Math.max(1, Number(quantity) || 1);
  const packWeight = 250; // Strictly 250g pack size

  let arabicaPct = 80;
  let robustaPct = 20;

  const hasBlendInput = Boolean(
    blendInput && (
      blendInput.arabicaPercentage !== undefined ||
      blendInput.robustaPercentage !== undefined ||
      blendInput.chicoryPercentage !== undefined ||
      blendInput.arabicaRatio !== undefined ||
      blendInput.robustaRatio !== undefined ||
      typeof blendInput === 'number' ||
      typeof blendInput === 'string' ||
      (typeof blendInput === 'object' && Object.keys(blendInput).length > 0)
    )
  );

  if (hasBlendInput) {
    if (typeof blendInput === 'number') {
      if (blendInput <= 20) {
        robustaPct = blendInput;
        arabicaPct = 100 - robustaPct;
      } else {
        arabicaPct = blendInput;
        robustaPct = 100 - arabicaPct;
      }
    } else if (typeof blendInput === 'string') {
      const parts = blendInput.split('/').map(Number);
      if (parts.length >= 2) {
        arabicaPct = parts[0];
        robustaPct = parts[1];
      } else if (parts.length === 1 && !isNaN(parts[0])) {
        const val = parts[0];
        if (val <= 20) {
          robustaPct = val;
          arabicaPct = 100 - robustaPct;
        } else {
          arabicaPct = val;
          robustaPct = 100 - arabicaPct;
        }
      }
    } else if (typeof blendInput === 'object') {
      if (blendInput.robustaPercentage !== undefined) robustaPct = Number(blendInput.robustaPercentage);
      else if (blendInput.robustaRatio !== undefined) robustaPct = Number(blendInput.robustaRatio);
      else if (blendInput.robusta !== undefined) robustaPct = Number(blendInput.robusta);

      if (blendInput.arabicaPercentage !== undefined) arabicaPct = Number(blendInput.arabicaPercentage);
      else if (blendInput.arabicaRatio !== undefined) arabicaPct = Number(blendInput.arabicaRatio);
      else if (blendInput.arabica !== undefined) arabicaPct = Number(blendInput.arabica);

      // Chicory is strictly excluded from Whole Bean coffee
      if (blendInput.chicoryPercentage !== undefined && Number(blendInput.chicoryPercentage) > 0) {
        return {
          valid: false,
          code: 'CHICORY_NOT_PERMITTED',
          message: 'Chicory is not permitted. Chicory is excluded from the blend. Whole Bean is 100% pure coffee beans.'
        };
      }
    }

    if (robustaPct === undefined || robustaPct === null || isNaN(robustaPct) || !Number.isFinite(robustaPct)) {
      return { valid: false, message: 'Invalid Robusta percentage.' };
    }
    if (arabicaPct === undefined || arabicaPct === null || isNaN(arabicaPct) || !Number.isFinite(arabicaPct)) {
      return { valid: false, message: 'Invalid Arabica percentage.' };
    }

    if (robustaPct < 0) {
      return { valid: false, message: 'Robusta percentage cannot be negative.' };
    }
    if (robustaPct > 20) {
      return { valid: false, message: 'Robusta percentage cannot exceed 20% (maximum limit is 20%).' };
    }

    if (arabicaPct < 80) {
      return { valid: false, message: 'Arabica percentage must be at least 80%.' };
    }
    if (arabicaPct > 100) {
      return { valid: false, message: 'Arabica percentage cannot exceed 100%.' };
    }

    // Proportions must total exactly 100%
    const totalPercentage = Math.round((arabicaPct + robustaPct) * 10) / 10;
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return {
        valid: false,
        message: `Arabica and Robusta percentages must total exactly 100% (currently ${totalPercentage}%: Arabica ${arabicaPct}%, Robusta ${robustaPct}%).`
      };
    }
  }

  // Exact server-calculated gram breakdown for 250g pack:
  const arabicaGrams = Math.round((packWeight * (arabicaPct / 100)) * 10) / 10;
  const robustaGrams = Math.round((packWeight - arabicaGrams) * 10) / 10;
  const chicoryGrams = 0.0;

  return {
    valid: true,
    blend: {
      customizationEnabled: true,
      arabicaPercentage: arabicaPct,
      robustaPercentage: robustaPct,
      chicoryPercentage: 0,
      arabicaGrams,
      robustaGrams,
      chicoryGrams: 0,
      totalGrams: packWeight,
      totalArabicaGrams: Math.round(arabicaGrams * parsedQty * 10) / 10,
      totalRobustaGrams: Math.round(robustaGrams * parsedQty * 10) / 10,
      totalChicoryGrams: 0,
      configurationVersion: activeBlendSettings?.version || APPROVED_WHOLE_BEAN_RECIPE.version || 1
    }
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
    const selectedVariant = variant || coffeeType || 'Whole Bean';
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
    if (selectedVariant === 'Powder' || (variant && variant.toString().toLowerCase() === 'powder') || (coffeeType && coffeeType.toString().toLowerCase() === 'powder')) {
      return res.status(400).json({
        success: false,
        code: 'PRODUCT_DISCONTINUED',
        message: 'Powder is discontinued and no longer available for orders. French Roast is exclusively available as Whole Bean.'
      });
    }
    if (selectedVariant !== 'Whole Bean') {
      return res.status(400).json({ success: false, message: 'Valid coffee variant (Whole Bean) is required' });
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

    // Duplicate submission protection (guards against rapid double-clicks or replayed requests within 30 seconds)
    const duplicateWindowMs = Number(process.env.DUPLICATE_ORDER_WINDOW_MS) || 30 * 1000;
    const duplicateWindow = new Date(Date.now() - duplicateWindowMs);

    if (useMemoryStore()) {
      const orders = await dataStore.getOrders();
      const recentDuplicate = orders.find(o =>
        (o.phone === customerPhone || o.email === customerEmail) &&
        o.variant === selectedVariant &&
        o.quantity === parsedQty &&
        new Date(o.createdAt) >= duplicateWindow
      );
      if (recentDuplicate) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_ORDER',
          message: 'A pre-order with these details was recently received. Please check your confirmation or wait before submitting again.',
          data: formatOrder(recentDuplicate)
        });
      }
    } else {
      const recentDuplicate = await Order.findOne({
        $or: [{ phone: customerPhone }, { email: customerEmail }],
        variant: selectedVariant,
        quantity: parsedQty,
        createdAt: { $gte: duplicateWindow }
      });
      if (recentDuplicate) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_ORDER',
          message: 'A pre-order with these details was recently received. Please check your confirmation or wait before submitting again.',
          data: formatOrder(recentDuplicate)
        });
      }
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

    // Fetch active Whole Bean blend settings for validation & server-side recalculation
    let activeBlendSettings = null;
    if (useMemoryStore()) {
      activeBlendSettings = await dataStore.getBlendSettings();
    } else {
      const wholeBeanProduct = await Product.findOne({ variant: 'Whole Bean' });
      activeBlendSettings = wholeBeanProduct?.blendSettings || null;
    }

    const rawBlendInput = req.body.blend || (
      req.body.arabicaPercentage !== undefined || req.body.robustaPercentage !== undefined
        ? {
            customizationEnabled: true,
            arabicaPercentage: req.body.arabicaPercentage,
            robustaPercentage: req.body.robustaPercentage,
            chicoryPercentage: req.body.chicoryPercentage,
            totalGrams: req.body.totalGrams || req.body.packWeight
          }
        : undefined
    );

    const blendCheck = validateAndBuildBlendSnapshot(
      selectedVariant,
      rawBlendInput,
      activeBlendSettings,
      parsedQty
    );

    if (!blendCheck.valid) {
      return res.status(400).json({
        success: false,
        message: blendCheck.message
      });
    }

    const calculatedBlend = blendCheck.blend;

    if (useMemoryStore()) {
      try {
        const products = await dataStore.getProducts();
        const prod = products.find(p => p.variant === selectedVariant);
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
          blend: calculatedBlend,
          arabicaPercentage: calculatedBlend?.arabicaPercentage,
          robustaPercentage: calculatedBlend?.robustaPercentage,
          chicoryPercentage: calculatedBlend?.chicoryPercentage,
          arabicaGrams: calculatedBlend?.arabicaGrams,
          robustaGrams: calculatedBlend?.robustaGrams,
          chicoryGrams: calculatedBlend?.chicoryGrams,
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
        } else {
          try {
            emailResult = await sendWaitingPreorderConfirmationEmail(newOrder);
          } catch (emailErr) {
            console.warn('⚠️ Waiting pre-order confirmation email failed (memory store):', emailErr.message);
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
      blend: calculatedBlend,
      arabicaPercentage: calculatedBlend?.arabicaPercentage,
      robustaPercentage: calculatedBlend?.robustaPercentage,
      chicoryPercentage: calculatedBlend?.chicoryPercentage,
      arabicaGrams: calculatedBlend?.arabicaGrams,
      robustaGrams: calculatedBlend?.robustaGrams,
      chicoryGrams: calculatedBlend?.chicoryGrams,
      unitPrice,
      itemTotal,
      ...totals,
      orderType: 'preorder',
      paymentMode: isWaitingPreorder ? 'none' : 'test',
      paymentStatus: isWaitingPreorder ? 'unpaid' : 'simulated_success',
      status: isWaitingPreorder ? 'waiting' : 'pending',
      stockDeducted: !isWaitingPreorder,
      stockRestored: false,
      stockRestoredAt: null,
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
    } else {
      // Send waiting-list confirmation email (unconditional for out-of-stock waiting pre-orders)
      try {
        emailResult = await sendWaitingPreorderConfirmationEmail(newOrder);
      } catch (emailErr) {
        console.error(`❌ Waiting pre-order confirmation email error for order ${newOrder.bookingId || newOrder._id}:`, emailErr.message);
        // Order MUST NOT be deleted if email fails
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

    const newStatus = (status || 'pending').toLowerCase();

    if (useMemoryStore()) {
      const order = await dataStore.updateOrderStatus(id, newStatus);
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

    const previousStatus = (order.status || 'pending').toLowerCase();
    const isCancelling = newStatus === 'cancelled';

    // Determine whether this order previously consumed stock:
    const consumedStock = order.stockDeducted === true || (
      order.stockDeducted !== false &&
      previousStatus !== 'waiting' &&
      order.paymentMode !== 'none'
    );

    // Restore stock if and only if transitioning to cancelled for the first time
    if (isCancelling && previousStatus !== 'cancelled' && !order.stockRestored && consumedStock) {
      const restoreQty = Math.max(1, Number(order.quantity) || 1);
      const product = await Product.findOne({ variant: 'Whole Bean' });
      if (!product) {
        return res.status(500).json({
          success: false,
          message: 'Whole Bean product record not found in inventory. Cannot restore stock.'
        });
      }

      const previousStock = product.stock || 0;
      const newStock = previousStock + restoreQty;
      const totalSoldReduction = Math.min(product.totalSold || 0, restoreQty);

      // 1. Atomically restore stock and adjust totalSold on Product
      await Product.updateOne(
        { variant: 'Whole Bean' },
        {
          $inc: { stock: restoreQty, totalSold: -totalSoldReduction }
        }
      );

      // 2. Record StockHistory audit entry
      try {
        await StockHistory.create({
          variant: 'Whole Bean',
          actionType: 'ORDER_RESTORE',
          quantityChange: restoreQty,
          previousStock,
          newStock,
          reason: `Order cancelled (${order.bookingId || order._id})`,
          adminUsername: req.admin?.username || 'Admin'
        });
      } catch (shErr) {
        console.warn('StockHistory logging failed on order cancellation:', shErr.message);
      }

      // 3. Mark order as cancelled and stockRestored: true
      try {
        order.status = 'cancelled';
        order.stockRestored = true;
        order.stockRestoredAt = new Date();
        await order.save();
      } catch (orderSaveErr) {
        // Compensating rollback if saving order fails
        await Product.updateOne(
          { variant: 'Whole Bean' },
          {
            $inc: { stock: -restoreQty, totalSold: totalSoldReduction }
          }
        );
        throw orderSaveErr;
      }
    } else {
      order.status = newStatus;
      await order.save();
    }

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

    const currentStatusLower = (orderToDelete.status || 'pending').toLowerCase();
    const consumedStock = orderToDelete.stockDeducted === true || (
      orderToDelete.stockDeducted !== false &&
      currentStatusLower !== 'waiting' &&
      orderToDelete.paymentMode !== 'none'
    );
    const alreadyRestored = orderToDelete.stockRestored === true || currentStatusLower === 'cancelled';

    let restoreQty = 0;
    let totalSoldReduction = 0;

    // Restore stock if and only if order previously consumed stock and was not yet restored
    if (consumedStock && !alreadyRestored) {
      restoreQty = Math.max(1, Number(orderToDelete.quantity) || 1);
      const product = await Product.findOne({ variant: 'Whole Bean' });
      if (product) {
        const previousStock = product.stock || 0;
        const newStock = previousStock + restoreQty;
        totalSoldReduction = Math.min(product.totalSold || 0, restoreQty);

        await Product.updateOne(
          { variant: 'Whole Bean' },
          {
            $inc: { stock: restoreQty, totalSold: -totalSoldReduction }
          }
        );

        try {
          await StockHistory.create({
            variant: 'Whole Bean',
            actionType: 'ORDER_RESTORE',
            quantityChange: restoreQty,
            previousStock,
            newStock,
            reason: `Order deleted (${orderToDelete.bookingId || orderToDelete._id})`,
            adminUsername: req.admin?.username || 'Admin'
          });
        } catch (shErr) {
          console.warn('StockHistory logging failed on order deletion:', shErr.message);
        }
      }
    }

    const targetBookingId = orderToDelete.bookingId;
    try {
      await Order.deleteOne({ _id: orderToDelete._id });
    } catch (delErr) {
      // Compensating rollback if deleteOne fails
      if (restoreQty > 0) {
        await Product.updateOne(
          { variant: 'Whole Bean' },
          {
            $inc: { stock: -restoreQty, totalSold: totalSoldReduction }
          }
        );
      }
      throw delErr;
    }

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
