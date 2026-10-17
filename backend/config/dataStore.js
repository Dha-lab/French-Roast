// Modular Data Store Layer (In-Memory)
// Prepared for seamless future MongoDB / Mongoose adapter integration

import { APPROVED_WHOLE_BEAN_RECIPE, APPROVED_POWDER_RECIPE } from './blendConfig.js';

let memoryStore = {
  products: [
    {
      _id: 'prod_french_roast_250g_wholebean',
      id: 'prod_french_roast_250g_wholebean',
      name: 'French Roast',
      variant: 'Whole Bean',
      weight: '250g',
      price: 599,
      stock: 10,
      lowStockThreshold: 10,
      totalSold: 0,
      status: 'available',
      image: '/src/assets/hero-product.jpg',
      description: 'French Roast Coffee — Thoughtfully Roasted, Premium Single Origin Whole Bean Coffee',
      blendSettings: {
        ...APPROVED_WHOLE_BEAN_RECIPE
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  historicalProducts: [
    {
      _id: 'prod_french_roast_250g_powder',
      id: 'prod_french_roast_250g_powder',
      name: 'French Roast',
      variant: 'Powder',
      weight: '250g',
      price: 499,
      stock: 0,
      lowStockThreshold: 10,
      totalSold: 0,
      status: 'discontinued',
      image: '/src/assets/hero-product.jpg',
      description: 'French Roast Coffee — Powder (Historical Record)',
      blendSettings: {
        ...APPROVED_POWDER_RECIPE
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  orders: [],
  taxSettings: {
    gstRate: 5,
    cgstRate: 2.5,
    sgstRate: 2.5,
    currency: 'INR'
  }
};

export const dataStore = {
  getProducts: async () => {
    return memoryStore.products.map(p => ({
      ...p,
      status: p.stock > 0 ? 'available' : 'sold_out'
    }));
  },

  getProductById: async (id) => {
    let product = memoryStore.products.find(
      p => p._id === id || p.id === id || p.name.toLowerCase() === (id || '').toLowerCase()
    );
    if (!product && memoryStore.historicalProducts) {
      product = memoryStore.historicalProducts.find(
        p => p._id === id || p.id === id || p.variant.toLowerCase() === (id || '').toLowerCase()
      );
    }
    if (product) {
      product.status = product.stock > 0 ? 'available' : (product.status || 'sold_out');
    }
    return product || null;
  },

  createProduct: async (productData) => {
    const stockVal = Number(productData.stock) || 0;
    const newProduct = {
      _id: `prod_${Date.now()}`,
      id: `prod_${Date.now()}`,
      name: productData.name || 'French Roast',
      variant: productData.variant || 'Whole Bean',
      weight: productData.weight || '250g',
      price: Number(productData.price) || 599,
      stock: stockVal,
      status: stockVal > 0 ? 'available' : 'sold_out',
      image: productData.image || '/src/assets/hero-product.jpg',
      description: productData.description || 'French Roast Coffee — Whole Bean',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    memoryStore.products.unshift(newProduct);
    return newProduct;
  },

  updateProduct: async (id, updateData) => {
    let index = memoryStore.products.findIndex(
      p => p._id === id || p.id === id || p.name.toLowerCase() === (id || '').toLowerCase()
    );
    if (index === -1) index = 0;

    const p = memoryStore.products[index];
    if (!p) return null;

    if (updateData.name !== undefined) p.name = updateData.name;
    if (updateData.variant !== undefined) p.variant = updateData.variant;
    if (updateData.weight !== undefined) p.weight = updateData.weight;
    if (updateData.price !== undefined) p.price = Number(updateData.price);
    if (updateData.stock !== undefined) {
      p.stock = Math.max(0, Number(updateData.stock));
      p.status = p.stock > 0 ? 'available' : 'sold_out';
    }
    if (updateData.image !== undefined) p.image = updateData.image;
    if (updateData.description !== undefined) p.description = updateData.description;
    p.updatedAt = new Date().toISOString();

    return p;
  },

  deleteProduct: async (id) => {
    const initialLen = memoryStore.products.length;
    memoryStore.products = memoryStore.products.filter(p => p._id !== id && p.id !== id);
    return memoryStore.products.length < initialLen;
  },

  getOrders: async () => {
    return [...memoryStore.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getOrderById: async (id) => {
    return memoryStore.orders.find(o => o.bookingId === id || o._id === id) || null;
  },

  createOrder: async (orderData) => {
    const bookingId = `FR-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
    const normalizedStatus = (orderData.status || 'Pending').toString();
    const variant = orderData.variant || orderData.coffeeType || 'Whole Bean';
    if (variant === 'Powder') {
      throw new Error('Powder is discontinued and no longer available for orders. Whole Bean is the only available product.');
    }
    const quantity = Math.max(1, Number(orderData.quantity) || 1);

    // Check available stock in memoryStore
    const prod = memoryStore.products.find(p => p.variant === variant) || memoryStore.products[0];
    const availableStock = prod ? (typeof prod.stock === 'number' ? prod.stock : 0) : 0;
    const isWaiting = availableStock < quantity || availableStock <= 0 || orderData.status === 'waiting' || orderData.isWaitingPreorder;

    if (!isWaiting) {
      // Deduct stock in memoryStore for in-stock orders
      if (prod) {
        prod.stock = Math.max(0, prod.stock - quantity);
        prod.totalSold = (prod.totalSold || 0) + quantity;
        prod.status = prod.stock > 0 ? 'available' : 'sold_out';
      }
    }
    
    // Find matching product price in memoryStore (Whole Bean ₹599)
    const unitPrice = prod && typeof prod.price === 'number' ? prod.price : 599;
    const itemTotal = unitPrice * quantity;
    
    const tax = memoryStore.taxSettings || { gstRate: 5, cgstRate: 2.5, sgstRate: 2.5 };
    const gRate = Math.max(0, Number(tax.gstRate) || 0);
    const cRate = Math.max(0, Number(tax.cgstRate) || 0);
    const sRate = Math.max(0, gRate - cRate);

    const roundCurrency = (val) => Math.round((Number(val) || 0) * 100) / 100;
    const subtotal = roundCurrency(unitPrice * quantity);
    const taxableUnitValue = roundCurrency(unitPrice / (1 + gRate / 100));
    const gstUnitAmount = roundCurrency(unitPrice - taxableUnitValue);
    const cgstUnitAmount = roundCurrency(taxableUnitValue * cRate / 100);
    const sgstUnitAmount = roundCurrency(taxableUnitValue * sRate / 100);
    const gstAmount = roundCurrency(gstUnitAmount * quantity);
    const cgstAmount = roundCurrency(cgstUnitAmount * quantity);
    const sgstAmount = roundCurrency(sgstUnitAmount * quantity);

    const newOrder = {
      _id: `ord_${Date.now()}`,
      bookingId,
      fullName: orderData.fullName || orderData.name,
      name: orderData.fullName || orderData.name,
      phone: orderData.phone,
      email: orderData.email,
      address: orderData.address,
      product: orderData.product || 'French Roast',
      variant,
      coffeeType: variant,
      weight: orderData.weight || orderData.packSize || '250g',
      packSize: orderData.weight || orderData.packSize || '250g',
      quantity,
      unitPrice,
      price: unitPrice,
      itemTotal,
      subtotal,
      gstRate: gRate,
      gstAmount,
      cgstRate: cRate,
      cgstAmount,
      sgstRate: sRate,
      sgstAmount,
      deliveryCharge: 0,
      finalTotal: subtotal,
      currency: 'INR',
      orderType: orderData.orderType || 'preorder',
      paymentMode: isWaiting ? 'none' : (orderData.paymentMode || 'test'),
      paymentStatus: isWaiting ? 'unpaid' : (orderData.paymentStatus || 'simulated_success'),
      status: isWaiting ? 'waiting' : normalizedStatus,
      notes: orderData.notes || '',
      blend: orderData.blend || null,
      confirmationEmailSent: Boolean(orderData.confirmationEmailSent),
      confirmationEmailSentAt: orderData.confirmationEmailSentAt || null,
      confirmationEmailMessageId: orderData.confirmationEmailMessageId || null,
      confirmationEmailError: orderData.confirmationEmailError || null,
      waitingConfirmationEmailSent: Boolean(orderData.waitingConfirmationEmailSent),
      waitingConfirmationEmailSentAt: orderData.waitingConfirmationEmailSentAt || null,
      waitingConfirmationEmailMessageId: orderData.waitingConfirmationEmailMessageId || null,
      waitingConfirmationEmailError: orderData.waitingConfirmationEmailError || null,
      smsConfirmationSent: Boolean(orderData.smsConfirmationSent),
      smsSentAt: orderData.smsSentAt || null,
      smsMessageId: orderData.smsMessageId || null,
      smsError: orderData.smsError || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    memoryStore.orders.unshift(newOrder);
    return newOrder;
  },

  updateOrderStatus: async (id, status) => {
    const order = memoryStore.orders.find(o => o.bookingId === id || o._id === id);
    if (!order) return null;
    order.status = (status || 'Pending').toString();
    order.updatedAt = new Date().toISOString();
    return order;
  },

  deleteOrder: async (id) => {
    const initialLen = memoryStore.orders.length;
    memoryStore.orders = memoryStore.orders.filter(o => o.bookingId !== id && o._id !== id);
    return memoryStore.orders.length < initialLen;
  },

  getTaxSettings: async () => {
    if (!memoryStore.taxSettings) {
      memoryStore.taxSettings = { gstRate: 5, cgstRate: 2.5, sgstRate: 2.5, currency: 'INR' };
    }
    return { ...memoryStore.taxSettings };
  },

  updateTaxSettings: async (gstRate, cgstRate) => {
    const roundCurrency = (val) => Math.round((Number(val) || 0) * 100) / 100;
    const gRate = roundCurrency(gstRate);
    const cRate = roundCurrency(cgstRate);
    const sRate = roundCurrency(gRate - cRate);

    memoryStore.taxSettings = {
      gstRate: gRate,
      cgstRate: cRate,
      sgstRate: sRate,
      currency: 'INR'
    };
    return { ...memoryStore.taxSettings };
  },

  getBlendSettings: async () => {
    const wholeBean = memoryStore.products.find(p => p.variant === 'Whole Bean');
    if (wholeBean && wholeBean.blendSettings) {
      return { ...wholeBean.blendSettings };
    }
    return {
      ...APPROVED_WHOLE_BEAN_RECIPE
    };
  },

  updateBlendSettings: async (settings) => {
    const wholeBean = memoryStore.products.find(p => p.variant === 'Whole Bean');
    if (!wholeBean) return null;
    if (!wholeBean.blendSettings) {
      wholeBean.blendSettings = {
        ...APPROVED_WHOLE_BEAN_RECIPE
      };
    }
    if (settings.customizationEnabled !== undefined) {
      wholeBean.blendSettings.customizationEnabled = Boolean(settings.customizationEnabled);
    }
    if (settings.packWeight !== undefined) {
      wholeBean.blendSettings.packWeight = Math.max(1, Number(settings.packWeight) || 250);
    }
    if (settings.defaultRobusta !== undefined) {
      const r = Number(settings.defaultRobusta);
      if (r > 20) throw new Error('Robusta percentage cannot exceed 20%.');
      if (r < 0) throw new Error('Robusta percentage cannot be negative.');
      wholeBean.blendSettings.defaultRobusta = r;
    }
    if (settings.maxRobusta !== undefined) {
      const mr = Number(settings.maxRobusta);
      if (mr > 20) throw new Error('Robusta percentage cannot exceed 20%.');
      wholeBean.blendSettings.maxRobusta = mr;
    }
    if (settings.defaultArabica !== undefined) {
      const a = Number(settings.defaultArabica);
      if (a < 80) throw new Error('Arabica percentage must be at least 80%.');
      if (a > 100) throw new Error('Arabica percentage cannot exceed 100%.');
      wholeBean.blendSettings.defaultArabica = a;
    }
    if (settings.minArabica !== undefined) {
      const ma = Number(settings.minArabica);
      if (ma < 80) throw new Error('Arabica percentage must be at least 80%.');
      wholeBean.blendSettings.minArabica = ma;
    }
    wholeBean.blendSettings.defaultChicory = 0;
    wholeBean.blendSettings.minChicory = 0;
    wholeBean.blendSettings.maxChicory = 0;
    if (settings.maxArabica !== undefined) {
      wholeBean.blendSettings.maxArabica = Math.max(80, Math.min(100, Number(settings.maxArabica)));
    }
    if (settings.minRobusta !== undefined) {
      wholeBean.blendSettings.minRobusta = Math.max(0, Math.min(20, Number(settings.minRobusta)));
    }
    if (settings.step !== undefined) {
      wholeBean.blendSettings.step = Math.max(1, Math.min(5, Number(settings.step)));
    }
    if (settings.productType !== undefined) {
      wholeBean.blendSettings.productType = String(settings.productType);
    }
    wholeBean.blendSettings.version = (wholeBean.blendSettings.version || 1) + 1;
    wholeBean.updatedAt = new Date().toISOString();
    return { ...wholeBean.blendSettings };
  }
};
