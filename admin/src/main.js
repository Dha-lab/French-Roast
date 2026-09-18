import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

  // IN-MEMORY SECURITY STATE
  let accessToken = null;
  let mfaTicket = null;
  let currentAdmin = null;

  let allBookings = [];
  let productData = null;

  // DOM Elements - Auth & UI State
  const loginScreen = document.getElementById('login-screen');
  const loginStep1Form = document.getElementById('login-step1-form');
  const loginStep2Form = document.getElementById('login-step2-form');
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const login2FACode = document.getElementById('login-2fa-code');
  const btnCancel2FA = document.getElementById('btn-cancel-2fa');
  const loginError = document.getElementById('login-error');
  const adminDashboard = document.getElementById('admin-dashboard');

  // Error Banner
  const errorBanner = document.getElementById('dashboard-error-banner');
  const errorText = document.getElementById('dashboard-error-text');
  const btnRetryBackend = document.getElementById('btn-retry-backend');

  // Header & Health Controls
  const btnSecuritySettings = document.getElementById('btn-security-settings');
  const btnAuditLogs = document.getElementById('btn-audit-logs');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnLogout = document.getElementById('btn-logout');
  const textLastSyncTime = document.getElementById('text-last-sync-time');
  const statusBackendDot = document.getElementById('status-backend-dot');
  const statusBackendText = document.getElementById('status-backend-text');
  const statusDbDot = document.getElementById('status-db-dot');
  const statusDbText = document.getElementById('status-db-text');

  // KPI Metrics
  const metricTotal = document.getElementById('metric-total');
  const metricUnits = document.getElementById('metric-units');
  const metricPowder = document.getElementById('metric-powder');
  const metricBeans = document.getElementById('metric-beans');

  // Today's Operations Metrics
  const metricTodayOrders = document.getElementById('metric-today-orders');
  const metricTodayUnits = document.getElementById('metric-today-units');
  const metricTodayPending = document.getElementById('metric-today-pending');

  // Status Overview Counts
  const countStatusPending = document.getElementById('count-status-pending');
  const countStatusConfirmed = document.getElementById('count-status-confirmed');
  const countStatusDelivered = document.getElementById('count-status-delivered');
  const countStatusCancelled = document.getElementById('count-status-cancelled');

  // Coffee Preference Elements
  const prefPowderPct = document.getElementById('pref-powder-pct');
  const prefPowderBar = document.getElementById('pref-powder-bar');
  const prefBeansPct = document.getElementById('pref-beans-pct');
  const prefBeansBar = document.getElementById('pref-beans-bar');
  const prefDataContainer = document.getElementById('pref-data-container');
  const prefEmptyState = document.getElementById('pref-empty-state');

  // Activity Chart Elements
  const activityPeriodSelect = document.getElementById('activity-period-select');
  const activityChartWrapper = document.getElementById('activity-chart-wrapper');
  const activityEmptyState = document.getElementById('activity-empty-state');

  // Recent Orders Elements
  const recentOrdersTbody = document.getElementById('recent-orders-tbody');
  const btnViewAllOrdersLink = document.getElementById('btn-view-all-orders-link');

  // Quick Actions Buttons
  const btnQuickViewAll = document.getElementById('btn-quick-view-all');
  const btnQuickFilterPending = document.getElementById('btn-quick-filter-pending');
  const btnQuickStock = document.getElementById('btn-quick-stock');

  // Full Order Management Table
  const tableBody = document.getElementById('table-body');
  const searchInput = document.getElementById('search-input');
  const statusFilter = document.getElementById('status-filter');
  const btnAdminToggle = document.getElementById('btn-toggle-admin-stock');

  // Modal Elements
  const detailsModal = document.getElementById('order-details-modal');
  const detailsBookingId = document.getElementById('details-booking-id');
  const detailsContent = document.getElementById('order-details-content');
  const btnCloseDetails = document.getElementById('btn-close-details-modal');
  const btnDetailsDone = document.getElementById('btn-details-done');

  // Security Modal Elements
  const securityModal = document.getElementById('security-modal');
  const btnCloseSecurityModal = document.getElementById('btn-close-security-modal');
  const badge2FAStatus = document.getElementById('badge-2fa-status');
  const container2FASetup = document.getElementById('container-2fa-setup');
  const containerRecoveryCodes = document.getElementById('container-recovery-codes');
  const gridRecoveryCodes = document.getElementById('grid-recovery-codes');
  const qrCodeImg = document.getElementById('qr-code-img');
  const text2FASecret = document.getElementById('text-2fa-secret');
  const inputConfirm2FA = document.getElementById('input-confirm-2fa');
  const btnSubmitEnable2FA = document.getElementById('btn-submit-enable-2fa');
  const btnInit2FASetup = document.getElementById('btn-init-2fa-setup');
  const btnDisable2FA = document.getElementById('btn-disable-2fa');
  const btnRegenCodes = document.getElementById('btn-regen-codes');
  const formChangePassword = document.getElementById('form-change-password');

  // Audit Logs Modal
  const auditModal = document.getElementById('audit-modal');
  const btnCloseAuditModal = document.getElementById('btn-close-audit-modal');
  const auditTableBody = document.getElementById('audit-table-body');

  // --- UI STATE SWITCHING ---
  function showLoginStep1() {
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (adminDashboard) adminDashboard.classList.add('hidden');
    if (loginStep1Form) loginStep1Form.classList.remove('hidden');
    if (loginStep2Form) loginStep2Form.classList.add('hidden');
    if (loginPassword) loginPassword.value = '';
    if (login2FACode) login2FACode.value = '';
    mfaTicket = null;
  }

  function showLoginStep2() {
    if (loginStep1Form) loginStep1Form.classList.add('hidden');
    if (loginStep2Form) loginStep2Form.classList.remove('hidden');
    if (login2FACode) login2FACode.focus();
  }

  function showDashboard() {
    if (loginScreen) loginScreen.classList.add('hidden');
    if (adminDashboard) adminDashboard.classList.remove('hidden');
    if (loginError) loginError.classList.add('hidden');
    updateSecurityBadge();
  }

  function showLoginError(msg) {
    if (loginError) {
      loginError.textContent = msg;
      loginError.classList.remove('hidden');
    }
  }

  function updateSecurityBadge() {
    if (!badge2FAStatus) return;
    if (currentAdmin && currentAdmin.twoFactorEnabled) {
      badge2FAStatus.className = 'px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-[#63A87A]/15 text-[#63A87A] border border-[#63A87A]/40';
      badge2FAStatus.textContent = '2FA Enabled';
      if (btnInit2FASetup) btnInit2FASetup.classList.add('hidden');
      if (btnDisable2FA) btnDisable2FA.classList.remove('hidden');
      if (btnRegenCodes) btnRegenCodes.classList.remove('hidden');
    } else {
      badge2FAStatus.className = 'px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-[#C9655C]/15 text-[#C9655C] border border-[#C9655C]/40';
      badge2FAStatus.textContent = '2FA Disabled';
      if (btnInit2FASetup) btnInit2FASetup.classList.remove('hidden');
      if (btnDisable2FA) btnDisable2FA.classList.add('hidden');
      if (btnRegenCodes) btnRegenCodes.classList.add('hidden');
    }
  }

  // --- API FETCH WRAPPER ---
  async function apiFetch(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let res;
    try {
      res = await fetch(url, { ...options, headers, credentials: 'include' });
    } catch (netErr) {
      showDashboardError('Unable to connect to backend server.');
      updateSystemStatus(false, false);
      throw netErr;
    }

    if (res.status === 401 && !url.includes('/api/admin/login') && !url.includes('/api/admin/refresh-token')) {
      const refreshSuccess = await attemptSilentRefresh();
      if (refreshSuccess) {
        headers['Authorization'] = `Bearer ${accessToken}`;
        res = await fetch(url, { ...options, headers, credentials: 'include' });
      } else {
        accessToken = null;
        currentAdmin = null;
        showLoginStep1();
        showLoginError('Session expired. Please log in again.');
        throw new Error('Session expired (401)');
      }
    }

    return res;
  }

  async function attemptSilentRefresh() {
    try {
      const res = await fetch(`${API_URL}/api/admin/refresh-token`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success && data.accessToken) {
        accessToken = data.accessToken;
        return true;
      }
    } catch (e) {
      console.error('Silent refresh failed:', e);
    }
    return false;
  }

  function showDashboardError(msg) {
    if (errorBanner && errorText) {
      errorText.textContent = msg;
      errorBanner.classList.remove('hidden');
    }
  }

  function hideDashboardError() {
    if (errorBanner) errorBanner.classList.add('hidden');
  }

  function updateSystemStatus(backendOk, dbOk) {
    if (textLastSyncTime) {
      textLastSyncTime.textContent = `Last sync: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }

    if (statusBackendDot && statusBackendText) {
      if (backendOk) {
        statusBackendDot.className = 'w-2.5 h-2.5 rounded-full bg-[#63A87A] animate-pulse';
        statusBackendText.textContent = 'Connected';
        statusBackendText.className = 'font-bold text-[#F5EFE6] text-[11px]';
      } else {
        statusBackendDot.className = 'w-2.5 h-2.5 rounded-full bg-[#C9655C]';
        statusBackendText.textContent = 'Disconnected';
        statusBackendText.className = 'font-bold text-[#C9655C] text-[11px]';
      }
    }

    if (statusDbDot && statusDbText) {
      if (dbOk) {
        statusDbDot.className = 'w-2.5 h-2.5 rounded-full bg-[#63A87A] animate-pulse';
        statusDbText.textContent = 'Connected';
        statusDbText.className = 'font-bold text-[#F5EFE6] text-[11px]';
      } else {
        statusDbDot.className = 'w-2.5 h-2.5 rounded-full bg-[#D19A45]';
        statusDbText.textContent = 'Unknown';
        statusDbText.className = 'font-bold text-[#D19A45] text-[11px]';
      }
    }
  }

  // --- HEALTH CHECK ---
  async function checkHealth() {
    try {
      const res = await fetch(`${API_URL}/api/health`);
      const data = await res.json();
      if (data.success) {
        updateSystemStatus(true, true);
        hideDashboardError();
      } else {
        updateSystemStatus(false, false);
      }
    } catch (e) {
      updateSystemStatus(false, false);
    }
  }

  // --- LOGIN STEP 1 HANDLER ---
  if (loginStep1Form) {
    loginStep1Form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = loginUsername ? loginUsername.value.trim() : '';
      const password = loginPassword ? loginPassword.value : '';

      if (!username || !password) {
        showLoginError('Please enter both username and password.');
        return;
      }

      const submitBtn = document.getElementById('btn-login');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Authenticating...';
      }

      try {
        const res = await fetch(`${API_URL}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
          credentials: 'include'
        });

        const data = await res.json();

        if (data.success) {
          if (loginError) loginError.classList.add('hidden');

          if (data.require2FA) {
            mfaTicket = data.mfaTicket;
            showLoginStep2();
          } else {
            accessToken = data.accessToken;
            currentAdmin = data.admin;
            showDashboard();
            fetchBookings();
            fetchProduct();
          }
        } else {
          showLoginError(data.message || 'Invalid credentials.');
        }
      } catch (err) {
        showLoginError(`Failed to connect to backend server at ${API_URL}.`);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Sign In to Operations Dashboard';
        }
      }
    });
  }

  // --- LOGIN STEP 2 HANDLER ---
  if (loginStep2Form) {
    loginStep2Form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = login2FACode ? login2FACode.value.trim() : '';

      if (!code || !mfaTicket) {
        showLoginError('Please enter your 2FA or recovery code.');
        return;
      }

      const verifyBtn = document.getElementById('btn-verify-2fa');
      if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying Code...';
      }

      try {
        const res = await fetch(`${API_URL}/api/admin/verify-2fa`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mfaTicket, code }),
          credentials: 'include'
        });

        const data = await res.json();

        if (data.success && data.accessToken) {
          accessToken = data.accessToken;
          currentAdmin = data.admin;
          showDashboard();
          fetchBookings();
          fetchProduct();
        } else {
          showLoginError(data.message || 'Invalid 2FA code.');
        }
      } catch (err) {
        showLoginError('Failed to verify 2FA code with backend server.');
      } finally {
        if (verifyBtn) {
          verifyBtn.disabled = false;
          verifyBtn.textContent = 'Verify 2FA Code';
        }
      }
    });
  }

  if (btnCancel2FA) {
    btnCancel2FA.addEventListener('click', showLoginStep1);
  }

  // --- LOGOUT HANDLER ---
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await apiFetch(`${API_URL}/api/admin/logout`, { method: 'POST' });
      } catch (e) {}
      accessToken = null;
      currentAdmin = null;
      showLoginStep1();
    });
  }

  // --- DATA FETCHING (PRE-ORDERS & PRODUCTS) ---
  async function fetchBookings() {
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-[#7e766b]">Loading Pre-Book data...</td></tr>`;
    }
    try {
      const res = await apiFetch(`${API_URL}/api/orders`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        allBookings = data.data;
        hideDashboardError();
        updateSystemStatus(true, true);
        renderData();
        renderDashboardAnalytics();
      } else {
        showTableError('Invalid API response structure received from backend.');
      }
    } catch (err) {
      if (err.message && err.message.includes('401')) return;
      console.error('Failed to fetch orders from API:', err);
      showTableError(`Failed to connect to backend server at ${API_URL}.`);
      showDashboardError('Unable to connect to backend server.');
      updateSystemStatus(false, false);
    }
  }

  function showTableError(msg) {
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" class="py-8 px-4 text-center text-red-400 font-medium">
            <div class="max-w-md mx-auto bg-red-950/40 border border-red-500/30 rounded-xl p-4">
              ⚠️ ${escapeHtml(msg)}
            </div>
          </td>
        </tr>
      `;
    }
    if (metricTotal) metricTotal.textContent = '0';
    if (metricUnits) metricUnits.textContent = '0';
    if (metricPowder) metricPowder.textContent = '0';
    if (metricBeans) metricBeans.textContent = '0';
  }

  // --- DASHBOARD ANALYTICS COMPUTATIONS ---
  function renderDashboardAnalytics() {
    // 1. KPI Cards
    const totalCount = allBookings.length;
    const totalUnits = allBookings.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
    const powderCount = allBookings.filter(b => (b.coffeeType || b.variant) === 'Powder').length;
    const beansCount = allBookings.filter(b => (b.coffeeType || b.variant) === 'Whole Bean').length;

    if (metricTotal) metricTotal.textContent = totalCount;
    if (metricUnits) metricUnits.textContent = totalUnits;
    if (metricPowder) metricPowder.textContent = powderCount;
    if (metricBeans) metricBeans.textContent = beansCount;

    // 2. Today's Operations
    const todayStr = new Date().toDateString();
    const todayOrders = allBookings.filter(b => b.createdAt && new Date(b.createdAt).toDateString() === todayStr);
    const todayOrdersCount = todayOrders.length;
    const todayUnitsCount = todayOrders.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
    const todayPendingCount = todayOrders.filter(b => (b.status || 'pending').toLowerCase() === 'pending').length;

    if (metricTodayOrders) metricTodayOrders.textContent = todayOrdersCount;
    if (metricTodayUnits) metricTodayUnits.textContent = todayUnitsCount;
    if (metricTodayPending) metricTodayPending.textContent = todayPendingCount;

    // 3. Status Overview Counts
    const pendingCount = allBookings.filter(b => (b.status || 'pending').toLowerCase() === 'pending').length;
    const confirmedCount = allBookings.filter(b => (b.status || 'pending').toLowerCase() === 'confirmed').length;
    const deliveredCount = allBookings.filter(b => (b.status || 'pending').toLowerCase() === 'delivered').length;
    const cancelledCount = allBookings.filter(b => (b.status || 'pending').toLowerCase() === 'cancelled').length;

    if (countStatusPending) countStatusPending.textContent = pendingCount;
    if (countStatusConfirmed) countStatusConfirmed.textContent = confirmedCount;
    if (countStatusDelivered) countStatusDelivered.textContent = deliveredCount;
    if (countStatusCancelled) countStatusCancelled.textContent = cancelledCount;

    // 4. Coffee Preference Breakdown
    const prefTotal = powderCount + beansCount;
    if (prefTotal > 0) {
      const powderPct = Math.round((powderCount / prefTotal) * 100);
      const beansPct = Math.round((beansCount / prefTotal) * 100);

      if (prefPowderPct) prefPowderPct.textContent = `${powderPct}%`;
      if (prefPowderBar) prefPowderBar.style.width = `${powderPct}%`;
      if (prefBeansPct) prefBeansPct.textContent = `${beansPct}%`;
      if (prefBeansBar) prefBeansBar.style.width = `${beansPct}%`;

      if (prefDataContainer) prefDataContainer.classList.remove('hidden');
      if (prefEmptyState) prefEmptyState.classList.add('hidden');
    } else {
      if (prefDataContainer) prefDataContainer.classList.add('hidden');
      if (prefEmptyState) prefEmptyState.classList.remove('hidden');
    }

    // 5. Recent Pre-Orders List (Top 5 Descending)
    const sortedLatest = [...allBookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
    renderRecentOrders(sortedLatest);

    // 6. Order Activity Chart
    renderActivityChart();
  }

  // --- RENDER RECENT ORDERS TABLE ---
  function renderRecentOrders(latestList) {
    if (!recentOrdersTbody) return;

    if (latestList.length === 0) {
      recentOrdersTbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-[#8c8275]">No pre-orders recorded yet.</td></tr>`;
      return;
    }

    recentOrdersTbody.innerHTML = latestList.map(item => {
      const mongoId = item._id || item.id || item.bookingId;
      const displayBookingId = item.bookingId || mongoId;
      const name = item.name || item.fullName || 'Customer';
      const type = item.coffeeType || item.variant || 'Powder';
      const status = (item.status || 'pending').toLowerCase();
      const dateStr = new Date(item.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' });

      return `
        <tr class="hover:bg-[#14110e] transition-colors">
          <td class="py-2.5 px-2 font-mono text-[#d4af37] font-semibold">${escapeHtml(displayBookingId)}</td>
          <td class="py-2.5 px-2 font-semibold text-[#f4efe6] truncate max-w-[110px]">${escapeHtml(name)}</td>
          <td class="py-2.5 px-2 font-bold text-center">${item.quantity}</td>
          <td class="py-2.5 px-2 text-right">
            <button data-action="recent-view" data-id="${mongoId}" class="text-[#d4af37] hover:text-[#ebd49d] font-semibold uppercase tracking-wider cursor-pointer">
              VIEW
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // --- RENDER ORDER ACTIVITY CHART ---
  function renderActivityChart() {
    if (!activityChartWrapper) return;

    const days = parseInt(activityPeriodSelect ? activityPeriodSelect.value : '7', 10);
    const now = new Date();
    const dayBuckets = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      const label = d.toLocaleDateString([], { day: 'numeric', month: 'short' });

      const count = allBookings.filter(b => b.createdAt && new Date(b.createdAt).toDateString() === dateStr).length;
      dayBuckets.push({ label, count });
    }

    const maxCount = Math.max(...dayBuckets.map(b => b.count), 1);
    const hasData = dayBuckets.some(b => b.count > 0);

    if (!hasData) {
      if (activityChartWrapper) activityChartWrapper.innerHTML = '';
      if (activityEmptyState) activityEmptyState.classList.remove('hidden');
      return;
    }

    if (activityEmptyState) activityEmptyState.classList.add('hidden');

    activityChartWrapper.innerHTML = dayBuckets.map(b => {
      const heightPct = Math.max(Math.round((b.count / maxCount) * 100), 8);
      return `
        <div class="flex-1 flex flex-col items-center gap-1.5 group">
          <span class="text-[9px] font-mono text-[#d4af37] font-bold opacity-0 group-hover:opacity-100 transition-opacity">${b.count}</span>
          <div class="w-full bg-[#18140f] border border-[#2d251a] rounded-t-lg h-28 flex items-end p-1">
            <div class="w-full bg-gradient-to-t from-[#8c6d22] to-[#d4af37] rounded-t transition-all duration-500 group-hover:from-[#a8832a] group-hover:to-[#ebd49d]" style="height: ${heightPct}%"></div>
          </div>
          <span class="text-[9px] font-mono text-[#8c8275] truncate max-w-full">${b.label}</span>
        </div>
      `;
    }).join('');
  }

  if (activityPeriodSelect) {
    activityPeriodSelect.addEventListener('change', renderActivityChart);
  }

  // --- RENDER MAIN ORDER MANAGEMENT TABLE ---
  function renderData() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedFilter = statusFilter ? statusFilter.value.toLowerCase() : 'all';

    const filtered = allBookings.filter(item => {
      const matchesSearch = !query || 
        (item.bookingId && item.bookingId.toLowerCase().includes(query)) ||
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.fullName && item.fullName.toLowerCase().includes(query)) ||
        (item.phone && item.phone.toLowerCase().includes(query)) ||
        (item.email && item.email.toLowerCase().includes(query));

      const itemStatus = (item.status || 'pending').toLowerCase();
      const matchesStatus = selectedFilter === 'all' || itemStatus === selectedFilter;

      return matchesSearch && matchesStatus;
    });

    if (!tableBody) return;

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-[#7e766b]">No matching pre-book records found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = filtered.map(item => {
      const type = item.coffeeType || item.variant || 'Powder';
      const size = item.packSize || item.weight || '250g';
      const currentStatus = (item.status || 'pending').toLowerCase();
      const mongoId = item._id || item.id || item.bookingId;
      const displayBookingId = item.bookingId || mongoId;

      return `
        <tr class="hover:bg-[#211B17] transition-colors">
          <td class="py-3.5 px-4 font-mono text-[#C9A24D] font-semibold">${escapeHtml(displayBookingId)}</td>
          <td class="py-3.5 px-4 font-semibold text-[#F5EFE6]">${escapeHtml(item.name || item.fullName)}</td>
          <td class="py-3.5 px-4">
            <div class="text-[#F5EFE6]">${escapeHtml(item.phone)}</div>
            <div class="text-[10px] text-[#A99E91]">${escapeHtml(item.email)}</div>
          </td>
          <td class="py-3.5 px-4">
            <span class="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${type === 'Powder' ? 'bg-[#C9A24D]/15 text-[#C9A24D] border border-[#C9A24D]/40' : 'bg-[#63A87A]/15 text-[#63A87A] border border-[#63A87A]/40'}">
              ${type} (${size})
            </span>
          </td>
          <td class="py-3.5 px-4 font-bold text-center text-[#F5EFE6]">${item.quantity}</td>
          <td class="py-3.5 px-4 max-w-xs truncate text-[#A99E91]" title="${escapeHtml(item.address)}">${escapeHtml(item.address)}</td>
          <td class="py-3.5 px-4 text-[10px] text-[#A99E91]">${new Date(item.createdAt).toLocaleString()}</td>
          <td class="py-3.5 px-4">
            <select data-action="update-status" data-id="${mongoId}" data-booking-id="${displayBookingId}" class="bg-[#15120F] border border-[#3A2D20] text-[10px] font-semibold rounded px-2 py-1 ${getStatusColor(currentStatus)} focus:outline-none cursor-pointer">
              <option value="pending" ${currentStatus === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="confirmed" ${currentStatus === 'confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="delivered" ${currentStatus === 'delivered' ? 'selected' : ''}>Delivered</option>
              <option value="cancelled" ${currentStatus === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
          <td class="py-3.5 px-4 text-right space-x-2">
            <button data-action="view-details" data-id="${mongoId}" data-booking-id="${displayBookingId}" class="text-[#C9A24D] hover:text-[#E0BD63] font-semibold text-[10px] uppercase tracking-wider cursor-pointer">
              Details
            </button>
            <button data-action="delete-order" data-id="${mongoId}" data-booking-id="${displayBookingId}" class="text-[#C9655C] hover:text-[#C9655C]/80 font-semibold text-[10px] uppercase tracking-wider cursor-pointer">
              Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function getStatusColor(status) {
    if (status === 'confirmed' || status === 'delivered') return 'bg-[#63A87A]/15 text-[#63A87A] border-[#63A87A]/40';
    if (status === 'cancelled') return 'bg-[#C9655C]/15 text-[#C9655C] border-[#C9655C]/40';
    return 'bg-[#D19A45]/15 text-[#D19A45] border-[#D19A45]/40';
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- ORDER ACTIONS (UPDATE STATUS & DELETE) ---
  async function updateStatus(id, newStatus) {
    try {
      const res = await apiFetch(`${API_URL}/api/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        fetchBookings();
      } else {
        alert(data.message || 'Failed to update order status');
      }
    } catch (err) {
      if (err.message && err.message.includes('401')) return;
      alert('Failed to connect to backend server to update status.');
    }
  }

  async function deleteBooking(id, displayBookingId) {
    const label = displayBookingId || id;
    if (!confirm(`Are you sure you want to delete pre-order record #${label}?`)) return;
    try {
      const res = await apiFetch(`${API_URL}/api/orders/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchBookings();
      } else {
        alert(data.message || 'Failed to delete order');
      }
    } catch (err) {
      if (err.message && err.message.includes('401')) return;
      alert('Failed to connect to backend server to delete order.');
    }
  }

  // --- ORDER DETAILS MODAL ---
  function openOrderDetails(bookingId) {
    const order = allBookings.find(b => b.bookingId === bookingId || b._id === bookingId || b.id === bookingId);
    if (!order || !detailsModal) return;

    if (detailsBookingId) detailsBookingId.textContent = `#${order.bookingId}`;

    const type = order.coffeeType || order.variant || 'Powder';
    const size = order.packSize || order.weight || '250g';
    const status = order.status || 'pending';

    if (detailsContent) {
      detailsContent.innerHTML = `
        <div class="bg-[#211B17] border border-[#3A2D20] rounded-2xl p-4 space-y-2.5">
          <div class="flex justify-between border-b border-[#3A2D20] pb-2">
            <span class="text-[#A99E91]">Customer Name:</span>
            <span class="font-semibold text-[#F5EFE6]">${escapeHtml(order.name || order.fullName)}</span>
          </div>
          <div class="flex justify-between border-b border-[#3A2D20] pb-2">
            <span class="text-[#A99E91]">Mobile Phone:</span>
            <span class="font-mono text-[#F5EFE6]">${escapeHtml(order.phone)}</span>
          </div>
          <div class="flex justify-between border-b border-[#3A2D20] pb-2">
            <span class="text-[#A99E91]">Email Address:</span>
            <span class="text-[#F5EFE6]">${escapeHtml(order.email)}</span>
          </div>
          <div class="flex justify-between border-b border-[#3A2D20] pb-2">
            <span class="text-[#A99E91]">Coffee Variant:</span>
            <span class="font-semibold text-[#C9A24D]">${escapeHtml(type)}</span>
          </div>
          <div class="flex justify-between border-b border-[#3A2D20] pb-2">
            <span class="text-[#A99E91]">Pack Size & Qty:</span>
            <span class="font-semibold text-[#F5EFE6]">${escapeHtml(size)} × ${order.quantity} Pack(s)</span>
          </div>
          <div class="flex justify-between border-b border-[#3A2D20] pb-2">
            <span class="text-[#A99E91]">Order Classification:</span>
            <span class="font-mono uppercase text-[#63A87A] font-semibold">${escapeHtml(order.orderType || 'preorder')}</span>
          </div>
          <div class="flex justify-between border-b border-[#3A2D20] pb-2">
            <span class="text-[#A99E91]">Current Status:</span>
            <span class="capitalize font-bold px-2 py-0.5 rounded text-[10px] ${getStatusColor(status)}">${escapeHtml(status)}</span>
          </div>
          <div class="flex justify-between border-b border-[#3A2D20] pb-2">
            <span class="text-[#A99E91]">Date Created:</span>
            <span class="text-[11px] text-[#A99E91]">${new Date(order.createdAt).toLocaleString()}</span>
          </div>
          <div class="flex justify-between border-b border-[#3A2D20] pb-2">
            <span class="text-[#A99E91]">Email Status:</span>
            <span class="font-semibold ${order.confirmationEmailSent ? 'text-[#63A87A]' : 'text-[#D19A45]'}">${order.confirmationEmailSent ? '✅ Sent' : '⚠️ Pending / Not Sent'}</span>
          </div>
        </div>
        <div>
          <span class="block text-[11px] font-semibold text-[#A99E91] uppercase mb-1">Delivery Address &amp; Location:</span>
          <div class="bg-[#211B17] border border-[#3A2D20] rounded-xl p-3 text-xs leading-relaxed text-[#F5EFE6] space-y-1.5">
            <div>${escapeHtml(order.address)}</div>
            <div class="pt-1.5 border-t border-[#3A2D20] flex items-center justify-between text-[11px]">
              <span class="text-[#A99E91]">PIN Code: <strong class="font-mono text-[#C9A24D]">${escapeHtml(order.pinCode || 'N/A')}</strong></span>
              <span class="text-[#A99E91]">Delivery Area: <strong class="text-[#F5EFE6]">${escapeHtml(order.deliveryArea || 'Bengaluru')}</strong></span>
            </div>
          </div>
        </div>
      `;
    }

    detailsModal.classList.remove('hidden');
    detailsModal.classList.add('flex');
  }

  function closeOrderDetails() {
    if (!detailsModal) return;
    detailsModal.classList.add('hidden');
    detailsModal.classList.remove('flex');
  }

  if (btnCloseDetails) btnCloseDetails.addEventListener('click', closeOrderDetails);
  if (btnDetailsDone) btnDetailsDone.addEventListener('click', closeOrderDetails);

  // --- INVENTORY MANAGEMENT ---
  async function fetchProduct() {
    try {
      const res = await apiFetch(`${API_URL}/api/products`);
      const data = await res.json();
      if (data.success && data.data) {
        productData = Array.isArray(data.data) ? data.data[0] : data.data;
        renderStockUI();
      }
    } catch (err) {
      console.error('Failed to fetch product stock:', err);
    }
  }

  function renderStockUI() {
    if (!productData) return;
    const stock = typeof productData.stock === 'number' ? productData.stock : 0;
    const badge = document.getElementById('stock-status-badge');
    const dot = document.getElementById('stock-status-dot');
    const text = document.getElementById('stock-status-text');

    if (stock > 0) {
      if (badge) badge.className = "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#63A87A]/15 text-[#63A87A] border border-[#63A87A]/40 flex items-center gap-2";
      if (dot) dot.className = "w-2 h-2 rounded-full bg-[#63A87A] animate-pulse";
      if (text) text.textContent = `IN STOCK (${stock} Units)`;
      if (btnAdminToggle) btnAdminToggle.textContent = "Set Sold Out (0 Stock)";
    } else {
      if (badge) badge.className = "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#D19A45]/15 text-[#D19A45] border border-[#D19A45]/40 flex items-center gap-2";
      if (dot) dot.className = "w-2 h-2 rounded-full bg-[#D19A45]";
      if (text) text.textContent = "SOLD OUT (0 Units)";
      if (btnAdminToggle) btnAdminToggle.textContent = "Set In Stock (10 Stock)";
    }
  }

  async function setAdminStock(newStock) {
    try {
      const prodId = productData ? (productData._id || productData.id || 'french-roast-250g') : 'french-roast-250g';
      const res = await apiFetch(`${API_URL}/api/products/${prodId}`, {
        method: 'PUT',
        body: JSON.stringify({ stock: newStock })
      });
      const data = await res.json();
      if (data.success) {
        productData = data.data;
        renderStockUI();
      }
    } catch (err) {
      if (err.message && err.message.includes('401')) return;
      alert('Failed to update product stock.');
    }
  }

  // --- SECURITY MODAL & AUDIT LOG HANDLERS ---
  if (btnSecuritySettings) {
    btnSecuritySettings.addEventListener('click', () => {
      updateSecurityBadge();
      if (container2FASetup) container2FASetup.classList.add('hidden');
      if (containerRecoveryCodes) containerRecoveryCodes.classList.add('hidden');
      if (securityModal) {
        securityModal.classList.remove('hidden');
        securityModal.classList.add('flex');
      }
    });
  }

  if (btnCloseSecurityModal && securityModal) {
    btnCloseSecurityModal.addEventListener('click', () => {
      securityModal.classList.add('hidden');
      securityModal.classList.remove('flex');
    });
  }

  if (btnInit2FASetup) {
    btnInit2FASetup.addEventListener('click', async () => {
      try {
        const res = await apiFetch(`${API_URL}/api/admin/setup-2fa`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          if (qrCodeImg) qrCodeImg.src = data.qrCodeUrl;
          if (text2FASecret) text2FASecret.textContent = data.secret;
          if (container2FASetup) container2FASetup.classList.remove('hidden');
        } else {
          alert(data.message || 'Failed to initiate 2FA setup');
        }
      } catch (err) {
        alert('Failed to set up 2FA.');
      }
    });
  }

  if (btnSubmitEnable2FA) {
    btnSubmitEnable2FA.addEventListener('click', async () => {
      const code = inputConfirm2FA ? inputConfirm2FA.value.trim() : '';
      if (!code) {
        alert('Please enter the 6-digit code from your authenticator app.');
        return;
      }

      try {
        const res = await apiFetch(`${API_URL}/api/admin/enable-2fa`, {
          method: 'POST',
          body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.recoveryCodes)) {
          if (currentAdmin) currentAdmin.twoFactorEnabled = true;
          updateSecurityBadge();
          if (container2FASetup) container2FASetup.classList.add('hidden');
          
          if (gridRecoveryCodes) {
            gridRecoveryCodes.innerHTML = data.recoveryCodes.map(rc => `<div class="p-2 border border-[#382e22] rounded">${rc}</div>`).join('');
          }
          if (containerRecoveryCodes) containerRecoveryCodes.classList.remove('hidden');
        } else {
          alert(data.message || 'Invalid code');
        }
      } catch (err) {
        alert('Failed to enable 2FA.');
      }
    });
  }

  if (btnDisable2FA) {
    btnDisable2FA.addEventListener('click', async () => {
      const password = prompt('Enter your current password to disable 2FA:');
      if (!password) return;

      try {
        const res = await apiFetch(`${API_URL}/api/admin/disable-2fa`, {
          method: 'POST',
          body: JSON.stringify({ currentPassword: password })
        });
        const data = await res.json();
        if (data.success) {
          if (currentAdmin) currentAdmin.twoFactorEnabled = false;
          updateSecurityBadge();
          alert('Two-factor authentication disabled.');
        } else {
          alert(data.message || 'Failed to disable 2FA.');
        }
      } catch (err) {
        alert('Failed to disable 2FA.');
      }
    });
  }

  if (btnRegenCodes) {
    btnRegenCodes.addEventListener('click', async () => {
      const password = prompt('Enter your current password to regenerate recovery codes:');
      if (!password) return;

      try {
        const res = await apiFetch(`${API_URL}/api/admin/regenerate-recovery-codes`, {
          method: 'POST',
          body: JSON.stringify({ currentPassword: password })
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.recoveryCodes)) {
          if (gridRecoveryCodes) {
            gridRecoveryCodes.innerHTML = data.recoveryCodes.map(rc => `<div class="p-2 border border-[#382e22] rounded">${rc}</div>`).join('');
          }
          if (containerRecoveryCodes) containerRecoveryCodes.classList.remove('hidden');
          alert('New recovery codes generated successfully!');
        } else {
          alert(data.message || 'Failed to regenerate codes.');
        }
      } catch (err) {
        alert('Failed to regenerate recovery codes.');
      }
    });
  }

  if (formChangePassword) {
    formChangePassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('pw-current')?.value;
      const newPassword = document.getElementById('pw-new')?.value;
      const confirmPassword = document.getElementById('pw-confirm')?.value;

      try {
        const res = await apiFetch(`${API_URL}/api/admin/change-password`, {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
        });
        const data = await res.json();
        if (data.success) {
          alert('Password changed successfully! Please log in again.');
          accessToken = null;
          currentAdmin = null;
          if (securityModal) securityModal.classList.add('hidden');
          showLoginStep1();
        } else {
          alert(data.message || 'Failed to change password.');
        }
      } catch (err) {
        alert('Failed to change password.');
      }
    });
  }

  // AUDIT LOGS
  if (btnAuditLogs) {
    btnAuditLogs.addEventListener('click', async () => {
      if (auditModal) {
        auditModal.classList.remove('hidden');
        auditModal.classList.add('flex');
      }
      fetchAuditLogs();
    });
  }

  if (btnCloseAuditModal && auditModal) {
    btnCloseAuditModal.addEventListener('click', () => {
      auditModal.classList.add('hidden');
      auditModal.classList.remove('flex');
    });
  }

  async function fetchAuditLogs() {
    if (auditTableBody) {
      auditTableBody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-[#8c8275]">Loading security logs...</td></tr>`;
    }
    try {
      const res = await apiFetch(`${API_URL}/api/admin/audit-logs`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        renderAuditLogs(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    }
  }

  function renderAuditLogs(logs) {
    if (!auditTableBody) return;
    if (logs.length === 0) {
      auditTableBody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-[#8c8275]">No security audit logs recorded yet.</td></tr>`;
      return;
    }

    auditTableBody.innerHTML = logs.map(log => `
      <tr class="hover:bg-[#1f1a14] transition-colors">
        <td class="py-3 px-4 text-[10px] text-[#8c8275]">${new Date(log.createdAt).toLocaleString()}</td>
        <td class="py-3 px-4 font-mono font-semibold text-[#d4af37] text-[11px]">${escapeHtml(log.action)}</td>
        <td class="py-3 px-4 font-semibold text-[#f4efe6]">${escapeHtml(log.username)}</td>
        <td class="py-3 px-4 font-mono text-[10px] text-[#a8a196]">${escapeHtml(log.ipAddress || '—')}</td>
        <td class="py-3 px-4 font-mono text-[10px] text-[#a8a196]">${escapeHtml(log.targetId || '—')}</td>
      </tr>
    `).join('');
  }

  // --- EVENT BINDINGS & INTERACTION HANDLERS ---
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      checkHealth();
      fetchBookings();
      fetchProduct();
    });
  }

  if (btnRetryBackend) {
    btnRetryBackend.addEventListener('click', () => {
      checkHealth();
      fetchBookings();
      fetchProduct();
    });
  }

  if (searchInput) searchInput.addEventListener('input', renderData);
  if (statusFilter) statusFilter.addEventListener('change', renderData);

  // Status Overview Filter Buttons
  document.querySelectorAll('button[data-filter-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetStatus = btn.getAttribute('data-filter-status');
      if (statusFilter) statusFilter.value = targetStatus;
      renderData();
      document.getElementById('full-order-table-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Quick Action Buttons
  if (btnQuickViewAll) {
    btnQuickViewAll.addEventListener('click', () => {
      if (statusFilter) statusFilter.value = 'ALL';
      renderData();
      document.getElementById('full-order-table-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (btnQuickFilterPending) {
    btnQuickFilterPending.addEventListener('click', () => {
      if (statusFilter) statusFilter.value = 'pending';
      renderData();
      document.getElementById('full-order-table-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (btnQuickStock) {
    btnQuickStock.addEventListener('click', () => {
      document.getElementById('inventory-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (btnViewAllOrdersLink) {
    btnViewAllOrdersLink.addEventListener('click', () => {
      document.getElementById('full-order-table-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (btnAdminToggle) {
    btnAdminToggle.addEventListener('click', () => {
      const current = productData && typeof productData.stock === 'number' ? productData.stock : 0;
      setAdminStock(current > 0 ? 0 : 10);
    });
  }

  // Delegated Table Actions (Recent Orders Table + Full Table)
  if (recentOrdersTbody) {
    recentOrdersTbody.addEventListener('click', (e) => {
      const target = e.target.closest('button[data-action="recent-view"]');
      if (!target) return;
      const id = target.getAttribute('data-id');
      openOrderDetails(id);
    });
  }

  if (tableBody) {
    tableBody.addEventListener('click', (e) => {
      const target = e.target.closest('button[data-action]');
      if (!target) return;
      const action = target.getAttribute('data-action');
      const id = target.getAttribute('data-id');
      const bookingId = target.getAttribute('data-booking-id');

      if (action === 'view-details') {
        openOrderDetails(id || bookingId);
      } else if (action === 'delete-order') {
        deleteBooking(id, bookingId);
      }
    });

    tableBody.addEventListener('change', (e) => {
      const target = e.target.closest('select[data-action="update-status"]');
      if (!target) return;
      const id = target.getAttribute('data-id');
      const newStatus = target.value;
      updateStatus(id, newStatus);
    });
  }

  // --- PRE-ORDER NOTIFICATION SYSTEM (BREVO ENGINE) ---
  const textSubscriberCount = document.getElementById('text-subscriber-count');
  const inputBatchId = document.getElementById('input-batch-id');
  const btnTriggerNotificationModal = document.getElementById('btn-trigger-notification-modal');
  const btnQuickNotifications = document.getElementById('btn-quick-notifications');
  const notificationSummaryBanner = document.getElementById('notification-summary-banner');
  const notificationSummaryText = document.getElementById('notification-summary-text');
  const notificationSummaryTime = document.getElementById('notification-summary-time');

  const notificationConfirmModal = document.getElementById('notification-confirm-modal');
  const btnCloseNotificationModal = document.getElementById('btn-close-notification-modal');
  const btnCancelNotificationSend = document.getElementById('btn-cancel-notification-send');
  const btnConfirmSendNotifications = document.getElementById('btn-confirm-send-notifications');
  const confirmBatchLabel = document.getElementById('confirm-batch-label');
  const confirmRecipientCount = document.getElementById('confirm-recipient-count');

  let currentSubscriberCount = 0;

  // Auto-generate batch ID default if empty
  if (inputBatchId && !inputBatchId.value) {
    const year = new Date().getFullYear();
    inputBatchId.value = `FR-BATCH-${year}-001`;
  }

  async function fetchSubscribersCount() {
    try {
      const res = await apiFetch(`${API_URL}/api/admin/notifications/subscribers-count`);
      const data = await res.json();
      if (data.success && typeof data.count === 'number') {
        currentSubscriberCount = data.count;
        if (textSubscriberCount) textSubscriberCount.textContent = `${data.count} Customers`;
      }
    } catch (err) {
      console.warn('Could not fetch subscribers count:', err.message);
    }
  }

  if (btnQuickNotifications) {
    btnQuickNotifications.addEventListener('click', () => {
      document.getElementById('notifications-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // PRODUCTION NOTIFICATION TRIGGER (OPEN MODAL)
  if (btnTriggerNotificationModal) {
    btnTriggerNotificationModal.addEventListener('click', () => {
      const batchId = inputBatchId ? inputBatchId.value.trim() : '';
      if (!batchId) {
        alert('Please enter a Pre-Order Batch ID before opening notifications.');
        return;
      }

      if (confirmBatchLabel) confirmBatchLabel.textContent = batchId;
      if (confirmRecipientCount) confirmRecipientCount.textContent = `${currentSubscriberCount} Customers`;

      if (notificationConfirmModal) {
        notificationConfirmModal.classList.remove('hidden');
        notificationConfirmModal.classList.add('flex');
      }
    });
  }

  function closeNotificationModal() {
    if (notificationConfirmModal) {
      notificationConfirmModal.classList.add('hidden');
      notificationConfirmModal.classList.remove('flex');
    }
  }

  if (btnCloseNotificationModal) btnCloseNotificationModal.addEventListener('click', closeNotificationModal);
  if (btnCancelNotificationSend) btnCancelNotificationSend.addEventListener('click', closeNotificationModal);

  // PRODUCTION NOTIFICATION SEND CONFIRMED
  if (btnConfirmSendNotifications) {
    btnConfirmSendNotifications.addEventListener('click', async () => {
      const batchId = inputBatchId ? inputBatchId.value.trim() : '';

      btnConfirmSendNotifications.disabled = true;
      btnConfirmSendNotifications.textContent = 'Sending Notifications...';

      try {
        const res = await apiFetch(`${API_URL}/api/admin/notifications/preorder-open`, {
          method: 'POST',
          body: JSON.stringify({ preorderBatchId: batchId, testMode: false })
        });
        const data = await res.json();

        closeNotificationModal();

        if (data.success) {
          showNotificationSummary(
            `🚀 BATCH ${data.preorderBatchId} COMPLETE: ${data.sent} Sent | ${data.skipped} Skipped (Duplicates) | ${data.failed} Failed (Total Opted-In: ${data.totalSubscribers}).`,
            true
          );
        } else {
          showNotificationSummary(`⚠️ BATCH FAILED: ${data.message || 'Error sending notification batch.'}`, false);
        }
      } catch (err) {
        closeNotificationModal();
        showNotificationSummary(`⚠️ BATCH ERROR: ${err.message}`, false);
      } finally {
        btnConfirmSendNotifications.disabled = false;
        btnConfirmSendNotifications.textContent = 'Send Notification Batch';
      }
    });
  }

  function showNotificationSummary(msg, isSuccess) {
    if (!notificationSummaryBanner) return;
    notificationSummaryText.textContent = msg;
    notificationSummaryTime.textContent = new Date().toLocaleTimeString();

    if (isSuccess) {
      notificationSummaryBanner.className = 'p-3.5 rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border bg-emerald-950/60 border-emerald-500/40 text-emerald-200';
    } else {
      notificationSummaryBanner.className = 'p-3.5 rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border bg-red-950/60 border-red-500/40 text-red-200';
    }
    notificationSummaryBanner.classList.remove('hidden');
  }

  // --- INITIAL SILENT REFRESH CHECK ON PAGE LOAD ---
  attemptSilentRefresh().then(success => {
    if (success) {
      showDashboard();
      checkHealth();
      fetchBookings();
      fetchProduct();
      fetchSubscribersCount();
    } else {
      showLoginStep1();
    }
  });
});
