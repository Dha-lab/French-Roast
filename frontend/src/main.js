import './style.css';

document.addEventListener('DOMContentLoaded', () => {

  // ===================================================
  // 1. PRODUCT AVAILABILITY STATE & VARIANT SELECTION
  // ===================================================
  // ===================================================
  // 1. PRODUCT AVAILABILITY STATE & API SOURCE OF TRUTH
  // ===================================================
  let currentProduct = {
    id: 'french-roast-250g',
    name: 'French Roast Coffee',
    packSize: '250g',
    stock: 10
  };
  let selectedHeroType = 'Powder'; // Selected variant: 'Powder' or 'Whole Bean'
  const heroVariantPrice = document.getElementById('hero-variant-price');

  let productPrices = {
    'Powder': 499,
    'Whole Bean': 599
  };

  function updatePriceDisplay() {
    const price = productPrices[selectedHeroType] || (selectedHeroType === 'Whole Bean' ? 599 : 499);
    if (heroVariantPrice) {
      heroVariantPrice.textContent = `₹${price}`;
    }
  }

  // Cart State (stored in memory & localStorage)
  let cartItem = JSON.parse(localStorage.getItem('french_roast_cart') || 'null');

  const btnPowder = document.getElementById('btn-powder');
  const btnWholeBean = document.getElementById('btn-whole-bean');
  const heroMainCta = document.getElementById('hero-main-cta');
  const heroCtaText = document.getElementById('hero-cta-text');
  const heroAvailabilityBadge = document.getElementById('hero-availability-badge');
  const btnToggleStock = document.getElementById('btn-toggle-stock');

  // Header Cart Badge & Button
  const cartBadge = document.getElementById('cart-count-badge');
  const headerCartBtn = cartBadge ? cartBadge.closest('button') : null;

  const API_URL = (import.meta.env.VITE_API_URL || 'https://french-roast-backend.onrender.com').replace(/\/+$/, '');

  // Helper to determine if product is available based on stock count
  function getIsAvailable(prod) {
    if (!prod) return false;
    const stockVal = typeof prod.stock === 'number' ? prod.stock : (typeof prod.quantity === 'number' ? prod.quantity : (typeof prod.inventory === 'number' ? prod.inventory : 0));
    return stockVal > 0;
  }

  // 2. HERO VARIANT SELECTOR EVENT LISTENERS
  if (btnPowder && btnWholeBean) {
    btnPowder.addEventListener('click', () => {
      selectedHeroType = 'Powder';
      btnPowder.className = "flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-full bg-[#18140f] border-2 border-[#d4af37] text-[#f4efe6] font-semibold text-xs tracking-wider shadow-[0_0_16px_rgba(212,175,55,0.25)] transition-none cursor-pointer";
      btnPowder.querySelector('svg').setAttribute('stroke', '#d4af37');

      btnWholeBean.className = "flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-full bg-[#0d0c0a] border border-[#4a3d2b] text-[#a8a196] font-medium text-xs tracking-wider hover:border-[#6e583d] transition-none cursor-pointer";
      btnWholeBean.querySelector('svg').setAttribute('stroke', '#a8a196');

      updatePriceDisplay();
    });

    btnWholeBean.addEventListener('click', () => {
      selectedHeroType = 'Whole Bean';
      btnWholeBean.className = "flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-full bg-[#18140f] border-2 border-[#d4af37] text-[#f4efe6] font-semibold text-xs tracking-wider shadow-[0_0_16px_rgba(212,175,55,0.25)] transition-none cursor-pointer";
      btnWholeBean.querySelector('svg').setAttribute('stroke', '#d4af37');

      btnPowder.className = "flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-full bg-[#0d0c0a] border border-[#4a3d2b] text-[#a8a196] font-medium text-xs tracking-wider hover:border-[#6e583d] transition-none cursor-pointer";
      btnPowder.querySelector('svg').setAttribute('stroke', '#a8a196');

      updatePriceDisplay();
    });
  }

  // 3. UPDATE AVAILABILITY UI (Permanently Pre-Order Only)
  function updateAvailabilityUI(productData) {
    if (productData) {
      currentProduct = productData;
    }
    // Website is permanently PRE-ORDER ONLY
    if (heroCtaText) heroCtaText.textContent = "PRE-ORDER NOW";
  }

  // Fetch product data from API
  async function fetchProductData() {
    try {
      const res = await fetch(`${API_URL}/api/products`);
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json.data) ? json.data : (json.products || []);
        if (Array.isArray(items) && items.length > 0) {
          items.forEach(p => {
            if (p.variant && p.price) {
              productPrices[p.variant] = p.price;
            }
          });
          updateAvailabilityUI(items[0]);
          updatePriceDisplay();
          return;
        }
      }
    } catch (err) {
      console.warn('Could not fetch product from backend API, using local product state:', err);
    }
    updateAvailabilityUI();
    updatePriceDisplay();
  }

  // Global helper function to set product stock (syncs with backend API)
  window.setProductStock = async function(stockCount) {
    const newStock = Math.max(0, Number(stockCount) || 0);
    currentProduct.stock = newStock;
    currentProduct.status = newStock > 0 ? 'available' : 'sold_out';
    updateAvailabilityUI();

    const prodId = currentProduct._id || currentProduct.id || 'french-roast-250g';
    try {
      await fetch(`${API_URL}/api/products/${prodId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock })
      });
    } catch (err) {
      console.error('Failed to sync stock to API server:', err);
    }
  };

  // Load Product Data on Init
  fetchProductData();
  fetchTaxSettingsData();

  // ===================================================
  // 4. HERO MAIN CTA CLICK HANDLER (PERMANENT PRE-ORDER FLOW)
  // ===================================================
  if (heroMainCta) {
    heroMainCta.addEventListener('click', (e) => {
      e.preventDefault();

      // Check variant selection
      if (!selectedHeroType) {
        showToast('Selection Error', 'Please select Powder or Whole Bean.', true);
        return;
      }

      // PRE-ORDER LOGIC -> Opens Pre-Book Modal with selected variant (Powder or Whole Bean)
      openModal();
    });
  }

  // ===================================================
  // 5. CART SYSTEM & TOAST NOTIFICATION
  // ===================================================
  const toastNotification = document.getElementById('toast-notification');
  const toastTitle = document.getElementById('toast-title');
  const toastDetail = document.getElementById('toast-detail');
  const btnToastViewCart = document.getElementById('btn-toast-view-cart');

  const cartDrawerModal = document.getElementById('cart-drawer-modal');
  const btnCloseCartDrawer = document.getElementById('btn-close-cart-drawer');
  const cartItemCard = document.getElementById('cart-item-card');
  const cartItemDesc = document.getElementById('cart-item-desc');
  const cartEmptyMsg = document.getElementById('cart-empty-msg');
  const btnRemoveCartItem = document.getElementById('btn-remove-cart-item');
  let toastTimer = null;

  function updateCartUI() {
    if (cartItem) {
      if (cartBadge) cartBadge.textContent = "1";
      if (cartItemCard) cartItemCard.classList.remove('hidden');
      if (cartEmptyMsg) cartEmptyMsg.classList.add('hidden');
      if (cartItemDesc) cartItemDesc.textContent = `250g Pack — ${cartItem.variant}`;
    } else {
      if (cartBadge) cartBadge.textContent = "0";
      if (cartItemCard) cartItemCard.classList.add('hidden');
      if (cartEmptyMsg) cartEmptyMsg.classList.remove('hidden');
    }
  }

  function addToCart(variant) {
    if (cartItem) {
      // Quantity max 1 limit error message
      showToast('Limit Reached', 'Only 1 pack can be ordered per order.', true);
      return;
    }

    cartItem = {
      id: 'french-roast-250g',
      name: 'French Roast Coffee',
      packSize: '250g',
      variant: variant,
      quantity: 1
    };

    localStorage.setItem('french_roast_cart', JSON.stringify(cartItem));
    updateCartUI();
    showToast('Added to Cart', `French Roast — 250g — ${variant}`);
  }

  function removeFromCart() {
    cartItem = null;
    localStorage.removeItem('french_roast_cart');
    updateCartUI();
  }

  function showToast(title, detail, isWarning = false) {
    if (!toastNotification) return;
    if (toastTimer) clearTimeout(toastTimer);

    toastTitle.textContent = title;
    toastTitle.className = isWarning ? 'font-bold text-amber-400' : 'font-bold text-[#d4af37]';
    toastDetail.textContent = detail;

    toastNotification.classList.remove('hidden');
    toastNotification.classList.add('flex');

    toastTimer = setTimeout(() => {
      toastNotification.classList.add('hidden');
      toastNotification.classList.remove('flex');
    }, 4500);
  }

  function openCartDrawer() {
    if (!cartDrawerModal) return;
    updateCartUI();
    cartDrawerModal.classList.remove('hidden');
    cartDrawerModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }

  function closeCartDrawer() {
    if (!cartDrawerModal) return;
    cartDrawerModal.classList.add('hidden');
    cartDrawerModal.classList.remove('flex');
    document.body.style.overflow = '';
  }

  if (headerCartBtn) headerCartBtn.addEventListener('click', openCartDrawer);
  if (btnToastViewCart) btnToastViewCart.addEventListener('click', () => {
    toastNotification.classList.add('hidden');
    openCartDrawer();
  });
  if (btnCloseCartDrawer) btnCloseCartDrawer.addEventListener('click', closeCartDrawer);
  if (cartDrawerModal) {
    cartDrawerModal.addEventListener('click', (e) => {
      if (e.target === cartDrawerModal) closeCartDrawer();
    });
  }
  if (btnRemoveCartItem) btnRemoveCartItem.addEventListener('click', removeFromCart);

  updateCartUI();

  // ===================================================
  // 6. PRE-BOOK MODAL CONTROLS (REUSED)
  // ===================================================
  const prebookModal = document.getElementById('prebook-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const headerPrebookBtn = document.querySelectorAll('a[href="#pre-book"]');
  const prebookForm = document.getElementById('prebook-form');
  const formError = document.getElementById('form-error');

  const inputName = document.getElementById('pb-name');
  const inputPhone = document.getElementById('pb-phone');
  const inputEmail = document.getElementById('pb-email');
  const inputAddress = document.getElementById('pb-address');
  const inputPincode = document.getElementById('pb-pincode');
  const pincodeFeedback = document.getElementById('pincode-feedback');
  const inputNotes = document.getElementById('pb-notes');
  const btnTypePowder = document.getElementById('modal-type-powder');
  const btnTypeWholeBean = document.getElementById('modal-type-wholebean');
  const inputPackSize = document.getElementById('pb-packsize');
  const qtyVal = document.getElementById('qty-val');
  const btnQtyMinus = document.getElementById('btn-qty-minus');
  const btnQtyPlus = document.getElementById('btn-qty-plus');
  const btnSubmit = document.getElementById('btn-submit-prebook');

  // Supported Bengaluru PIN Codes Dataset
  const BENGALURU_PINCODES = new Set([
    '560001', '560002', '560003', '560004', '560005', '560006', '560007', '560008', '560009', '560010',
    '560011', '560012', '560013', '560014', '560015', '560016', '560017', '560018', '560019', '560020',
    '560021', '560022', '560023', '560024', '560025', '560026', '560027', '560028', '560029', '560030',
    '560031', '560032', '560033', '560034', '560035', '560036', '560037', '560038', '560039', '560040',
    '560041', '560042', '560043', '560044', '560045', '560046', '560047', '560048', '560049', '560050',
    '560051', '560052', '560053', '560054', '560055', '560056', '560057', '560058', '560059', '560060',
    '560061', '560062', '560063', '560064', '560065', '560066', '560067', '560068', '560069', '560070',
    '560071', '560072', '560073', '560074', '560075', '560076', '560077', '560078', '560079', '560080',
    '560081', '560082', '560083', '560084', '560085', '560086', '560087', '560088', '560089', '560090',
    '560091', '560092', '560093', '560094', '560095', '560096', '560097', '560098', '560099', '560100',
    '560101', '560102', '560103', '560104', '560105', '560106', '560107', '560108', '560109', '560110',
    '560111', '560112', '560113', '560114', '560115', '562106', '562107', '562110', '562125', '562129',
    '562130', '562149', '562157', '562162'
  ]);

  function validatePincodeUI(value) {
    if (!pincodeFeedback) return false;
    const clean = String(value || '').replace(/\D/g, '').slice(0, 6);
    if (inputPincode && inputPincode.value !== clean) {
      inputPincode.value = clean;
    }

    if (clean.length === 0) {
      pincodeFeedback.classList.add('hidden');
      return false;
    }

    pincodeFeedback.classList.remove('hidden');

    if (clean.length < 6) {
      pincodeFeedback.textContent = 'Please enter a valid 6-digit PIN code.';
      pincodeFeedback.className = 'text-[11px] mt-1.5 font-medium text-rose-400';
      return false;
    }

    if (BENGALURU_PINCODES.has(clean)) {
      pincodeFeedback.textContent = '✓ Bengaluru delivery available';
      pincodeFeedback.className = 'text-[11px] mt-1.5 font-medium text-emerald-400';
      return true;
    } else {
      pincodeFeedback.textContent = 'Sorry, French Roast currently delivers only within Bengaluru.';
      pincodeFeedback.className = 'text-[11px] mt-1.5 font-medium text-amber-400';
      return false;
    }
  }

  if (inputPincode) {
    inputPincode.addEventListener('input', (e) => {
      validatePincodeUI(e.target.value);
    });
  }

  let activeTaxSettings = {
    gstRate: 5,
    cgstRate: 2.5,
    sgstRate: 2.5
  };

  async function fetchTaxSettingsData() {
    try {
      const res = await fetch(`${API_URL}/api/tax-settings`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          activeTaxSettings = {
            gstRate: Number(json.data.gstRate) || 5,
            cgstRate: Number(json.data.cgstRate) || 2.5,
            sgstRate: Number(json.data.sgstRate) || 2.5
          };
        }
      }
    } catch (err) {
      console.warn('Could not fetch active tax settings, using defaults:', err);
    }
  }

  const modalVariantName = document.getElementById('modal-variant-name');
  const modalUnitPrice = document.getElementById('modal-unit-price');
  const modalSubtotal = document.getElementById('modal-subtotal');
  const modalCgst = document.getElementById('modal-cgst');
  const modalSgst = document.getElementById('modal-sgst');
  const modalGst = document.getElementById('modal-gst');
  const modalItemTotal = document.getElementById('modal-item-total');

  let currentFormType = 'Powder';
  let currentQty = 1;

  const roundCurrency = (val) => Math.round((Number(val) || 0) * 100) / 100;

  function calculateTotals(unitPrice, qty, customGstRate, customCgstRate) {
    const price = roundCurrency(unitPrice);
    const subtotal = roundCurrency(price * qty);

    const gRate = typeof customGstRate === 'number' ? customGstRate : (activeTaxSettings.gstRate || 5);
    const cRate = typeof customCgstRate === 'number' ? customCgstRate : (activeTaxSettings.cgstRate || 2.5);
    const sRate = Math.max(0, roundCurrency(gRate - cRate));

    const taxableUnit = roundCurrency(price / (1 + gRate / 100));
    const gstUnit = roundCurrency(price - taxableUnit);
    const cgstUnit = roundCurrency(taxableUnit * cRate / 100);
    const sgstUnit = roundCurrency(taxableUnit * sRate / 100);

    const gstAmount = roundCurrency(gstUnit * qty);
    const cgstAmount = roundCurrency(cgstUnit * qty);
    const sgstAmount = roundCurrency(sgstUnit * qty);

    return {
      subtotal,
      gstRate: gRate,
      cgstRate: cRate,
      sgstRate: sRate,
      gstAmount,
      cgstAmount,
      sgstAmount,
      finalTotal: subtotal
    };
  }

  function updateModalPriceDisplay() {
    const unitPrice = productPrices[currentFormType] || (currentFormType === 'Whole Bean' ? 599 : 499);
    const totals = calculateTotals(unitPrice, currentQty);

    if (modalVariantName) modalVariantName.textContent = currentFormType;
    if (modalUnitPrice) modalUnitPrice.textContent = `₹${unitPrice.toFixed(2)}`;
    if (modalSubtotal) modalSubtotal.textContent = `₹${totals.subtotal.toFixed(2)}`;
    if (modalCgst) modalCgst.textContent = `₹${totals.cgstAmount.toFixed(2)}`;
    if (modalSgst) modalSgst.textContent = `₹${totals.sgstAmount.toFixed(2)}`;
    if (modalGst) modalGst.textContent = `₹${totals.gstAmount.toFixed(2)}`;
    if (modalItemTotal) modalItemTotal.textContent = `₹${totals.finalTotal.toFixed(2)}`;

    const labelCgst = document.getElementById('label-modal-cgst');
    const labelSgst = document.getElementById('label-modal-sgst');
    const labelGst = document.getElementById('label-modal-gst');

    if (labelCgst) labelCgst.textContent = `CGST (${totals.cgstRate}%):`;
    if (labelSgst) labelSgst.textContent = `SGST (${totals.sgstRate}%):`;
    if (labelGst) labelGst.textContent = `Total GST (${totals.gstRate}% inclusive):`;
  }

  function openModal() {
    if (!prebookModal) return;
    setModalType(selectedHeroType);
    fetchTaxSettingsData().then(() => updateModalPriceDisplay());
    updateModalPriceDisplay();
    
    document.getElementById('confirmation-card').classList.add('hidden');
    prebookForm.classList.remove('hidden');
    formError.classList.add('hidden');
    if (pincodeFeedback) pincodeFeedback.classList.add('hidden');
    
    prebookModal.classList.remove('hidden');
    prebookModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!prebookModal) return;
    prebookModal.classList.add('hidden');
    prebookModal.classList.remove('flex');
    document.body.style.overflow = '';
  }

  function setModalType(type) {
    currentFormType = type;
    if (type === 'Powder') {
      btnTypePowder.className = "flex-1 py-2.5 px-4 rounded-xl border-2 border-[#d4af37] bg-[#1d1710] text-[#f4efe6] font-semibold text-xs tracking-wider cursor-pointer";
      btnTypeWholeBean.className = "flex-1 py-2.5 px-4 rounded-xl border border-[#3d3326] bg-[#0d0c0a] text-[#a8a196] font-medium text-xs tracking-wider hover:border-[#6e583d]";
    } else {
      btnTypeWholeBean.className = "flex-1 py-2.5 px-4 rounded-xl border-2 border-[#d4af37] bg-[#1d1710] text-[#f4efe6] font-semibold text-xs tracking-wider cursor-pointer";
      btnTypePowder.className = "flex-1 py-2.5 px-4 rounded-xl border border-[#3d3326] bg-[#0d0c0a] text-[#a8a196] font-medium text-xs tracking-wider hover:border-[#6e583d]";
    }
    updateModalPriceDisplay();
  }

  // Header Pre-Book Button handler
  headerPrebookBtn.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  });

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (prebookModal) {
    prebookModal.addEventListener('click', (e) => {
      if (e.target === prebookModal) closeModal();
    });
  }

  if (btnTypePowder) btnTypePowder.addEventListener('click', () => setModalType('Powder'));
  if (btnTypeWholeBean) btnTypeWholeBean.addEventListener('click', () => setModalType('Whole Bean'));

  if (btnQtyMinus) {
    btnQtyMinus.addEventListener('click', () => {
      if (currentQty > 1) {
        currentQty--;
        qtyVal.textContent = currentQty;
        updateModalPriceDisplay();
      }
    });
  }

  if (btnQtyPlus) {
    btnQtyPlus.addEventListener('click', () => {
      currentQty++;
      qtyVal.textContent = currentQty;
      updateModalPriceDisplay();
    });
  }

  // ===================================================
  // REALISTIC TEST PAYMENT GATEWAY INTERFACE MODULE
  // ===================================================
  const testPaymentCard = document.getElementById('test-payment-card');
  const tpVariant = document.getElementById('tp-variant');
  const tpPacksize = document.getElementById('tp-packsize');
  const tpQuantity = document.getElementById('tp-quantity');
  const tpUnitPrice = document.getElementById('tp-unit-price');
  const tpSubtotal = document.getElementById('tp-subtotal');
  const tpCgst = document.getElementById('tp-cgst');
  const tpSgst = document.getElementById('tp-sgst');
  const tpGst = document.getElementById('tp-gst');
  const tpTotal = document.getElementById('tp-total');
  const tpFeedback = document.getElementById('tp-feedback');
  
  const tabPayCard = document.getElementById('tab-pay-card');
  const tabPayUpi = document.getElementById('tab-pay-upi');
  const tabPayNetbank = document.getElementById('tab-pay-netbank');

  const viewPayCard = document.getElementById('view-pay-card');
  const viewPayUpi = document.getElementById('view-pay-upi');
  const viewPayNetbank = document.getElementById('view-pay-netbank');

  const btnPayNow = document.getElementById('btn-pay-now');
  const btnPayNowText = document.getElementById('btn-pay-now-text');
  const btnPayBack = document.getElementById('btn-pay-back');

  let activePayTab = 'card';
  let pendingOrderData = null;

  function setPaymentTab(tab) {
    activePayTab = tab;
    if (tab === 'card') {
      if (tabPayCard) tabPayCard.className = "py-2.5 px-3 rounded-xl border-2 border-[#d4af37] bg-[#1d1710] text-[#f4efe6] font-semibold text-xs flex flex-col items-center gap-1 cursor-pointer transition-all";
      if (tabPayUpi) tabPayUpi.className = "py-2.5 px-3 rounded-xl border border-[#3d3326] bg-[#0d0c0a] text-[#a8a196] font-medium text-xs flex flex-col items-center gap-1 cursor-pointer hover:border-[#6e583d] transition-all";
      if (tabPayNetbank) tabPayNetbank.className = "py-2.5 px-3 rounded-xl border border-[#3d3326] bg-[#0d0c0a] text-[#a8a196] font-medium text-xs flex flex-col items-center gap-1 cursor-pointer hover:border-[#6e583d] transition-all";
      if (viewPayCard) viewPayCard.classList.remove('hidden');
      if (viewPayUpi) viewPayUpi.classList.add('hidden');
      if (viewPayNetbank) viewPayNetbank.classList.add('hidden');
    } else if (tab === 'upi') {
      if (tabPayUpi) tabPayUpi.className = "py-2.5 px-3 rounded-xl border-2 border-[#d4af37] bg-[#1d1710] text-[#f4efe6] font-semibold text-xs flex flex-col items-center gap-1 cursor-pointer transition-all";
      if (tabPayCard) tabPayCard.className = "py-2.5 px-3 rounded-xl border border-[#3d3326] bg-[#0d0c0a] text-[#a8a196] font-medium text-xs flex flex-col items-center gap-1 cursor-pointer hover:border-[#6e583d] transition-all";
      if (tabPayNetbank) tabPayNetbank.className = "py-2.5 px-3 rounded-xl border border-[#3d3326] bg-[#0d0c0a] text-[#a8a196] font-medium text-xs flex flex-col items-center gap-1 cursor-pointer hover:border-[#6e583d] transition-all";
      if (viewPayUpi) viewPayUpi.classList.remove('hidden');
      if (viewPayCard) viewPayCard.classList.add('hidden');
      if (viewPayNetbank) viewPayNetbank.classList.add('hidden');
    } else if (tab === 'netbank') {
      if (tabPayNetbank) tabPayNetbank.className = "py-2.5 px-3 rounded-xl border-2 border-[#d4af37] bg-[#1d1710] text-[#f4efe6] font-semibold text-xs flex flex-col items-center gap-1 cursor-pointer transition-all";
      if (tabPayCard) tabPayCard.className = "py-2.5 px-3 rounded-xl border border-[#3d3326] bg-[#0d0c0a] text-[#a8a196] font-medium text-xs flex flex-col items-center gap-1 cursor-pointer hover:border-[#6e583d] transition-all";
      if (tabPayUpi) tabPayUpi.className = "py-2.5 px-3 rounded-xl border border-[#3d3326] bg-[#0d0c0a] text-[#a8a196] font-medium text-xs flex flex-col items-center gap-1 cursor-pointer hover:border-[#6e583d] transition-all";
      if (viewPayNetbank) viewPayNetbank.classList.remove('hidden');
      if (viewPayCard) viewPayCard.classList.add('hidden');
      if (viewPayUpi) viewPayUpi.classList.add('hidden');
    }
  }

  if (tabPayCard) tabPayCard.addEventListener('click', () => setPaymentTab('card'));
  if (tabPayUpi) tabPayUpi.addEventListener('click', () => setPaymentTab('upi'));
  if (tabPayNetbank) tabPayNetbank.addEventListener('click', () => setPaymentTab('netbank'));

  function showTestPaymentScreen(orderPayload) {
    pendingOrderData = orderPayload;
    if (prebookForm) prebookForm.classList.add('hidden');
    if (formError) formError.classList.add('hidden');

    const unitPrice = productPrices[orderPayload.variant] || (orderPayload.variant === 'Whole Bean' ? 599 : 499);
    const qty = orderPayload.quantity || 1;
    const totals = calculateTotals(unitPrice, qty);

    if (tpVariant) tpVariant.textContent = orderPayload.variant;
    if (tpPacksize) tpPacksize.textContent = orderPayload.packSize || '250g';
    if (tpQuantity) tpQuantity.textContent = qty;
    if (tpUnitPrice) tpUnitPrice.textContent = `₹${unitPrice.toFixed(2)}`;
    if (tpSubtotal) tpSubtotal.textContent = `₹${totals.subtotal.toFixed(2)}`;
    if (tpCgst) tpCgst.textContent = `₹${totals.cgstAmount.toFixed(2)}`;
    if (tpSgst) tpSgst.textContent = `₹${totals.sgstAmount.toFixed(2)}`;
    if (tpGst) tpGst.textContent = `₹${totals.gstAmount.toFixed(2)}`;
    if (tpTotal) tpTotal.textContent = `₹${totals.finalTotal.toFixed(2)}`;
    if (btnPayNowText) btnPayNowText.textContent = `PAY ₹${totals.finalTotal.toFixed(2)}`;

    const labelCgst = document.getElementById('label-tp-cgst');
    const labelSgst = document.getElementById('label-tp-sgst');
    const labelGst = document.getElementById('label-tp-gst');

    if (labelCgst) labelCgst.textContent = `CGST (${totals.cgstRate}%):`;
    if (labelSgst) labelSgst.textContent = `SGST (${totals.sgstRate}%):`;
    if (labelGst) labelGst.textContent = `Total GST (${totals.gstRate}% inclusive):`;

    if (tpFeedback) {
      tpFeedback.classList.add('hidden');
      tpFeedback.className = 'hidden p-3.5 rounded-xl text-xs font-semibold text-center border';
    }

    if (btnPayNow) {
      btnPayNow.disabled = false;
    }

    setPaymentTab('card');

    if (testPaymentCard) {
      testPaymentCard.classList.remove('hidden');
    }
  }

  function returnToPreorderForm() {
    if (testPaymentCard) testPaymentCard.classList.add('hidden');
    if (prebookForm) prebookForm.classList.remove('hidden');
  }

  if (btnPayBack) {
    btnPayBack.addEventListener('click', returnToPreorderForm);
  }

  // Pre-Order Form Submit Handler -> Validates inputs & Checks Available Stock before displaying Payment Screen
  if (prebookForm) {
    prebookForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (formError) formError.classList.add('hidden');

      const name = inputName.value.trim();
      const phone = inputPhone.value.trim();
      const email = inputEmail.value.trim();
      const address = inputAddress.value.trim();
      const pinCode = inputPincode ? inputPincode.value.replace(/\D/g, '').trim() : '';
      const notes = inputNotes ? inputNotes.value.trim() : '';
      const packSize = inputPackSize ? inputPackSize.value : '250g';
      const inputOptIn = document.getElementById('pb-optin');
      const emailOptIn = inputOptIn ? inputOptIn.checked : false;

      if (!name) {
        showFormError('Please enter your full name');
        return;
      }
      if (!phone || !/^[0-9]{10}$/.test(phone.replace(/[\s-]/g, ''))) {
        showFormError('Please enter a valid 10-digit mobile number');
        return;
      }
      if (!email || !/\S+@\S+\.\S+/.test(email)) {
        showFormError('Please enter a valid email address');
        return;
      }
      if (!address) {
        showFormError('Please enter your delivery location/address');
        return;
      }
      if (!pinCode || pinCode.length !== 6) {
        showFormError('Please enter a valid 6-digit PIN code');
        return;
      }
      if (!BENGALURU_PINCODES.has(pinCode)) {
        showFormError('Sorry, French Roast currently delivers only within Bengaluru.');
        return;
      }

      // Stock check before opening payment screen (re-verifying against backend source of truth)
      try {
        const res = await fetch(`${API_URL}/api/products`);
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json.data) ? json.data : (json.products || []);
          const matchedProduct = items.find(p => p.variant === currentFormType);
          if (matchedProduct) {
            const availStock = typeof matchedProduct.stock === 'number' ? matchedProduct.stock : 0;
            if (availStock <= 0) {
              showFormError('This coffee is currently out of stock.');
              return;
            }
            if (availStock < currentQty) {
              showFormError('Sorry, this quantity is currently unavailable.');
              return;
            }
          }
        }
      } catch (stockErr) {
        console.warn('Could not re-verify product stock prior to payment, using local state:', stockErr);
      }

      showTestPaymentScreen({
        fullName: name,
        name,
        phone,
        email,
        address,
        pinCode,
        pincode: pinCode,
        product: 'French Roast',
        variant: currentFormType,
        coffeeType: currentFormType,
        weight: packSize,
        packSize,
        quantity: currentQty,
        orderType: 'preorder',
        notes,
        emailOptIn
      });
    });
  }

  // REALISTIC TEST PAYMENT BUTTON HANDLER
  if (btnPayNow) {
    btnPayNow.addEventListener('click', async () => {
      if (!pendingOrderData) return;

      btnPayNow.disabled = true;
      const originalText = btnPayNowText ? btnPayNowText.textContent : 'PAY NOW';
      if (btnPayNowText) btnPayNowText.textContent = 'Processing secure test payment...';

      if (tpFeedback) {
        tpFeedback.textContent = '🔒 Processing secure test payment simulation...';
        tpFeedback.className = 'p-3.5 rounded-xl text-xs font-semibold text-center border bg-[#1d1710] border-[#d4af37]/40 text-[#d4af37] block mb-3 animate-pulse';
      }

      // Simulate short gateway network delay (1.2 seconds)
      await new Promise(resolve => setTimeout(resolve, 1200));

      let isFailure = false;
      let failureReason = 'Transaction declined by test sandbox.';

      if (activePayTab === 'card') {
        const cardVal = (document.getElementById('tp-card-num')?.value || '').replace(/\s+/g, '');
        if (cardVal.endsWith('0002') || cardVal.endsWith('9999') || cardVal.toLowerCase().includes('fail') || cardVal.toLowerCase().includes('declin')) {
          isFailure = true;
          failureReason = 'Test Card Declined (Simulated Failure).';
        }
      } else if (activePayTab === 'upi') {
        const upiVal = (document.getElementById('tp-upi-id')?.value || '').trim().toLowerCase();
        if (upiVal.endsWith('fail@upi') || upiVal.includes('fail') || upiVal.includes('declin')) {
          isFailure = true;
          failureReason = 'Test UPI Payment Declined (Simulated Failure).';
        }
      } else if (activePayTab === 'netbank') {
        const bankVal = (document.getElementById('tp-bank-select')?.value || '');
        if (bankVal.includes('Fail') || bankVal.includes('Declined')) {
          isFailure = true;
          failureReason = 'Test Net Banking Payment Failed (Simulated Failure).';
        }
      }

      if (isFailure) {
        if (tpFeedback) {
          tpFeedback.textContent = `✕ TEST PAYMENT FAILED — ${failureReason} Returning to pre-order form...`;
          tpFeedback.className = 'p-3.5 rounded-xl text-xs font-semibold text-center border bg-red-950/80 border-red-500/60 text-red-200 block mb-3 shadow-md';
        }
        
        // Short delay to let user see failure message, then automatically return to pre-order form
        setTimeout(() => {
          returnToPreorderForm();
          if (btnPayNow) btnPayNow.disabled = false;
          if (btnPayNowText) btnPayNowText.textContent = originalText;
        }, 1800);
        return;
      }

      // TEST SUCCESS -> Proceed to create pre-order on backend
      if (tpFeedback) {
        tpFeedback.textContent = '✓ TEST PAYMENT SUCCESSFUL — Creating pre-order reservation...';
        tpFeedback.className = 'p-3.5 rounded-xl text-xs font-semibold text-center border bg-emerald-950/70 border-emerald-500/50 text-emerald-200 block mb-3';
      }

      try {
        const response = await fetch(`${API_URL}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...pendingOrderData,
            paymentMode: 'test',
            paymentStatus: 'simulated_success'
          })
        });

        const data = await response.json();

        if (data.success) {
          if (testPaymentCard) testPaymentCard.classList.add('hidden');
          showConfirmation(data.data);
          prebookForm.reset();
          currentQty = 1;
          qtyVal.textContent = '1';
          pendingOrderData = null;
        } else {
          const errText = data.message || 'Payment simulation failed';
          if (tpFeedback) {
            tpFeedback.textContent = `⚠️ Submission error: ${errText}`;
            tpFeedback.className = 'p-3.5 rounded-xl text-xs font-semibold text-center border bg-red-950/70 border-red-500/50 text-red-200 block mb-3';
          }
          btnPayNow.disabled = false;
          if (btnPayNowText) btnPayNowText.textContent = originalText;

          if (data.code === 'INSUFFICIENT_STOCK' || (data.message && data.message.includes('available'))) {
            setTimeout(() => {
              returnToPreorderForm();
              showFormError(errText);
            }, 1800);
          }
        }
      } catch (err) {
        if (tpFeedback) {
          tpFeedback.textContent = '⚠️ Unable to complete pre-order submission. Please check connection.';
          tpFeedback.className = 'p-3.5 rounded-xl text-xs font-semibold text-center border bg-red-950/70 border-red-500/50 text-red-200 block mb-3';
        }
        btnPayNow.disabled = false;
        if (btnPayNowText) btnPayNowText.textContent = originalText;
      }
    });
  }

  function showFormError(msg) {
    if (formError) {
      formError.textContent = msg;
      formError.classList.remove('hidden');
    }
  }

  function showConfirmation(record) {
    if (prebookForm) prebookForm.classList.add('hidden');
    if (testPaymentCard) testPaymentCard.classList.add('hidden');
    const card = document.getElementById('confirmation-card');
    if (!card) return;

    const variant = record.coffeeType || record.variant || 'Powder';
    const packSize = record.packSize || record.weight || '250g';
    const qty = Math.max(1, Number(record.quantity) || 1);
    const unitPrice = typeof record.unitPrice === 'number' ? record.unitPrice : (productPrices[variant] || (variant === 'Whole Bean' ? 599 : 499));

    const finalTotal = typeof record.finalTotal === 'number' ? record.finalTotal : (typeof record.itemTotal === 'number' ? record.itemTotal : unitPrice * qty);
    const gstRate = typeof record.gstRate === 'number' ? record.gstRate : 5;
    const cgstRate = typeof record.cgstRate === 'number' ? record.cgstRate : 2.5;
    const sgstRate = typeof record.sgstRate === 'number' ? record.sgstRate : (gstRate - cgstRate);

    const gstAmount = typeof record.gstAmount === 'number' ? record.gstAmount : (Math.round((finalTotal - (finalTotal / (1 + gstRate / 100))) * 100) / 100);
    const cgstAmount = typeof record.cgstAmount === 'number' ? record.cgstAmount : (Math.round((gstAmount / 2) * 100) / 100);
    const sgstAmount = typeof record.sgstAmount === 'number' ? record.sgstAmount : (Math.round((gstAmount - cgstAmount) * 100) / 100);
    const taxableAmount = Math.round((finalTotal - gstAmount) * 100) / 100;
    const deliveryCharge = typeof record.deliveryCharge === 'number' ? record.deliveryCharge : 0;

    const rawBookingId = record.bookingId || record._id || 'FR-PENDING';
    const bookingIdStr = rawBookingId.startsWith('#') ? rawBookingId : `#${rawBookingId}`;

    if (document.getElementById('conf-id')) document.getElementById('conf-id').textContent = bookingIdStr;
    if (document.getElementById('conf-name')) document.getElementById('conf-name').textContent = record.fullName || record.name || '-';
    if (document.getElementById('conf-coffee')) document.getElementById('conf-coffee').textContent = variant;
    if (document.getElementById('conf-packsize')) document.getElementById('conf-packsize').textContent = packSize;
    if (document.getElementById('conf-quantity')) document.getElementById('conf-quantity').textContent = qty;
    if (document.getElementById('conf-unit-price')) document.getElementById('conf-unit-price').textContent = `₹${unitPrice.toFixed(2)}`;
    if (document.getElementById('conf-subtotal')) document.getElementById('conf-subtotal').textContent = `₹${taxableAmount.toFixed(2)}`;
    if (document.getElementById('conf-cgst')) document.getElementById('conf-cgst').textContent = `₹${cgstAmount.toFixed(2)}`;
    if (document.getElementById('conf-sgst')) document.getElementById('conf-sgst').textContent = `₹${sgstAmount.toFixed(2)}`;
    if (document.getElementById('conf-gst')) document.getElementById('conf-gst').textContent = `₹${gstAmount.toFixed(2)}`;
    if (document.getElementById('conf-delivery')) document.getElementById('conf-delivery').textContent = deliveryCharge > 0 ? `₹${deliveryCharge.toFixed(2)}` : 'FREE';
    if (document.getElementById('conf-item-total')) document.getElementById('conf-item-total').textContent = `₹${finalTotal.toFixed(2)}`;
    if (document.getElementById('conf-status')) document.getElementById('conf-status').textContent = 'Pre-Order';
    if (document.getElementById('conf-payment')) document.getElementById('conf-payment').textContent = 'TEST PAYMENT — SIMULATED SUCCESS';
    if (document.getElementById('conf-phone')) document.getElementById('conf-phone').textContent = record.phone || '-';

    const labelCgst = document.getElementById('label-conf-cgst');
    const labelSgst = document.getElementById('label-conf-sgst');
    const labelGst = document.getElementById('label-conf-gst');

    if (labelCgst) labelCgst.textContent = `CGST (${cgstRate}%):`;
    if (labelSgst) labelSgst.textContent = `SGST (${sgstRate}%):`;
    if (labelGst) labelGst.textContent = `Total GST (${gstRate}%):`;

    card.classList.remove('hidden');
  }

  function closeModal() {
    if (!prebookModal) return;
    prebookModal.classList.add('hidden');
    prebookModal.classList.remove('flex');
    document.body.style.overflow = '';

    if (testPaymentCard) testPaymentCard.classList.add('hidden');
    const confCard = document.getElementById('confirmation-card');
    if (confCard) confCard.classList.add('hidden');
    if (prebookForm) prebookForm.classList.remove('hidden');
    pendingOrderData = null;
  }

  const btnDone = document.getElementById('btn-conf-done');
  if (btnDone) btnDone.addEventListener('click', closeModal);
});
