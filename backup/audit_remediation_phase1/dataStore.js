// Modular Data Store Layer (In-Memory)
// Prepared for seamless future MongoDB / Mongoose adapter integration

let memoryStore = {
  products: [
    {
      _id: 'prod_french_roast_250g_powder',
      id: 'prod_french_roast_250g_powder',
      name: 'French Roast',
      variant: 'Powder',
      weight: '250g',
      price: 499,
      stock: 10,
      lowStockThreshold: 10,
      totalSold: 0,
      status: 'available',
      image: '/src/assets/hero-product.jpg',
      description: 'French Roast Coffee — Thoughtfully Roasted, Premium Single Origin Coffee',
      blendSettings: {
        customizationEnabled: true,
        minArabica: 0,
        maxArabica: 100,
        step: 5,
        defaultArabica: 70,
        allowedPresets: [],
        version: 1
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
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
      description: 'French Roast Coffee — Thoughtfully Roasted, Premium Single Origin Coffee',
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
    const product = memoryStore.products.find(
      p => p._id === id || p.id === id || p.name.toLowerCase() === (id || '').toLowerCase()
    );
    if (product) {
      product.status = product.stock > 0 ? 'available' : 'sold_out';
    }
    return product || null;
  },

  createProduct: async (productData) => {
    const stockVal = Number(productData.stock) || 0;
    const newProduct = {
      _id: `prod_${Date.now()}`,
      id: `prod_${Date.now()}`,
      name: productData.name || 'French Roast',
      variant: productData.variant || 'Powder',
      weight: productData.weight || '250g',
      price: Number(productData.price) || 499,
      stock: stockVal,
      status: stockVal > 0 ? 'available' : 'sold_out',
      image: productData.image || '/src/assets/hero-product.jpg',
      description: productData.description || 'French Roast Coffee',
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
    const variant = orderData.variant || orderData.coffeeType || 'Powder';
    const quantity = Math.max(1, Number(orderData.quantity) || 1);

    // Check available stock in memoryStore
    const prod = memoryStore.products.find(p => p.variant === variant);
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
    
    // Find matching product price in memoryStore
    const unitPrice = prod && typeof prod.price === 'number' ? prod.price : (variant === 'Whole Bean' ? 599 : 499);
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
      confirmationEmailSent: false,
      confirmationEmailSentAt: null,
      waitingConfirmationEmailSent: false,
      waitingConfirmationEmailSentAt: null,
      waitingConfirmationEmailMessageId: null,
      waitingConfirmationEmailError: null,
      smsConfirmationSent: false,
      smsSentAt: null,
      smsMessageId: null,
      smsError: null,
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
    const powder = memoryStore.products.find(p => p.variant === 'Powder');
    if (powder && powder.blendSettings) {
      return { ...powder.blendSettings };
    }
    return {
      customizationEnabled: true,
      packWeight: 250,
      defaultArabica: 75,
      defaultRobusta: 20,
      defaultChicory: 5,
      arabicaAdjustable: true,
      robustaAdjustable: true,
      chicoryAdjustable: false,
      minArabica: 0,
      maxArabica: 95,
      minRobusta: 0,
      maxRobusta: 50,
      minChicory: 0,
      maxChicory: 20,
      step: 5,
      allowedPresets: ['75/20/5', '70/25/5', '65/30/5', '80/15/5'],
      productType: 'Powder',
      version: 1
    };
  },

  updateBlendSettings: async (settings) => {
    const powder = memoryStore.products.find(p => p.variant === 'Powder');
    if (!powder) return null;
    if (!powder.blendSettings) {
      powder.blendSettings = {
        customizationEnabled: true,
        packWeight: 250,
        defaultArabica: 75,
        defaultRobusta: 20,
        defaultChicory: 5,
        arabicaAdjustable: true,
        robustaAdjustable: true,
        chicoryAdjustable: false,
        minArabica: 0,
        maxArabica: 95,
        minRobusta: 0,
        maxRobusta: 50,
        minChicory: 0,
        maxChicory: 20,
        step: 5,
        allowedPresets: ['75/20/5', '70/25/5', '65/30/5', '80/15/5'],
        productType: 'Powder',
        version: 1
      };
    }
    if (settings.customizationEnabled !== undefined) {
      powder.blendSettings.customizationEnabled = Boolean(settings.customizationEnabled);
    }
    if (settings.packWeight !== undefined) {
      powder.blendSettings.packWeight = Math.max(1, Number(settings.packWeight) || 250);
    }
    if (settings.defaultArabica !== undefined) {
      powder.blendSettings.defaultArabica = Math.max(0, Math.min(100, Number(settings.defaultArabica)));
    }
    if (settings.defaultRobusta !== undefined) {
      powder.blendSettings.defaultRobusta = Math.max(0, Math.min(100, Number(settings.defaultRobusta)));
    }
    if (settings.defaultChicory !== undefined) {
      powder.blendSettings.defaultChicory = Math.max(0, Math.min(100, Number(settings.defaultChicory)));
    }
    if (settings.arabicaAdjustable !== undefined) {
      powder.blendSettings.arabicaAdjustable = Boolean(settings.arabicaAdjustable);
    }
    if (settings.robustaAdjustable !== undefined) {
      powder.blendSettings.robustaAdjustable = Boolean(settings.robustaAdjustable);
    }
    if (settings.chicoryAdjustable !== undefined) {
      powder.blendSettings.chicoryAdjustable = Boolean(settings.chicoryAdjustable);
    }
    if (settings.minArabica !== undefined) {
      powder.blendSettings.minArabica = Math.max(0, Math.min(100, Number(settings.minArabica)));
    }
    if (settings.maxArabica !== undefined) {
      powder.blendSettings.maxArabica = Math.max(0, Math.min(100, Number(settings.maxArabica)));
    }
    if (settings.minRobusta !== undefined) {
      powder.blendSettings.minRobusta = Math.max(0, Math.min(100, Number(settings.minRobusta)));
    }
    if (settings.maxRobusta !== undefined) {
      powder.blendSettings.maxRobusta = Math.max(0, Math.min(100, Number(settings.maxRobusta)));
    }
    if (settings.minChicory !== undefined) {
      powder.blendSettings.minChicory = Math.max(0, Math.min(100, Number(settings.minChicory)));
    }
    if (settings.maxChicory !== undefined) {
      powder.blendSettings.maxChicory = Math.max(0, Math.min(100, Number(settings.maxChicory)));
    }
    if (settings.step !== undefined) {
      powder.blendSettings.step = Math.max(1, Math.min(50, Number(settings.step)));
    }
    if (Array.isArray(settings.allowedPresets)) {
      powder.blendSettings.allowedPresets = [...settings.allowedPresets];
    }
    if (settings.productType !== undefined) {
      powder.blendSettings.productType = String(settings.productType);
    }
    powder.blendSettings.version = (powder.blendSettings.version || 1) + 1;
    powder.updatedAt = new Date().toISOString();
    return { ...powder.blendSettings };
  }
};
