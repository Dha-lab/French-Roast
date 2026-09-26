import './style.css';

document.addEventListener('DOMContentLoaded', () => {
  const configuredApiUrl = import.meta.env.VITE_API_URL;
  const API_URL = (configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:5000' : 'https://french-roast-backend.onrender.com')).replace(/\/+$/, '');

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

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

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

  function loadDashboardData() {
    Promise.allSettled([
      fetchBookings(),
      fetchProduct(),
      fetchSubscribersCount(),
      fetchNotificationSubscribers(),
      typeof fetchInventoryData === 'function' ? fetchInventoryData() : Promise.resolve()
    ]);
  }

  function showDashboard() {
    if (loginScreen) loginScreen.classList.add('hidden');
    if (adminDashboard) adminDashboard.classList.remove('hidden');
    if (loginError) loginError.classList.add('hidden');
    updateSecurityBadge();
    loadDashboardData();
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
        if (allSubscribers.length === 0) {
          if (typeof tryExtractSubscribersFromOrders === 'function' && tryExtractSubscribersFromOrders()) {
            isSubscribersLoading = false;
            if (typeof renderSubscribersTable === 'function') renderSubscribersTable();
          }
        }
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
      const fullDate = d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

      const count = allBookings.filter(b => b.createdAt && new Date(b.createdAt).toDateString() === dateStr).length;
      dayBuckets.push({ label, fullDate, count });
    }

    const maxCount = Math.max(...dayBuckets.map(b => b.count), 1);
    const hasData = dayBuckets.some(b => b.count > 0);

    if (!hasData) {
      if (activityChartWrapper) activityChartWrapper.innerHTML = '';
      if (activityEmptyState) activityEmptyState.classList.remove('hidden');
      return;
    }

    if (activityEmptyState) activityEmptyState.classList.add('hidden');

    const viewportWidth = window.innerWidth;
    const isMobile = viewportWidth < 640;
    const isTablet = viewportWidth >= 640 && viewportWidth < 1024;

    // Apply responsive gap and minimum width rules for 30-day mode vs 7-day mode
    if (days === 30) {
      activityChartWrapper.className = isMobile
        ? "w-full min-w-[500px] flex items-end justify-between gap-1 pt-4 pb-1 px-1"
        : (isTablet
          ? "w-full min-w-[540px] flex items-end justify-between gap-1 sm:gap-1.5 pt-4 pb-1 px-1"
          : "w-full min-w-0 flex items-end justify-between gap-1 sm:gap-1.5 pt-4 pb-1 px-1");
    } else {
      activityChartWrapper.className = "w-full min-w-0 flex items-end justify-between gap-2 sm:gap-4 pt-4 pb-1 px-1";
    }

    activityChartWrapper.innerHTML = dayBuckets.map((b, idx) => {
      const heightPct = Math.max(Math.round((b.count / maxCount) * 100), 8);

      // Intelligently compute label density for 30-day mode vs 7-day mode
      let showLabel = true;
      let displayLabel = b.label;

      if (days === 30) {
        const interval = isMobile ? 6 : (isTablet ? 4 : 3);
        if (idx === 0 || idx === days - 1 || idx % interval === 0) {
          showLabel = true;
          displayLabel = b.label;
        } else {
          showLabel = false;
        }
      }

      return `
        <div class="flex-1 min-w-0 flex flex-col items-center gap-1 group relative" title="${escapeHtml(b.fullDate)}: ${b.count} order(s)">
          <span class="text-[9px] font-mono text-[#C9A24D] font-bold ${b.count > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity">${b.count}</span>
          <div class="w-full bg-[#15120F] border border-[#3A2D20] rounded-t-lg h-28 sm:h-36 flex items-end p-0.5 sm:p-1 overflow-hidden">
            <div class="w-full bg-gradient-to-t from-[#8c6d22] to-[#C9A24D] rounded-t transition-all duration-300 group-hover:from-[#a8832a] group-hover:to-[#E0BD63]" style="height: ${heightPct}%"></div>
          </div>
          <div class="h-4 flex items-center justify-center w-full">
            ${showLabel ? `<span class="text-[9px] font-mono text-[#A99E91] font-semibold truncate max-w-full leading-none">${escapeHtml(displayLabel)}</span>` : '<span class="w-1 h-1 rounded-full bg-[#3A2D20] group-hover:bg-[#C9A24D]"></span>'}
          </div>
        </div>
      `;
    }).join('');
  }

  if (activityPeriodSelect) {
    activityPeriodSelect.addEventListener('change', renderActivityChart);
  }

  window.addEventListener('resize', () => {
    renderActivityChart();
  });

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
          <div class="flex justify-between border-b border-[#3A2D20] pb-2">
            <span class="text-[#A99E91]">SMS Status:</span>
            <span class="font-semibold ${order.smsConfirmationSent ? 'text-[#63A87A]' : (order.smsError ? 'text-[#C9655C]' : 'text-[#D19A45]')}">${order.smsConfirmationSent ? '✅ Sent' : (order.smsError ? '❌ Failed' : '⚠️ Pending / Not Sent')}</span>
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
      fetchSubscribersCount();
    });
  }

  if (btnRetryBackend) {
    btnRetryBackend.addEventListener('click', () => {
      checkHealth();
      fetchBookings();
      fetchProduct();
      fetchSubscribersCount();
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
  let confirmedBatchId = '';

  // Opted-In Customers List Card Elements
  const textSubscribersListCount = document.getElementById('text-subscribers-list-count');
  const inputSubscribersSearch = document.getElementById('input-subscribers-search');
  const subscribersTableBody = document.getElementById('subscribers-table-body');
  const subscribersPaginationInfo = document.getElementById('subscribers-pagination-info');
  const subscribersPageIndicator = document.getElementById('subscribers-page-indicator');
  const btnSubscribersPrev = document.getElementById('btn-subscribers-prev');
  const btnSubscribersNext = document.getElementById('btn-subscribers-next');

  let currentSubscriberCount = null;
  let allSubscribers = [];
  let filteredSubscribers = [];
  let subscribersCurrentPage = 1;
  const SUBSCRIBERS_PER_PAGE = 10;
  let isSubscribersLoading = false;

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatCustomerCount(count) {
    if (typeof count !== 'number' || isNaN(count)) return '0 Customers';
    return count === 1 ? '1 Customer' : `${count} Customers`;
  }

  // Auto-generate batch ID default if empty
  if (inputBatchId && !inputBatchId.value) {
    const year = new Date().getFullYear();
    inputBatchId.value = `FR-BATCH-${year}-001`;
  }

  function renderSubscribersTable() {
    if (!subscribersTableBody) return;

    const query = inputSubscribersSearch ? inputSubscribersSearch.value.trim().toLowerCase() : '';

    if (query) {
      filteredSubscribers = allSubscribers.filter(sub => {
        const name = (sub.name || '').toLowerCase();
        const email = (sub.email || '').toLowerCase();
        const phone = (sub.phone || '').toLowerCase();
        return name.includes(query) || email.includes(query) || phone.includes(query);
      });
    } else {
      filteredSubscribers = [...allSubscribers];
    }

    if (textSubscribersListCount) {
      if (isSubscribersLoading) {
        if (allSubscribers.length > 0) {
          textSubscribersListCount.textContent = formatCustomerCount(allSubscribers.length);
        } else if (typeof currentSubscriberCount === 'number') {
          textSubscribersListCount.textContent = formatCustomerCount(currentSubscriberCount);
        } else {
          textSubscribersListCount.textContent = 'Loading...';
        }
      } else if (allSubscribers.length > 0) {
        textSubscribersListCount.textContent = formatCustomerCount(allSubscribers.length);
      } else if (typeof currentSubscriberCount === 'number') {
        textSubscribersListCount.textContent = formatCustomerCount(currentSubscriberCount);
      } else {
        textSubscribersListCount.textContent = '0 Customers';
      }
    }

    if (isSubscribersLoading) {
      subscribersTableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-[#A99E91]">Loading opted-in customers...</td></tr>`;
      if (subscribersPaginationInfo) subscribersPaginationInfo.textContent = 'Loading...';
      if (subscribersPageIndicator) subscribersPageIndicator.textContent = 'Page 1 of 1';
      if (btnSubscribersPrev) btnSubscribersPrev.disabled = true;
      if (btnSubscribersNext) btnSubscribersNext.disabled = true;
      return;
    }

    if (filteredSubscribers.length === 0) {
      if (query) {
        subscribersTableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-[#A99E91]">No customers matching "${escapeHtml(query)}" found.</td></tr>`;
      } else {
        subscribersTableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-[#A99E91]">No opted-in customers yet.</td></tr>`;
      }
      if (subscribersPaginationInfo) subscribersPaginationInfo.textContent = 'Showing 0 customers';
      if (subscribersPageIndicator) subscribersPageIndicator.textContent = 'Page 1 of 1';
      if (btnSubscribersPrev) btnSubscribersPrev.disabled = true;
      if (btnSubscribersNext) btnSubscribersNext.disabled = true;
      return;
    }

    const totalPages = Math.ceil(filteredSubscribers.length / SUBSCRIBERS_PER_PAGE) || 1;
    if (subscribersCurrentPage > totalPages) subscribersCurrentPage = totalPages;
    if (subscribersCurrentPage < 1) subscribersCurrentPage = 1;

    const startIndex = (subscribersCurrentPage - 1) * SUBSCRIBERS_PER_PAGE;
    const endIndex = Math.min(startIndex + SUBSCRIBERS_PER_PAGE, filteredSubscribers.length);
    const pageItems = filteredSubscribers.slice(startIndex, endIndex);

    subscribersTableBody.innerHTML = pageItems.map(sub => {
      const name = sub.name || 'Coffee Enthusiast';
      const email = sub.email || '—';
      const phone = sub.phone || '—';
      const dateStr = sub.createdAt
        ? new Date(sub.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
        : '—';

      return `
        <tr class="hover:bg-[#1f1a14] transition-colors">
          <td class="py-3 px-4 font-semibold text-[#F5EFE6]">${escapeHtml(name)}</td>
          <td class="py-3 px-4 font-mono text-[#C9A24D] text-[11px]">${escapeHtml(email)}</td>
          <td class="py-3 px-4 font-mono text-[#A99E91] text-[11px]">${escapeHtml(phone)}</td>
          <td class="py-3 px-4 text-center">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#63A87A]/15 text-[#63A87A] border border-[#63A87A]/40">
              ✓ OPTED IN
            </span>
          </td>
          <td class="py-3 px-4 text-right font-mono text-[#A99E91] text-[10px]">${escapeHtml(dateStr)}</td>
        </tr>
      `;
    }).join('');

    if (subscribersPaginationInfo) {
      subscribersPaginationInfo.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${filteredSubscribers.length} customer${filteredSubscribers.length === 1 ? '' : 's'}`;
    }
    if (subscribersPageIndicator) {
      subscribersPageIndicator.textContent = `Page ${subscribersCurrentPage} of ${totalPages}`;
    }
    if (btnSubscribersPrev) btnSubscribersPrev.disabled = subscribersCurrentPage <= 1;
    if (btnSubscribersNext) btnSubscribersNext.disabled = subscribersCurrentPage >= totalPages;
  }

  function tryExtractSubscribersFromOrders() {
    if (!Array.isArray(allBookings) || allBookings.length === 0) return false;
    const uniqueMap = new Map();
    allBookings.forEach(b => {
      const rawOptIn = b.emailOptIn ?? b.notificationOptIn ?? b.marketingOptIn ?? b.preorderNotificationOptIn ?? b.optin;
      const isOptedIn = rawOptIn === undefined ? true : (rawOptIn === true || rawOptIn === 'true' || rawOptIn === 'on' || rawOptIn === 1 || rawOptIn === '1');
      const email = (b.email || '').trim().toLowerCase();
      if (email && isOptedIn && !uniqueMap.has(email)) {
        uniqueMap.set(email, {
          _id: b._id || b.id,
          name: b.name || b.fullName || 'Coffee Enthusiast',
          email: b.email,
          phone: b.phone || b.phoneNo || '—',
          emailOptIn: true,
          createdAt: b.createdAt
        });
      }
    });

    if (uniqueMap.size > 0) {
      allSubscribers = Array.from(uniqueMap.values());
      return true;
    }
    return false;
  }

  async function fetchNotificationSubscribers() {
    isSubscribersLoading = true;
    renderSubscribersTable();

    try {
      const res = await apiFetch(`${API_URL}/api/admin/notifications/subscribers`);
      if (!res.ok) {
        console.warn(`Subscribers list endpoint returned HTTP ${res.status}`);
        if (tryExtractSubscribersFromOrders()) {
          isSubscribersLoading = false;
          renderSubscribersTable();
          return;
        }
        if (allSubscribers.length === 0 && subscribersTableBody) {
          subscribersTableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-red-400 font-medium">Unable to load opted-in customers.</td></tr>`;
        }
        isSubscribersLoading = false;
        renderSubscribersTable();
        return;
      }
      const data = await res.json();
      if (data && data.success && Array.isArray(data.subscribers)) {
        allSubscribers = data.subscribers;
        isSubscribersLoading = false;
        renderSubscribersTable();
      } else {
        console.warn('Unexpected subscribers list API response format:', data);
        if (tryExtractSubscribersFromOrders()) {
          isSubscribersLoading = false;
          renderSubscribersTable();
          return;
        }
        if (allSubscribers.length === 0 && subscribersTableBody) {
          subscribersTableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-red-400 font-medium">Unable to load opted-in customers.</td></tr>`;
        }
        isSubscribersLoading = false;
        renderSubscribersTable();
      }
    } catch (err) {
      console.warn('Could not fetch subscribers list:', err.message);
      if (tryExtractSubscribersFromOrders()) {
        isSubscribersLoading = false;
        renderSubscribersTable();
        return;
      }
      if (allSubscribers.length === 0 && subscribersTableBody) {
        subscribersTableBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-red-400 font-medium">Unable to load opted-in customers.</td></tr>`;
      }
      isSubscribersLoading = false;
      renderSubscribersTable();
    }
  }

  async function fetchSubscribersCount() {
    try {
      const res = await apiFetch(`${API_URL}/api/admin/notifications/subscribers-count`);
      if (!res.ok) {
        console.warn(`Subscribers count endpoint returned HTTP ${res.status}`);
        if (currentSubscriberCount === null) {
          if (textSubscriberCount) textSubscriberCount.textContent = 'Unavailable';
          if (confirmRecipientCount) confirmRecipientCount.textContent = 'Unavailable';
        }
        return currentSubscriberCount;
      }
      const data = await res.json();
      if (data && data.success && typeof data.count === 'number') {
        currentSubscriberCount = data.count;
        const formattedText = formatCustomerCount(data.count);
        if (textSubscriberCount) textSubscriberCount.textContent = formattedText;
        if (confirmRecipientCount) confirmRecipientCount.textContent = formattedText;
        return data.count;
      } else {
        console.warn('Unexpected subscribers-count API response format:', data);
        if (currentSubscriberCount === null) {
          if (textSubscriberCount) textSubscriberCount.textContent = 'Unavailable';
          if (confirmRecipientCount) confirmRecipientCount.textContent = 'Unavailable';
        }
      }
    } catch (err) {
      console.warn('Could not fetch subscribers count:', err.message);
      if (currentSubscriberCount === null) {
        if (textSubscriberCount) textSubscriberCount.textContent = 'Unavailable';
        if (confirmRecipientCount) confirmRecipientCount.textContent = 'Unavailable';
      }
    }
    return currentSubscriberCount;
  }

  if (inputSubscribersSearch) {
    inputSubscribersSearch.addEventListener('input', () => {
      subscribersCurrentPage = 1;
      renderSubscribersTable();
    });
  }

  if (btnSubscribersPrev) {
    btnSubscribersPrev.addEventListener('click', () => {
      if (subscribersCurrentPage > 1) {
        subscribersCurrentPage--;
        renderSubscribersTable();
      }
    });
  }

  if (btnSubscribersNext) {
    btnSubscribersNext.addEventListener('click', () => {
      const totalPages = Math.ceil(filteredSubscribers.length / SUBSCRIBERS_PER_PAGE) || 1;
      if (subscribersCurrentPage < totalPages) {
        subscribersCurrentPage++;
        renderSubscribersTable();
      }
    });
  }

  if (btnQuickNotifications) {
    btnQuickNotifications.addEventListener('click', () => {
      fetchSubscribersCount();
      document.getElementById('notifications-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // PRODUCTION NOTIFICATION TRIGGER (OPEN MODAL)
  if (btnTriggerNotificationModal) {
    btnTriggerNotificationModal.addEventListener('click', async () => {
      const batchId = inputBatchId ? inputBatchId.value.trim() : '';
      if (!batchId) {
        alert('Please enter a Pre-Order Batch ID before opening notifications.');
        return;
      }
      confirmedBatchId = batchId;

      if (confirmRecipientCount) confirmRecipientCount.textContent = 'Loading...';

      const latestCount = await fetchSubscribersCount();

      if (confirmBatchLabel) confirmBatchLabel.textContent = batchId;
      if (confirmRecipientCount) {
        if (typeof latestCount === 'number') {
          confirmRecipientCount.textContent = formatCustomerCount(latestCount);
        } else if (typeof currentSubscriberCount === 'number') {
          confirmRecipientCount.textContent = formatCustomerCount(currentSubscriberCount);
        } else {
          confirmRecipientCount.textContent = 'Unavailable';
        }
      }

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
      const batchId = confirmedBatchId;
      if (!batchId) {
        closeNotificationModal();
        showNotificationSummary('⚠️ BATCH ERROR: Open the batch confirmation again before sending.', false);
        return;
      }

      btnConfirmSendNotifications.disabled = true;
      btnConfirmSendNotifications.textContent = 'Sending Notifications...';

      try {
        const res = await apiFetch(`${API_URL}/api/admin/notifications/preorder-open`, {
          method: 'POST',
          body: JSON.stringify({ preorderBatchId: batchId, testMode: false })
        });
        const data = await res.json();

        closeNotificationModal();

        if (data.sent > 0) fetchSubscribersCount();
        const counts = `${data.sent} Sent | ${data.skipped} Skipped (Duplicates) | ${data.failed} Failed (Total Opted-In: ${data.totalSubscribers}).`;
        const reasons = Array.isArray(data.failureReasons) ? data.failureReasons.join(' | ') : '';
        const summary = data.totalSubscribers === 0
          ? `⚠️ BATCH ${data.preorderBatchId}: No opted-in subscribers were found.`
          : `${data.success ? '🚀' : '⚠️'} BATCH ${data.preorderBatchId} ${data.success ? 'COMPLETE' : 'RESULT'}: ${counts}${reasons ? ` Reason: ${reasons}` : ''}`;
        showNotificationSummary(summary, data.success === true);
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

  // ==========================================
  // INVENTORY MANAGEMENT MODULE
  // ==========================================
  const navBtnDashboard = document.getElementById('nav-btn-dashboard');
  const navBtnInventory = document.getElementById('nav-btn-inventory');
  const dashboardView = document.getElementById('dashboard-view');
  const inventoryView = document.getElementById('inventory-view');

  const invLastUpdated = document.getElementById('inv-last-updated');
  const btnInvRefresh = document.getElementById('btn-inv-refresh');

  const invTotalStock = document.getElementById('inv-total-stock');
  const invTotalSold = document.getElementById('inv-total-sold');
  const invWaitingPreorders = document.getElementById('inv-waiting-preorders');
  const invLowStock = document.getElementById('inv-low-stock');
  const invOutOfStock = document.getElementById('inv-out-of-stock');

  const invPowderBadge = document.getElementById('inv-powder-badge');
  const invPowderStock = document.getElementById('inv-powder-stock');
  const invPowderSold = document.getElementById('inv-powder-sold');
  const invPowderWaiting = document.getElementById('inv-powder-waiting');
  const invPowderThreshold = document.getElementById('inv-powder-threshold');

  const invWholebeanBadge = document.getElementById('inv-wholebean-badge');
  const invWholebeanStock = document.getElementById('inv-wholebean-stock');
  const invWholebeanSold = document.getElementById('inv-wholebean-sold');
  const invWholebeanWaiting = document.getElementById('inv-wholebean-waiting');
  const invWholebeanThreshold = document.getElementById('inv-wholebean-threshold');

  const btnAddPowder = document.getElementById('btn-add-powder');
  const btnRemovePowder = document.getElementById('btn-remove-powder');
  const btnSetPowder = document.getElementById('btn-set-powder');

  const btnAddWholebean = document.getElementById('btn-add-wholebean');
  const btnRemoveWholebean = document.getElementById('btn-remove-wholebean');
  const btnSetWholebean = document.getElementById('btn-set-wholebean');

  const invHistoryTableBody = document.getElementById('inv-history-table-body');
  const invWaitingTableBody = document.getElementById('inv-waiting-table-body');
  const btnNotifyWaitingCustomers = document.getElementById('btn-notify-waiting-customers');

  const formInvSettings = document.getElementById('form-inv-settings');
  const inputPowderThreshold = document.getElementById('input-powder-threshold');
  const inputWholebeanThreshold = document.getElementById('input-wholebean-threshold');

  const btnQuickAddStock = document.getElementById('btn-quick-add-stock');
  const btnQuickRemoveStock = document.getElementById('btn-quick-remove-stock');
  const btnQuickSetStock = document.getElementById('btn-quick-set-stock');
  const btnExportStockReport = document.getElementById('btn-export-stock-report');
  const invInsightsContainer = document.getElementById('inv-insights-container');

  const modalAdjustStock = document.getElementById('modal-adjust-stock');
  const btnCloseStockModal = document.getElementById('btn-close-stock-modal');
  const btnCancelStockModal = document.getElementById('btn-cancel-stock-modal');
  const formStockModal = document.getElementById('form-stock-modal');
  const stockModalVariant = document.getElementById('stock-modal-variant');
  const stockModalAction = document.getElementById('stock-modal-action');
  const stockModalQuantity = document.getElementById('stock-modal-quantity');
  const stockModalReason = document.getElementById('stock-modal-reason');

  let activeTab = 'dashboard';

  function switchTab(tab) {
    activeTab = tab;
    if (tab === 'dashboard') {
      if (dashboardView) dashboardView.classList.remove('hidden');
      if (inventoryView) inventoryView.classList.add('hidden');
      if (navBtnDashboard) navBtnDashboard.className = 'px-5 py-2.5 rounded-xl bg-[#C9A24D] text-[#0B0908] font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md';
      if (navBtnInventory) navBtnInventory.className = 'px-5 py-2.5 rounded-xl bg-[#15120F] border border-[#3A2D20] text-[#A99E91] font-bold text-xs uppercase tracking-wider hover:text-[#C9A24D] hover:border-[#C9A24D]/50 transition-all cursor-pointer';
    } else if (tab === 'inventory') {
      if (dashboardView) dashboardView.classList.add('hidden');
      if (inventoryView) inventoryView.classList.remove('hidden');
      if (navBtnDashboard) navBtnDashboard.className = 'px-5 py-2.5 rounded-xl bg-[#15120F] border border-[#3A2D20] text-[#A99E91] font-bold text-xs uppercase tracking-wider hover:text-[#C9A24D] hover:border-[#C9A24D]/50 transition-all cursor-pointer';
      if (navBtnInventory) navBtnInventory.className = 'px-5 py-2.5 rounded-xl bg-[#C9A24D] text-[#0B0908] font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md';
      fetchInventoryData();
    }
  }

  if (navBtnDashboard) navBtnDashboard.addEventListener('click', () => switchTab('dashboard'));
  if (navBtnInventory) navBtnInventory.addEventListener('click', () => switchTab('inventory'));

  async function fetchInventoryData() {
    await Promise.all([
      fetchInventorySummary(),
      fetchStockHistory(),
      fetchWaitingPreOrders(),
      fetchInventoryInsights()
    ]);
  }

  async function fetchInventorySummary() {
    try {
      const res = await apiFetch(`${API_URL}/api/inventory/summary`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || `Inventory summary request failed (${res.status})`);
      }

      if (data.success && data.summary && Array.isArray(data.products)) {
        if (invLastUpdated) invLastUpdated.textContent = `Last updated: ${new Date(data.lastUpdated).toLocaleTimeString()}`;
        if (invTotalStock) invTotalStock.textContent = data.summary.totalStock || 0;
        if (invTotalSold) invTotalSold.textContent = data.summary.totalSold || 0;
        if (invWaitingPreorders) invWaitingPreorders.textContent = data.summary.waitingPreOrders || 0;
        if (invLowStock) invLowStock.textContent = data.summary.lowStockItems || 0;
        if (invOutOfStock) invOutOfStock.textContent = data.summary.outOfStockItems || 0;

        const powder = data.products.find(p => p.variant === 'Powder');
        if (powder) {
          if (invPowderStock) invPowderStock.textContent = powder.stock;
          if (invPowderSold) invPowderSold.textContent = powder.totalSold;
          if (invPowderWaiting) invPowderWaiting.textContent = powder.waitingCount;
          if (invPowderThreshold) invPowderThreshold.textContent = powder.lowStockThreshold;
          if (inputPowderThreshold) inputPowderThreshold.value = powder.lowStockThreshold;
          renderStatusBadge(invPowderBadge, powder.statusBadge);
        }

        const wholeBean = data.products.find(p => p.variant === 'Whole Bean');
        if (wholeBean) {
          if (invWholebeanStock) invWholebeanStock.textContent = wholeBean.stock;
          if (invWholebeanSold) invWholebeanSold.textContent = wholeBean.totalSold;
          if (invWholebeanWaiting) invWholebeanWaiting.textContent = wholeBean.waitingCount;
          if (invWholebeanThreshold) invWholebeanThreshold.textContent = wholeBean.lowStockThreshold;
          if (inputWholebeanThreshold) inputWholebeanThreshold.value = wholeBean.lowStockThreshold;
          renderStatusBadge(invWholebeanBadge, wholeBean.statusBadge);
        }
      }
    } catch (err) {
      console.error('Failed to fetch inventory summary:', err);
      showDashboardError(`Inventory data unavailable: ${err.message}`);
    }
  }

  function renderStatusBadge(element, badgeStatus) {
    if (!element) return;
    if (badgeStatus === 'OUT OF STOCK') {
      element.textContent = 'OUT OF STOCK';
      element.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#C9655C]/20 text-[#C9655C] border border-[#C9655C]/40';
    } else if (badgeStatus === 'LOW STOCK') {
      element.textContent = 'LOW STOCK';
      element.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#E0A84E]/20 text-[#E0A84E] border border-[#E0A84E]/40';
    } else {
      element.textContent = 'IN STOCK';
      element.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#63A87A]/20 text-[#63A87A] border border-[#63A87A]/40';
    }
  }

  async function fetchStockHistory() {
    if (!invHistoryTableBody) return;
    try {
      const res = await apiFetch(`${API_URL}/api/inventory/history`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Stock history request failed (${res.status})`);
      }
      if (Array.isArray(data.history)) {
        if (data.history.length === 0) {
          invHistoryTableBody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-[#A99E91]">No stock history recorded yet.</td></tr>`;
          return;
        }

        invHistoryTableBody.innerHTML = data.history.map(item => `
          <tr class="hover:bg-[#15120F]/50 transition-colors">
            <td class="py-3 px-3 font-mono text-[11px] text-[#A99E91]">${new Date(item.createdAt).toLocaleString()}</td>
            <td class="py-3 px-3 font-bold text-[#F5EFE6]">${escapeHtml(item.variant)}</td>
            <td class="py-3 px-3 font-bold ${item.quantityChange >= 0 ? 'text-[#63A87A]' : 'text-[#C9655C]'}">${item.quantityChange > 0 ? '+' : ''}${item.quantityChange}</td>
            <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#15120F] border border-[#3A2D20] text-[#C9A24D]">${escapeHtml(item.actionType)}</span></td>
            <td class="py-3 px-3 text-[#A99E91] text-[11px]">${escapeHtml(item.reason || '-')}</td>
            <td class="py-3 px-3 text-[#A99E91] text-[11px]">${escapeHtml(item.adminUsername || 'Admin')}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error('Failed to fetch stock history:', err);
      invHistoryTableBody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-[#C9655C]">Unable to load stock history.</td></tr>`;
    }
  }

  async function fetchWaitingPreOrders() {
    if (!invWaitingTableBody) return;
    try {
      const res = await apiFetch(`${API_URL}/api/inventory/waiting-orders`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Waiting orders request failed (${res.status})`);
      }
      if (Array.isArray(data.orders)) {
        if (data.orders.length === 0) {
          invWaitingTableBody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-[#A99E91]">No waiting pre-orders found.</td></tr>`;
          return;
        }

        invWaitingTableBody.innerHTML = data.orders.map(order => `
          <tr class="hover:bg-[#15120F]/50 transition-colors">
            <td class="py-3 px-3 font-bold text-[#F5EFE6]">${escapeHtml(order.fullName || order.name || 'Customer')}</td>
            <td class="py-3 px-3 text-[#A99E91] font-mono text-[11px]">${escapeHtml(order.email)}<br/>${escapeHtml(order.phone)}</td>
            <td class="py-3 px-3 text-[#F5EFE6] font-medium">${escapeHtml(order.variant || order.coffeeType)} 250g</td>
            <td class="py-3 px-3 font-bold text-[#C9A24D]">${order.quantity || 1}</td>
            <td class="py-3 px-3 text-[#A99E91] font-mono text-[11px]">${new Date(order.createdAt).toLocaleDateString()}</td>
            <td class="py-3 px-3"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-[#D19A45]/20 text-[#D19A45] border border-[#D19A45]/40">WAITING STOCK</span></td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error('Failed to fetch waiting pre-orders:', err);
      invWaitingTableBody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-[#C9655C]">Unable to load waiting pre-orders.</td></tr>`;
    }
  }

  async function fetchInventoryInsights() {
    if (!invInsightsContainer) return;
    try {
      const res = await apiFetch(`${API_URL}/api/inventory/insights`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Inventory insights request failed (${res.status})`);
      }
      if (Array.isArray(data.insights)) {
        invInsightsContainer.innerHTML = data.insights.map(day => `
          <div class="flex items-center justify-between p-2 rounded-xl bg-[#15120F] border border-[#3A2D20] text-xs">
            <span class="font-mono text-[#A99E91] text-[11px]">${day.date}</span>
            <div class="flex items-center gap-3 font-semibold">
              <span class="text-[#63A87A]">+${day.added} added</span>
              <span class="text-[#C9655C]">-${day.removed} removed</span>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error('Failed to fetch inventory insights:', err);
      invInsightsContainer.innerHTML = '<p class="text-center py-4 text-[#C9655C]">Unable to load insights.</p>';
    }
  }

  // MODAL HANDLERS FOR STOCK ADJUSTMENT
  function openStockModal(variant = 'Powder', action = 'ADD') {
    if (stockModalVariant) stockModalVariant.value = variant;
    if (stockModalAction) stockModalAction.value = action;
    if (stockModalQuantity) stockModalQuantity.value = '';
    if (stockModalReason) stockModalReason.value = '';
    if (modalAdjustStock) {
      modalAdjustStock.classList.remove('hidden');
      modalAdjustStock.classList.add('flex');
    }
  }

  function closeStockModal() {
    if (modalAdjustStock) {
      modalAdjustStock.classList.add('hidden');
      modalAdjustStock.classList.remove('flex');
    }
  }

  if (btnCloseStockModal) btnCloseStockModal.addEventListener('click', closeStockModal);
  if (btnCancelStockModal) btnCancelStockModal.addEventListener('click', closeStockModal);

  if (btnAddPowder) btnAddPowder.addEventListener('click', () => openStockModal('Powder', 'ADD'));
  if (btnRemovePowder) btnRemovePowder.addEventListener('click', () => openStockModal('Powder', 'REMOVE'));
  if (btnSetPowder) btnSetPowder.addEventListener('click', () => openStockModal('Powder', 'SET'));

  if (btnAddWholebean) btnAddWholebean.addEventListener('click', () => openStockModal('Whole Bean', 'ADD'));
  if (btnRemoveWholebean) btnRemoveWholebean.addEventListener('click', () => openStockModal('Whole Bean', 'REMOVE'));
  if (btnSetWholebean) btnSetWholebean.addEventListener('click', () => openStockModal('Whole Bean', 'SET'));

  if (btnQuickAddStock) btnQuickAddStock.addEventListener('click', () => openStockModal('Powder', 'ADD'));
  if (btnQuickRemoveStock) btnQuickRemoveStock.addEventListener('click', () => openStockModal('Powder', 'REMOVE'));
  if (btnQuickSetStock) btnQuickSetStock.addEventListener('click', () => openStockModal('Powder', 'SET'));

  if (btnInvRefresh) btnInvRefresh.addEventListener('click', () => fetchInventoryData());

  if (formStockModal) {
    formStockModal.addEventListener('submit', async (e) => {
      e.preventDefault();
      const variant = stockModalVariant ? stockModalVariant.value : 'Powder';
      const actionType = stockModalAction ? stockModalAction.value : 'ADD';
      const quantity = stockModalQuantity ? parseInt(stockModalQuantity.value, 10) : 0;
      const reason = stockModalReason ? stockModalReason.value.trim() : '';

      try {
        const res = await apiFetch(`${API_URL}/api/inventory/stock`, {
          method: 'POST',
          body: JSON.stringify({ variant, actionType, quantity, reason })
        });
        const data = await res.json();
        if (data.success) {
          closeStockModal();
          fetchInventoryData();
        } else {
          alert(`Error updating stock: ${data.message}`);
        }
      } catch (err) {
        alert(`Failed to update stock: ${err.message}`);
      }
    });
  }

  if (formInvSettings) {
    formInvSettings.addEventListener('submit', async (e) => {
      e.preventDefault();
      const powderThreshold = inputPowderThreshold ? parseInt(inputPowderThreshold.value, 10) : 10;
      const wholeBeanThreshold = inputWholebeanThreshold ? parseInt(inputWholebeanThreshold.value, 10) : 10;

      try {
        const res = await apiFetch(`${API_URL}/api/inventory/settings`, {
          method: 'POST',
          body: JSON.stringify({ powderThreshold, wholeBeanThreshold })
        });
        const data = await res.json();
        if (data.success) {
          alert('Inventory threshold settings updated successfully!');
          fetchInventorySummary();
        }
      } catch (err) {
        alert(`Failed to update settings: ${err.message}`);
      }
    });
  }

  if (btnNotifyWaitingCustomers) {
    btnNotifyWaitingCustomers.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to send restock notifications to all waiting customers?')) return;
      try {
        const res = await apiFetch(`${API_URL}/api/inventory/notify-waiting`, { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'Waiting customers notified.');
      } catch (err) {
        alert(`Error notifying customers: ${err.message}`);
      }
    });
  }

  if (btnExportStockReport) {
    btnExportStockReport.addEventListener('click', async () => {
      try {
        const res = await apiFetch(`${API_URL}/api/inventory/summary`);
        const data = await res.json();
        if (!data.success) return;

        let csvContent = 'data:text/csv;charset=utf-8,Variant,Current Stock,Total Sold,Waiting Pre-Orders,Low Stock Threshold,Status\n';
        data.products.forEach(p => {
          csvContent += `"${p.variant}",${p.stock},${p.totalSold},${p.waitingCount},${p.lowStockThreshold},"${p.statusBadge}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `French_Roast_Stock_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        alert(`Export failed: ${err.message}`);
      }
    });
  }

  // --- INITIAL SILENT REFRESH CHECK ON PAGE LOAD ---
  attemptSilentRefresh().then(success => {
    if (success) {
      showDashboard();
      checkHealth();
    } else {
      showLoginStep1();
    }
  });
});
