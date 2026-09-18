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

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
    });

    btnWholeBean.addEventListener('click', () => {
      selectedHeroType = 'Whole Bean';
      btnWholeBean.className = "flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-full bg-[#18140f] border-2 border-[#d4af37] text-[#f4efe6] font-semibold text-xs tracking-wider shadow-[0_0_16px_rgba(212,175,55,0.25)] transition-none cursor-pointer";
      btnWholeBean.querySelector('svg').setAttribute('stroke', '#d4af37');

      btnPowder.className = "flex-1 flex items-center justify-center gap-2.5 px-6 py-3 rounded-full bg-[#0d0c0a] border border-[#4a3d2b] text-[#a8a196] font-medium text-xs tracking-wider hover:border-[#6e583d] transition-none cursor-pointer";
      btnPowder.querySelector('svg').setAttribute('stroke', '#a8a196');
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
        const prodData = Array.isArray(json.data) ? json.data[0] : json.data;
        if (prodData) {
          updateAvailabilityUI(prodData);
          return;
        }
      }
    } catch (err) {
      console.warn('Could not fetch product from backend API, using local product state:', err);
    }
    updateAvailabilityUI();
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

  let currentFormType = 'Powder';
  let currentQty = 1;

  function openModal() {
    if (!prebookModal) return;
    setModalType(selectedHeroType);
    
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
      }
    });
  }

  if (btnQtyPlus) {
    btnQtyPlus.addEventListener('click', () => {
      currentQty++;
      qtyVal.textContent = currentQty;
    });
  }

  // Form Submit Handler
  if (prebookForm) {
    prebookForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      formError.classList.add('hidden');

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

      btnSubmit.disabled = true;
      btnSubmit.innerHTML = `<span>SUBMITTING REQUEST...</span>`;

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
            variant: currentFormType,
            coffeeType: currentFormType,
            weight: packSize,
            packSize,
            quantity: currentQty,
            orderType: 'preorder',
            notes,
            emailOptIn
          })
        });

        const data = await response.json();

        if (data.success) {
          showConfirmation(data.data);
          prebookForm.reset();
          currentQty = 1;
          qtyVal.textContent = '1';
        } else {
          showFormError(data.message || 'Submission failed.');
        }
      } catch (err) {
        showFormError('Unable to place your pre-order right now. Please check your connection and try again.');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<span>CONFIRM PRE-BOOK ORDER</span>`;
      }
    });
  }

  function showFormError(msg) {
    formError.textContent = msg;
    formError.classList.remove('hidden');
  }

  function showConfirmation(record) {
    prebookForm.classList.add('hidden');
    const card = document.getElementById('confirmation-card');
    
    document.getElementById('conf-id').textContent = `#${record.bookingId}`;
    document.getElementById('conf-name').textContent = record.name;
    document.getElementById('conf-details').textContent = `${record.coffeeType} (${record.packSize || '250g'}) × ${record.quantity} Pack(s)`;
    document.getElementById('conf-phone').textContent = record.phone;

    card.classList.remove('hidden');
  }

  const btnDone = document.getElementById('btn-conf-done');
  if (btnDone) btnDone.addEventListener('click', closeModal);
});
