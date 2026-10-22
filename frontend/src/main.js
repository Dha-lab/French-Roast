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
  let selectedHeroType = 'Whole Bean'; // Active product is exclusively Whole Bean
  const heroVariantPrice = document.getElementById('hero-variant-price');

  let productPrices = {
    'Whole Bean': 599
  };

  let productStocks = {
    'Whole Bean': 10
  };

  function updatePriceDisplay() {
    const price = productPrices['Whole Bean'] || 599;
    if (heroVariantPrice) {
      heroVariantPrice.textContent = `₹${price}`;
    }
  }

  // Cart State (stored in memory & localStorage)
  let cartItem = JSON.parse(localStorage.getItem('french_roast_cart') || 'null');

  const heroMainCta = document.getElementById('hero-main-cta');
  const heroCtaText = document.getElementById('hero-cta-text');
  const heroAvailabilityBadge = document.getElementById('hero-availability-badge');
  const btnToggleStock = document.getElementById('btn-toggle-stock');

  // Header Cart Badge (safely guarded)
  const cartBadge = document.getElementById('cart-count-badge');

  const API_URL = (import.meta.env.VITE_API_URL || 'https://french-roast-backend.onrender.com').replace(/\/+$/, '');

  // Helper to determine if product is available based on stock count
  function getIsAvailable(prod) {
    if (!prod) return false;
    const stockVal = typeof prod.stock === 'number' ? prod.stock : (typeof prod.quantity === 'number' ? prod.quantity : (typeof prod.inventory === 'number' ? prod.inventory : 0));
    return stockVal > 0;
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
            if (p.variant) {
              if (typeof p.price === 'number') productPrices[p.variant] = p.price;
              if (typeof p.stock === 'number') productStocks[p.variant] = p.stock;
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
  fetchBlendSettings();

  // ===================================================
  // 4. HERO MAIN CTA CLICK HANDLER (SCROLLS TO INLINE PRE-ORDER FORM)
  // ===================================================
  if (heroMainCta) {
    heroMainCta.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToPreorderForm();
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
  // ===================================================
  // 6. PRE-BOOK INLINE FORM CONTROLS
  // ===================================================
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

  let currentFormType = 'Whole Bean';
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
    const unitPrice = productPrices['Whole Bean'] || 599;
    const totals = calculateTotals(unitPrice, currentQty);

    if (modalVariantName) modalVariantName.textContent = 'Whole Bean';
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

    updateModalStockUI();
  }

  const modalStockNotice = document.getElementById('modal-stock-notice');
  const modalStockNoticeText = document.getElementById('modal-stock-notice-text');
  const btnSubmitText = document.getElementById('btn-submit-prebook-text');

  function updateModalStockUI() {
    const availStock = typeof productStocks[currentFormType] === 'number' ? productStocks[currentFormType] : 10;
    const isOutOfStock = availStock <= 0 || availStock < currentQty;

    if (modalStockNotice) {
      if (isOutOfStock) {
        if (availStock <= 0) {
          if (modalStockNoticeText) modalStockNoticeText.textContent = 'Currently out of stock — Submit a waiting pre-order below (no payment required now).';
        } else {
          if (modalStockNoticeText) modalStockNoticeText.textContent = 'Requested quantity exceeds available batch — Submit a waiting pre-order below (no payment required now).';
        }
        modalStockNotice.classList.remove('hidden');
        modalStockNotice.classList.add('flex');
      } else {
        modalStockNotice.classList.add('hidden');
        modalStockNotice.classList.remove('flex');
      }
    }

    if (btnSubmitText) {
      btnSubmitText.textContent = isOutOfStock ? 'JOIN WAITING LIST' : 'CONFIRM PRE-BOOK ORDER';
    }
  }

  // ===================================================
  // 6B. ARABICA & ROBUSTA BLEND SLIDER (WHOLE BEAN EXCLUSIVE)
  // ===================================================
  let blendSettings = {
    customizationEnabled: true,
    packWeight: 250,
    defaultArabica: 80,
    defaultRobusta: 20,
    defaultChicory: 0,
    minArabica: 80,
    maxArabica: 100,
    minRobusta: 0,
    maxRobusta: 20,
    step: 1,
    allowedPresets: ['80/20', '85/15', '90/10', '100/0'],
    productType: 'Whole Bean',
    version: 2
  };

  let currentRobustaPct = 20; // 0% to 20% max
  let currentArabicaPct = 80; // 100% - Robusta% (80% to 100%)

  const blendCard = document.getElementById('blend-customizer-card');
  const blendPackWeightBadge = document.getElementById('blend-pack-weight-badge');
  const blendArabicaPct = document.getElementById('blend-arabica-pct');
  const blendArabicaGrams = document.getElementById('blend-arabica-grams');
  const blendBarArabica = document.getElementById('blend-bar-arabica');
  const blendRobustaPct = document.getElementById('blend-robusta-pct');
  const blendRobustaGrams = document.getElementById('blend-robusta-grams');
  const blendBarRobusta = document.getElementById('blend-bar-robusta');
  const sliderRobustaBadge = document.getElementById('slider-robusta-badge');
  const blendSlider = document.getElementById('blend-slider');
  const blendPresetsContainer = document.getElementById('blend-presets-container');
  const blendSummaryText = document.getElementById('blend-summary-text');
  const blendMultipackSummary = document.getElementById('blend-multipack-summary');
  const blendSummaryQty = document.getElementById('blend-summary-qty');
  const blendSummaryTotalCalc = document.getElementById('blend-summary-total-calc');

  function calculateBlendSnapshot(robustaPct, qty = 1) {
    const packWeight = 250;
    const q = Math.max(1, Number(qty) || 1);
    let rPct = Math.round(Number(robustaPct));
    if (isNaN(rPct)) rPct = 20;
    // Strict clamp: Robusta 0% to 20%
    rPct = Math.max(0, Math.min(20, rPct));
    const aPct = 100 - rPct;

    const aGrams = Math.round(((packWeight * aPct) / 100) * 10) / 10;
    const rGrams = Math.round(((packWeight * rPct) / 100) * 10) / 10;

    return {
      customizationEnabled: true,
      arabicaPercentage: aPct,
      robustaPercentage: rPct,
      chicoryPercentage: 0,
      arabicaGrams: aGrams,
      robustaGrams: rGrams,
      chicoryGrams: 0,
      totalGrams: packWeight,
      totalArabicaGrams: Math.round(aGrams * q * 10) / 10,
      totalRobustaGrams: Math.round(rGrams * q * 10) / 10,
      totalChicoryGrams: 0,
      configurationVersion: 2
    };
  }

  function updateBlendUI() {
    const snapshot = calculateBlendSnapshot(currentRobustaPct, currentQty);
    currentRobustaPct = snapshot.robustaPercentage;
    currentArabicaPct = snapshot.arabicaPercentage;

    if (blendPackWeightBadge) {
      blendPackWeightBadge.textContent = '250g Pack';
    }

    if (blendArabicaPct) blendArabicaPct.textContent = `${snapshot.arabicaPercentage}%`;
    if (blendArabicaGrams) blendArabicaGrams.textContent = `${snapshot.arabicaGrams.toFixed(1)} g`;
    if (blendBarArabica) blendBarArabica.style.width = `${snapshot.arabicaPercentage}%`;

    if (blendRobustaPct) blendRobustaPct.textContent = `${snapshot.robustaPercentage}%`;
    if (blendRobustaGrams) blendRobustaGrams.textContent = `${snapshot.robustaGrams.toFixed(1)} g`;
    if (blendBarRobusta) blendBarRobusta.style.width = `${snapshot.robustaPercentage}%`;

    if (sliderRobustaBadge) {
      sliderRobustaBadge.textContent = `${snapshot.robustaPercentage}%`;
    }

    if (blendSlider && Number(blendSlider.value) !== snapshot.robustaPercentage) {
      blendSlider.value = snapshot.robustaPercentage;
    }

    if (blendSummaryText) {
      blendSummaryText.textContent = `${snapshot.arabicaPercentage}% Arabica (${snapshot.arabicaGrams.toFixed(1)}g) + ${snapshot.robustaPercentage}% Robusta (${snapshot.robustaGrams.toFixed(1)}g) = 250g`;
    }

    if (currentQty > 1) {
      if (blendMultipackSummary) {
        blendMultipackSummary.classList.remove('hidden');
        blendMultipackSummary.classList.add('flex');
      }
      if (blendSummaryQty) blendSummaryQty.textContent = currentQty;
      if (blendSummaryTotalCalc) {
        blendSummaryTotalCalc.textContent = `${snapshot.totalArabicaGrams.toFixed(1)}g Arabica + ${snapshot.totalRobustaGrams.toFixed(1)}g Robusta = ${250 * currentQty}g`;
      }
    } else {
      if (blendMultipackSummary) {
        blendMultipackSummary.classList.add('hidden');
        blendMultipackSummary.classList.remove('flex');
      }
    }

    // Update preset button active states
    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach(btn => {
      const btnRobusta = Number(btn.getAttribute('data-robusta'));
      if (btnRobusta === snapshot.robustaPercentage) {
        btn.className = "preset-btn px-2 py-0.5 rounded text-[9px] font-mono border border-[#d4af37] bg-[#221a10] text-[#d4af37] font-bold transition-all cursor-pointer shadow-sm";
      } else {
        btn.className = "preset-btn px-2 py-0.5 rounded text-[9px] font-mono border border-[#382e22] bg-[#14100c] text-[#a8a196] hover:border-[#6e583d] transition-all cursor-pointer";
      }
    });
  }

  function initPresetButtons() {
    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const robusta = Number(btn.getAttribute('data-robusta'));
        if (!isNaN(robusta)) {
          currentRobustaPct = Math.max(0, Math.min(20, robusta));
          currentArabicaPct = 100 - currentRobustaPct;
          if (blendSlider) blendSlider.value = currentRobustaPct;
          updateBlendUI();
        }
      });
    });
  }

  async function fetchBlendSettings() {
    try {
      const res = await fetch(`${API_URL}/api/products/blend-settings`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          blendSettings = {
            ...blendSettings,
            ...json.data
          };
          if (typeof json.data.defaultRobusta === 'number') {
            currentRobustaPct = Math.max(0, Math.min(20, json.data.defaultRobusta));
            currentArabicaPct = 100 - currentRobustaPct;
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch blend settings, using defaults:', err);
    }
    updateBlendUI();
  }

  if (blendSlider) {
    blendSlider.addEventListener('input', (e) => {
      currentRobustaPct = Math.max(0, Math.min(20, Number(e.target.value) || 0));
      currentArabicaPct = 100 - currentRobustaPct;
      updateBlendUI();
    });
  }

  initPresetButtons();
  updateBlendUI();

  function scrollToPreorderForm() {
    const target = document.getElementById('pre-order-section') || document.getElementById('prebook-form');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const firstInput = document.getElementById('pb-name');
      if (firstInput && window.innerWidth >= 768) {
        setTimeout(() => firstInput.focus(), 300);
      }
    }
  }

  function resetPreorderForm() {
    if (testPaymentCard) testPaymentCard.classList.add('hidden');
    const confCard = document.getElementById('confirmation-card');
    if (confCard) confCard.classList.add('hidden');
    if (prebookForm) {
      prebookForm.reset();
      prebookForm.classList.remove('hidden');
    }
    if (formError) formError.classList.add('hidden');
    if (pincodeFeedback) pincodeFeedback.classList.add('hidden');
    pendingOrderData = null;
    currentQty = 1;
    if (qtyVal) qtyVal.textContent = '1';
    currentRobustaPct = 20;
    currentArabicaPct = 80;
    if (blendSlider) blendSlider.value = 20;
    setModalType('Whole Bean');
    updateModalPriceDisplay();
    updateBlendUI();
    scrollToPreorderForm();
  }

  function setModalType(type) {
    currentFormType = 'Whole Bean';
    selectedHeroType = 'Whole Bean';

    updatePriceDisplay();
    updateModalPriceDisplay();
    updateBlendUI();
  }

  // Header Pre-Book Button handler (scrolls to inline form)
  headerPrebookBtn.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToPreorderForm();
    });
  });

  if (btnQtyMinus) {
    btnQtyMinus.addEventListener('click', () => {
      if (currentQty > 1) {
        currentQty--;
        qtyVal.textContent = currentQty;
        updateModalPriceDisplay();
        updateBlendUI();
      }
    });
  }

  if (btnQtyPlus) {
    btnQtyPlus.addEventListener('click', () => {
      currentQty++;
      qtyVal.textContent = currentQty;
      updateModalPriceDisplay();
      updateBlendUI();
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
    const tpBlendRow = document.getElementById('tp-blend-row');
    const tpBlendVal = document.getElementById('tp-blend-val');
    if (orderPayload.blend) {
      const b = orderPayload.blend;
      if (tpBlendRow) {
        tpBlendRow.classList.remove('hidden');
        tpBlendRow.classList.add('flex');
      }
      if (tpBlendVal) {
        tpBlendVal.textContent = `${b.arabicaPercentage}% Arabica (${b.arabicaGrams}g) / ${b.robustaPercentage}% Robusta (${b.robustaGrams}g)`;
      }
    } else {
      if (tpBlendRow) {
        tpBlendRow.classList.add('hidden');
        tpBlendRow.classList.remove('flex');
      }
    }
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

      // Stock check before proceeding (re-verifying against backend source of truth)
      let availStock = typeof productStocks[currentFormType] === 'number' ? productStocks[currentFormType] : 10;
      try {
        const res = await fetch(`${API_URL}/api/products`);
        if (res.ok) {
          const json = await res.json();
          const items = Array.isArray(json.data) ? json.data : (json.products || []);
          const matchedProduct = items.find(p => p.variant === currentFormType);
          if (matchedProduct) {
            availStock = typeof matchedProduct.stock === 'number' ? matchedProduct.stock : 0;
            productStocks[currentFormType] = availStock;
            if (typeof matchedProduct.price === 'number') productPrices[currentFormType] = matchedProduct.price;
          }
        }
      } catch (stockErr) {
        console.warn('Could not re-verify product stock prior to submission, using local state:', stockErr);
      }

      const isOutOfStock = availStock <= 0 || availStock < currentQty;

      const blendPayload = calculateBlendSnapshot(currentRobustaPct, currentQty);

      // FLOW B: OUT OF STOCK -> WAITING PRE-ORDER (NO PAYMENT, NO PAYMENT SCREEN)
      if (isOutOfStock) {
        const originalBtnText = btnSubmitText ? btnSubmitText.textContent : 'JOIN WAITING LIST';
        if (btnSubmit) btnSubmit.disabled = true;
        if (btnSubmitText) btnSubmitText.textContent = 'Submitting waiting pre-order...';

        try {
          const response = await fetch(`${API_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fullName: name,
              name,
              phone,
              email,
              address,
              pinCode,
              pincode: pinCode,
              product: 'French Roast',
              variant: 'Whole Bean',
              coffeeType: 'Whole Bean',
              weight: packSize,
              packSize,
              quantity: currentQty,
              orderType: 'preorder',
              paymentMode: 'none',
              paymentStatus: 'unpaid',
              status: 'waiting',
              isWaitingPreorder: true,
              notes,
              emailOptIn,
              blend: blendPayload,
              arabicaPercentage: blendPayload.arabicaPercentage,
              robustaPercentage: blendPayload.robustaPercentage,
              chicoryPercentage: 0
            })
          });

          const data = await response.json();

          if (data.success) {
            showConfirmation(data.data);
            prebookForm.reset();
            currentQty = 1;
            if (qtyVal) qtyVal.textContent = '1';
            updateModalStockUI();
          } else {
            showFormError(data.message || 'Failed to register waiting pre-order.');
          }
        } catch (err) {
          showFormError('Network error while submitting waiting pre-order. Please check connection.');
        } finally {
          if (btnSubmit) btnSubmit.disabled = false;
          if (btnSubmitText) btnSubmitText.textContent = originalBtnText;
        }
        return;
      }

      // FLOW A: IN STOCK -> PROCEED TO TEST PAYMENT SCREEN
      showTestPaymentScreen({
        fullName: name,
        name,
        phone,
        email,
        address,
        pinCode,
        pincode: pinCode,
        product: 'French Roast',
        variant: 'Whole Bean',
        coffeeType: 'Whole Bean',
        weight: packSize,
        packSize,
        quantity: currentQty,
        orderType: 'preorder',
        notes,
        emailOptIn,
        blend: blendPayload,
        arabicaPercentage: blendPayload.arabicaPercentage,
        robustaPercentage: blendPayload.robustaPercentage,
        chicoryPercentage: 0
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

    const variant = record.coffeeType || record.variant || 'Whole Bean';
    const packSize = record.packSize || record.weight || '250g';
    const qty = Math.max(1, Number(record.quantity) || 1);
    const unitPrice = typeof record.unitPrice === 'number' ? record.unitPrice : (productPrices[variant] || 599);

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
    const confBlendRow = document.getElementById('conf-blend-row');
    const confBlendVal = document.getElementById('conf-blend-val');
    if (record.blend) {
      const b = record.blend;
      if (confBlendRow) {
        confBlendRow.classList.remove('hidden');
        confBlendRow.classList.add('flex');
      }
      if (confBlendVal) {
        confBlendVal.textContent = `${b.arabicaPercentage}% Arabica / ${b.robustaPercentage}% Robusta (${b.arabicaGrams}g / ${b.robustaGrams}g)`;
      }
    } else {
      if (confBlendRow) {
        confBlendRow.classList.add('hidden');
        confBlendRow.classList.remove('flex');
      }
    }
    if (document.getElementById('conf-packsize')) document.getElementById('conf-packsize').textContent = packSize;
    if (document.getElementById('conf-quantity')) document.getElementById('conf-quantity').textContent = qty;
    if (document.getElementById('conf-unit-price')) document.getElementById('conf-unit-price').textContent = `₹${unitPrice.toFixed(2)}`;
    if (document.getElementById('conf-subtotal')) document.getElementById('conf-subtotal').textContent = `₹${taxableAmount.toFixed(2)}`;
    if (document.getElementById('conf-cgst')) document.getElementById('conf-cgst').textContent = `₹${cgstAmount.toFixed(2)}`;
    if (document.getElementById('conf-sgst')) document.getElementById('conf-sgst').textContent = `₹${sgstAmount.toFixed(2)}`;
    if (document.getElementById('conf-gst')) document.getElementById('conf-gst').textContent = `₹${gstAmount.toFixed(2)}`;
    if (document.getElementById('conf-delivery')) document.getElementById('conf-delivery').textContent = deliveryCharge > 0 ? `₹${deliveryCharge.toFixed(2)}` : 'FREE';
    if (document.getElementById('conf-item-total')) document.getElementById('conf-item-total').textContent = `₹${finalTotal.toFixed(2)}`;
    const isWaiting = record.status === 'waiting' || record.paymentMode === 'none' || record.paymentStatus === 'unpaid';

    const confBadge = document.getElementById('conf-badge');
    const confTitle = document.getElementById('conf-title');
    const confStatus = document.getElementById('conf-status');
    const confPayment = document.getElementById('conf-payment');
    const confMessage = document.getElementById('conf-message');

    if (isWaiting) {
      if (confBadge) confBadge.textContent = 'WAITING LIST RESERVATION';
      if (confTitle) confTitle.textContent = 'WAITING PRE-ORDER CONFIRMED';
      if (confStatus) {
        confStatus.textContent = 'Waiting for Stock';
        confStatus.className = 'font-semibold text-amber-400';
      }
      if (confPayment) {
        confPayment.textContent = 'NO PAYMENT REQUIRED (WAITLIST)';
        confPayment.className = 'font-semibold text-amber-300';
      }
      if (confMessage) {
        confMessage.textContent = 'You are on our priority waitlist! As soon as fresh French Roast arrives at our Bengaluru roastery, we will contact you before opening payment and dispatch.';
      }
    } else {
      if (confBadge) confBadge.textContent = 'RESERVATION SUCCESSFUL';
      if (confTitle) confTitle.textContent = 'PRE-BOOKING CONFIRMED';
      if (confStatus) {
        confStatus.textContent = 'Pre-Order';
        confStatus.className = 'font-semibold text-emerald-400';
      }
      if (confPayment) {
        confPayment.textContent = 'TEST PAYMENT — SIMULATED SUCCESS';
        confPayment.className = 'font-semibold text-[#d4af37]';
      }
      if (confMessage) {
        confMessage.textContent = 'Thank you for choosing French Roast! Our Bengaluru roastery team will contact you prior to dispatch.';
      }
    }

    if (document.getElementById('conf-phone')) document.getElementById('conf-phone').textContent = record.phone || '-';

    const labelCgst = document.getElementById('label-conf-cgst');
    const labelSgst = document.getElementById('label-conf-sgst');
    const labelGst = document.getElementById('label-conf-gst');

    if (labelCgst) labelCgst.textContent = `CGST (${cgstRate}%):`;
    if (labelSgst) labelSgst.textContent = `SGST (${sgstRate}%):`;
    if (labelGst) labelGst.textContent = `Total GST (${gstRate}%):`;

    card.classList.remove('hidden');
  }

  const btnDone = document.getElementById('btn-conf-done');
  if (btnDone) btnDone.addEventListener('click', resetPreorderForm);
});
