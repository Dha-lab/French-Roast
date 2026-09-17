// Modular Data Store Layer (In-Memory)
// Prepared for seamless future MongoDB / Mongoose adapter integration

let memoryStore = {
  products: [
    {
      _id: 'prod_french_roast_250g',
      id: 'prod_french_roast_250g',
      name: 'French Roast',
      variant: 'Powder',
      weight: '250g',
      price: 499,
      stock: 10,
      status: 'available',
      image: '/src/assets/hero-product.jpg',
      description: 'French Roast Coffee — Thoughtfully Roasted, Premium Single Origin Coffee',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  orders: []
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
    const newOrder = {
      _id: `ord_${Date.now()}`,
      bookingId,
      fullName: orderData.fullName || orderData.name,
      name: orderData.fullName || orderData.name,
      phone: orderData.phone,
      email: orderData.email,
      address: orderData.address,
      product: orderData.product || 'French Roast',
      variant: orderData.variant || orderData.coffeeType || 'Powder',
      coffeeType: orderData.variant || orderData.coffeeType || 'Powder',
      weight: orderData.weight || orderData.packSize || '250g',
      packSize: orderData.weight || orderData.packSize || '250g',
      quantity: Math.max(1, Number(orderData.quantity) || 1),
      orderType: orderData.orderType || 'preorder',
      status: normalizedStatus,
      notes: orderData.notes || '',
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
  }
};
