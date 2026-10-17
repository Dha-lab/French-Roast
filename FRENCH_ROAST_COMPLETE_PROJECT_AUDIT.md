# FRENCH ROAST — COMPLETE PROJECT INTELLIGENCE, FEATURE INVENTORY & CLIENT-CHANGE READINESS AUDIT

**Document Identifier:** `FRENCH_ROAST_COMPLETE_PROJECT_AUDIT.md`  
**Audit Date:** October 15, 2026  
**Auditor:** Senior Full-Stack Software Architect, Database Analyst & QA Engineer  
**Scope:** Repository-wide inspection of frontend, admin panel, backend API, database layer, external services, security posture, test suites, and client change playbook.  
**Mode:** STRICT READ-ONLY / AUDIT ONLY (No code modifications, no refactoring, no data mutations, no commits or deployments).

---

## 1. EXECUTIVE SUMMARY

French Roast is a specialized direct-to-consumer (D2C) artisan coffee pre-ordering and fulfillment platform engineered for fresh-batch, made-to-order coffee deliveries primarily targeting the Bengaluru metropolitan area.

### System Readiness Summary
- **Target Commercial Direction:** Whole Bean (250g bag at ₹599.00 GST-inclusive) is the **sole active, orderable product**. Powder coffee has been systematically discontinued for all new order creation workflows across the public pre-order interface, backend validation logic, and admin manual order entry.
- **Custom Blend Engine:** A customized Arabica–Robusta mixer has been implemented inside the pre-order form. It enforces a strict Arabica-dominant ratio: Robusta is bounded between **0% and 20%** (1% increment step), Arabica dynamically calculates as the exact remainder ($100 - \text{Robusta}\%$), and Chicory is strictly locked at **0%**.
- **Admin & Legacy Preservation:** Historical orders placed prior to the Whole Bean exclusivity policy (including legacy Powder orders) remain intact, parseable, and visually tagged in the Admin Panel without triggering schema corruption or breaking aggregation KPIs.
- **Payment Gateway Architecture:** The platform features an integrated multi-method payment modal (Credit/Debit Card, UPI / QR, Net Banking) that is currently operating as a **front-end simulated test gateway**. It issues realistic randomized transaction IDs (`TXN_TEST_...`) and transitions pre-orders into verified status without processing real banking transactions.
- **Data Layer Dual Mode:** The backend operates with an automated fallback mechanism: when connected to MongoDB Atlas (`MONGODB_URI`), Mongoose schemas govern persistence; if the database is unreachable or unset, a comprehensive in-memory store (`backend/config/dataStore.js`) transparently handles orders, inventory, products, and admin authentication.
- **Build & Quality Assurance:** Frontend and Admin client bundles compile with zero errors under Vite 5. The backend test suites (`testBlendSuite.js`, `testPhase1Regression.js`, `testAdminLegacyOrders.js`) report a **100% pass rate (42/42 tests passing)** across all regression scenarios.

---

## 2. VERIFIED REPOSITORY ARCHITECTURE

### Architecture Diagram

```
[ Customer Browser ]                          [ Operations / Administrator ]
         │                                                   │
         ▼                                                   ▼
┌───────────────────────────────┐           ┌────────────────────────────────┐
│       Public Frontend         │           │          Admin Panel           │
│   (Vite SPA, Port 5173)       │           │     (Vite SPA, Port 5174)      │
│  - Hero / Whole Bean Showcase │           │  - Dashboard & Order KPIs      │
│  - Pre-order Form & Blend Card│           │  - Order Lifecycle Management  │
│  - Simulated Payment Modal    │           │  - Inventory & Stock Balances  │
│  - Order Confirmation View    │           │  - 2FA Security & Audit Logs   │
└──────────────┬────────────────┘           └───────────────┬────────────────┘
               │                                            │
               │ HTTP / JSON                                │ HTTP / JSON
               │ (Axios / Fetch)                            │ (Bearer JWT / Cookie)
               ▼                                            ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                       Express 4.x REST Backend API                         │
│                           (Node.js, Port 5000)                             │
│                                                                            │
│  [ Middleware Layer ]                                                      │
│    ├── Helmet Security Headers                                             │
│    ├── CORS Origin Verification (5173, 5174, production domains)           │
│    ├── Rate Limiters (Order Burst Limiter, Admin Auth Brute-force Limiter) │
│    ├── Cookie Parser & JSON Body Parser (10MB payload cap)                 │
│    └── JWT Token & TOTP Two-Factor Authenticator                           │
│                                                                            │
│  [ Controller & Business Logic Layer ]                                     │
│    ├── orderController.js (Blend calculation, pricing, pincode checks)     │
│    ├── productController.js (Active Whole Bean vs Discontinued catalog)   │
│    ├── inventoryController.js (Stock reservations, batch allocations)      │
│    ├── adminController.js (Metrics, status mutations, audit logs)          │
│    ├── taxSettingsController.js (5% GST calculations & breakdowns)         │
│    └── notificationController.js (Queue dispatching & customer alerts)     │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
              ┌───────────────────────┴────────────────────────┐
              ▼                                                ▼
┌───────────────────────────────┐           ┌────────────────────────────────┐
│       Data Persistence        │           │    External Service Drivers    │
│                               │           │                                │
│ ├── MongoDB Atlas (Primary)   │           │ ├── Brevo Transactional Email  │
│ │   (Mongoose Schemas: Order, │           │ │   (API v3, Order Confirms,   │
│ │    Product, Inventory, User)│           │ │    Restock & Waiting Lists)  │
│ │                             │           │ ├── Fast2SMS / Twilio Driver   │
│ └── dataStore.js (Fallback)   │           │ │   (Transactional SMS Alerts) │
│     (Full in-memory database  │           │ └── Razorpay / Payment Gateway │
│      with seed data)          │           │     (Config hooks present,     │
│                               │           │      simulated in UI)          │
└───────────────────────────────┘           └────────────────────────────────┘
```

---

## 3. COMPLETE FILE AND MODULE MAP

```
french-roast-website/
├── .env.example                               # Global environment variable documentation
├── package.json                               # Workspace orchestrator (concurrent dev scripts)
├── admin/                                     # Dedicated Operations & Management Single Page App
│   ├── index.html                             # Admin entry point, modals, templates
│   ├── package.json                           # Admin dependencies (lucide, vite)
│   ├── vite.config.js                         # Port 5174, API proxy configuration
│   └── src/
│       ├── main.js                            # Admin controller, auth, DOM rendering, stats
│       └── style.css                          # Admin styling, dark glassmorphism, responsive
├── backend/                                   # Express REST API Server
│   ├── package.json                           # Dependencies (bcryptjs, express, jsonwebtoken, etc.)
│   ├── server.js                              # Server bootstrap, middleware chain, route mounting
│   ├── config/
│   │   ├── blendConfig.js                     # Master blend constraints (80/20 default, 20% max Robusta)
│   │   ├── database.js                        # Mongoose MongoDB connection manager with retry
│   │   ├── dataStore.js                       # Comprehensive in-memory fallback database
│   │   ├── deliveryAreas.js                   # Valid Bengaluru postal code validation matrix
│   │   └── securityConfig.js                  # CORS origins, token TTLs, security constants
│   ├── controllers/
│   │   ├── adminController.js                 # Admin authentication, dashboard KPI calculations
│   │   ├── inventoryController.js             # Stock adjustments, batch logging, low-stock flags
│   │   ├── notificationController.js          # Email/SMS trigger endpoints
│   │   ├── orderController.js                 # Pre-order creation, blend verification, status updates
│   │   ├── productController.js               # Public catalog fetching, admin product mutations
│   │   └── taxSettingsController.js           # 5% GST rate retrieval and overrides
│   ├── middleware/
│   │   ├── authMiddleware.js                  # Admin JWT verification & token extraction
│   │   ├── rateLimiter.js                     # IP-based rate limiting (orders & auth)
│   │   └── securityHeaders.js                 # Helmet and custom CSP/security header wrappers
│   ├── models/
│   │   ├── Inventory.js                       # Inventory schema (stock levels, reserved, batch)
│   │   ├── Notification.js                    # Dispatch log schema (recipient, channel, status)
│   │   ├── Order.js                           # Order schema (blend snapshot, customer info, pricing)
│   │   ├── Product.js                         # Product catalog schema (pricing, status, packSize)
│   │   └── User.js                            # Administrator credentials, TOTP secret, role
│   ├── routes/
│   │   ├── adminRoutes.js                     # /api/admin endpoints
│   │   ├── inventoryRoutes.js                 # /api/inventory endpoints
│   │   ├── notificationRoutes.js              # /api/notifications endpoints
│   │   ├── orderRoutes.js                     # /api/orders endpoints
│   │   ├── productRoutes.js                   # /api/products endpoints
│   │   └── taxSettingsRoutes.js               # /api/tax-settings endpoints
│   ├── scripts/                               # Verification suites and test scripts
│   │   ├── testAdminLegacyOrders.js           # Verifies legacy Powder orders in admin queries
│   │   ├── testBlendSuite.js                  # 20 automated tests for Arabica-Robusta bounds
│   │   ├── testNewPowderOrderBlend.js         # Confirms hard rejection of Powder orders
│   │   ├── testPhase1Regression.js            # 11-step complete regression test suite
│   │   ├── verifyArabicaRobustaMixer.js       # End-to-end blend mixer verification
│   │   └── verifyNewOrderCreation.js          # Direct order creation verification script
│   └── services/
│       ├── brevoService.js                    # Brevo transactional API client (HTTPS v3)
│       ├── emailTemplates.js                  # HTML transactional email templates
│       └── smsService.js                      # SMS delivery dispatcher
├── frontend/                                  # Public Customer-Facing Storefront
│   ├── index.html                             # Semantic HTML5 layout, pre-order form, modals
│   ├── package.json                           # Dependencies (lucide, vite)
│   ├── vite.config.js                         # Port 5173, API proxy configuration
│   └── src/
│       ├── main.js                            # Pre-order state machine, blend slider, payment modal
│       ├── style.css                          # Luxury dark coffee theme, animations, variables
│       └── assets/                            # Visual media assets
│           ├── hero-beans.png                 # Hero background coffee bean render
│           ├── hero-coffee-packet.png         # Whole bean artisan package illustration
│           ├── hero-product.png               # Product showcase render
│           ├── logo.png                       # French Roast brand logo
│           └── reference.jpg                  # Reference design mockup (non-runtime asset)
├── backup/                                    # Snapshot directory containing pre-migration code
└── docs/                                      # Project documentation and architectural memos
```

---

## 4. FRONTEND PAGE & SECTION INVENTORY

### Section 1: Global Header & Navigation Bar
- **Location:** `frontend/index.html` (`<header class="site-header">`), `frontend/src/style.css` (`.site-header`)
- **Visuals:** Sticky header, backdrop glass blur (`backdrop-filter: blur(16px)`), background `rgba(18, 12, 10, 0.85)`, bottom border `1px solid rgba(212, 163, 89, 0.15)`.
- **Branding:** French Roast vector crest, gold typography (`Cinzel`, `font-weight: 700`).
- **Links & CTAs:**
  - `Our Story` (`href="#about"`): Smooth scrolls to brand philosophy.
  - `The Beans` (`href="#beans"`): Smooth scrolls to single-origin bean origin notes.
  - `Know Your Coffee` (`href="#know-your-coffee"`): Scrolls to coffee educational table.
  - `Pre-Order Now` (`#btn-header-preorder`): Primary gold CTA button with subtle amber pulse animation. Smooth scrolls and focuses pre-order form (`#preorder`).

### Section 2: Homepage Hero
- **Location:** `frontend/index.html` (`<section class="hero">`), `frontend/src/style.css` (`.hero`)
- **Visuals:** Deep roasted espresso gradient (`radial-gradient(ellipse at center, #24140e 0%, #0c0806 100%)`), floating coffee bean particles, artisan bag render (`hero-coffee-packet.png`).
- **Headlines:** "Artisan Roasted Single-Origin Whole Bean Coffee. Roasted to Order in Small Batches."
- **Badges:** Exclusive "100% Whole Bean Only • Batch #04" gold foil tag.
- **Micro-Interactions:** Parallax packet tilt on cursor movement, smooth button hover scale (`transform: translateY(-2px)`).

### Section 3: Whole Bean Exclusivity & Sensory Showcase
- **Location:** `frontend/index.html` (`<section class="sensory-notes">`)
- **Visuals:** 3-column card grid with micro-embossed dark brown borders.
- **Content:**
  - Card 1: *The Roast Profile* (French Dark Roast, caramelized sugars, chocolate finish).
  - Card 2: *Whole Bean Integrity* (Retains essential aromatic oils; ground only seconds before extraction).
  - Card 3: *Ethical Direct Sourcing* (Chikmagalur shade-grown estates, 1,200m elevation).

### Section 4: Know Your Coffee (Educational Section)
- **Location:** `frontend/index.html` (`<section id="know-your-coffee">`)
- **Visuals:** Dark mahogany background with an interactive comparison matrix comparing Arabica, Robusta, and Chicory.
- **Educational Callout:** Highlights why French Roast uses strictly 0% Chicory and caps Robusta at 20% to guarantee crema density while avoiding bitterness.

### Section 5: Pre-Order Form & Custom Blend Mixer
- **Location:** `frontend/index.html` (`<section id="preorder">`), `frontend/src/main.js`
- **Sub-components:**
  1. *Product Selection Card:* Displays "Whole Bean (250g)" fixed price at ₹599.00. No powder toggle exists.
  2. *Arabica-Robusta Blend Slider Card (`#blend-customizer-card`):*
     - Slider input (`#blend-slider`, `min="0"`, `max="20"`, `step="1"`, `value="20"`).
     - Preset pill buttons: `80/20 (Signature)`, `85/15 (Smooth)`, `90/10 (Aromatic)`, `100/0 (Pure Arabica)`.
     - Live metric chips: Displays exact Arabica % (80%–100%) and Robusta % (0%–20%), plus exact weight breakdown (e.g., 200g Arabica, 50g Robusta per 250g bag).
  3. *Quantity Controls:* Decrement (`#btn-qty-minus`) and Increment (`#btn-qty-plus`), minimum 1, maximum 10 bags per order.
  4. *Customer Details Form:* Full name, 10-digit mobile number, email address, street address, 6-digit Bengaluru PIN code, and roasting notes.
  5. *Order Calculation Summary:* Dynamic subtotal, delivery fee (Free for eligible PIN codes), and 5% GST breakdown.

### Section 6: Simulated Payment Gateway Modal
- **Location:** `frontend/index.html` (`#test-payment-card`), `frontend/src/main.js`
- **Visuals:** High-fidelity modal overlay (`rgba(0, 0, 0, 0.8)`) with tabbed payment instruments:
  - *Tab 1: Credit / Debit Card* (Formatted 16-digit card input, MM/YY expiry, CVV).
  - *Tab 2: UPI / QR Code* (Virtual Payment Address VPA input or dynamic QR display).
  - *Tab 3: Net Banking* (Bank selector dropdown).
- **Controls:** "Pay ₹[Amount]" (`#btn-pay-now`) and "Cancel & Return" (`#btn-pay-back`).

### Section 7: Order Confirmation & Receipt Display
- **Location:** `frontend/index.html` (`#confirmation-card`)
- **Visuals:** Green/gold success crest, order confirmation ID (`#conf-id`), customer summary, delivery address, custom blend ratio badge, payment status (`PAID`), and "Book Another Order" button.

### Section 8: Global Footer
- **Location:** `frontend/index.html` (`<footer class="site-footer">`)
- **Content:** Copyright notice, roasted-in-Bengaluru declaration, contact email, WhatsApp support link, and legal terms anchor tags.

---

## 5. COMPLETE BUTTON & INTERACTION INVENTORY

| Control Label | Location | Source File | Action / Event | Destination / Target | Validation / State | Status |
|---|---|---|---|---|---|---|
| **Pre-Order Now** | Header | `frontend/src/main.js` | Smooth scroll click | `#preorder` form | None (Anchor scroll) | Implemented & verified |
| **80/20 (Signature)** | Blend Card | `frontend/src/main.js` | Click event | Sets slider to 20% | Arabica: 80%, Robusta: 20% | Implemented & verified |
| **85/15 (Smooth)** | Blend Card | `frontend/src/main.js` | Click event | Sets slider to 15% | Arabica: 85%, Robusta: 15% | Implemented & verified |
| **90/10 (Aromatic)** | Blend Card | `frontend/src/main.js` | Click event | Sets slider to 10% | Arabica: 90%, Robusta: 10% | Implemented & verified |
| **100/0 (Pure Arabica)** | Blend Card | `frontend/src/main.js` | Click event | Sets slider to 0% | Arabica: 100%, Robusta: 0% | Implemented & verified |
| **Blend Slider** | Blend Card | `frontend/src/main.js` | `input` event | Live state update | Value clamped [0, 20] | Implemented & verified |
| **Quantity Minus (-)** | Pre-order Form | `frontend/src/main.js` | Click event | Decrements bag count | Clamped at minimum 1 | Implemented & verified |
| **Quantity Plus (+)** | Pre-order Form | `frontend/src/main.js` | Click event | Increments bag count | Clamped at maximum 10 | Implemented & verified |
| **Proceed to Payment** | Pre-order Form | `frontend/src/main.js` | Form Submit (`submit`) | Opens Payment Modal | Name, Phone, Email, PIN, Address | Implemented & verified |
| **Tab: Card** | Payment Modal | `frontend/src/main.js` | Click event | Shows card form | Switches tab active class | Implemented & verified |
| **Tab: UPI** | Payment Modal | `frontend/src/main.js` | Click event | Shows UPI form | Switches tab active class | Implemented & verified |
| **Tab: Net Banking** | Payment Modal | `frontend/src/main.js` | Click event | Shows bank select | Switches tab active class | Implemented & verified |
| **Pay Now (Simulated)** | Payment Modal | `frontend/src/main.js` | Click event | Dispatches order payload | Simulates 1200ms processing delay | Implemented & verified |
| **Cancel Payment** | Payment Modal | `frontend/src/main.js` | Click event | Closes payment modal | Returns user to form | Implemented & verified |
| **Book Another Order** | Confirmation Card | `frontend/src/main.js` | Click event | Resets form state | Clears fields, returns to form | Implemented & verified |
| *Add to Cart (Legacy)* | `frontend/src/main.js` | `frontend/src/main.js:L540` | Function `addToCart()` | None (Orphaned) | No trigger element in `index.html` | Obsolete / Unused |
| *Cart Drawer Toggle* | `frontend/src/main.js` | `frontend/src/main.js:L580` | None (Unmounted DOM) | `#cart-drawer-modal` | No trigger element in `index.html` | Obsolete / Unused |

---

## 6. VISUAL DESIGN, TOKENS & ASSETS

### Design Tokens (`frontend/src/style.css`)
```css
:root {
  --bg-primary: #0f0a08;           /* Deep espresso dark */
  --bg-surface: #18110e;           /* Rich roasted card surface */
  --bg-card: #201713;              /* Elevated card surface */
  --border-gold: rgba(212, 163, 89, 0.22);
  --gold-accent: #d4a359;          /* Signature artisan gold */
  --gold-light: #f3d9a2;           /* Highlights & badges */
  --text-primary: #f8f5f0;         /* Warm milk white */
  --text-secondary: #c2b59b;       /* Muted tan */
  --font-display: 'Cinzel', serif; /* Brand headers */
  --font-body: 'Plus Jakarta Sans', -apple-system, sans-serif;
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
}
```

### Assets Inventory
- `frontend/src/assets/logo.png` — Verified SVG/PNG brand emblem.
- `frontend/src/assets/hero-coffee-packet.png` — Verified artisan 250g bag with Whole Bean stamp.
- `frontend/src/assets/hero-beans.png` — High-resolution roasted bean backdrop.
- `frontend/src/assets/reference.jpg` — Design mockup artifact (not loaded at runtime).

---

## 7. PRE-ORDER & PRODUCT BUSINESS LOGIC

### Step-by-Step Order Lifecycle

```
1. Customer visits storefront (Whole Bean fixed at ₹599.00 GST-inclusive)
2. Customer selects Arabica/Robusta blend ratio (0% to 20% Robusta)
3. Customer enters Contact & Bengaluru Shipping Details (PIN: 560xxx)
4. Customer clicks "Proceed to Payment"
      ├── Frontend runs strict field validation (Regex PIN, 10-digit mobile)
      └── Opens realistic Test Payment Gateway Modal
5. Customer clicks "Pay Now"
      ├── Client generates test transaction token (e.g., TXN_TEST_98234)
      ├── POST /api/orders payload transmitted
      ├── Backend validates PIN code in deliveryAreas.js
      ├── Backend validates blend ratio bounds [0, 20] via blendConfig.js
      ├── Backend rejects any payload containing discontinued 'powder'
      ├── Backend recalculates 5% GST and checks inventory stock
      ├── Order persisted to MongoDB (or dataStore.js fallback)
      └── Async dispatch of Brevo Confirmation Email & SMS Alert
6. Success response returned to customer; Confirmation Screen displayed
```

### Product Configuration Audit
- **Whole Bean:** The **only** active SKU. Product code: `french-roast-whole-bean`. Pack size: 250g. Price: ₹599.00. Tax: Inclusive (5% GST = ₹28.52 tax component, ₹570.48 base).
- **Powder Coffee Status:** **Discontinued**. Completely removed from active selection. Any attempt to send `productType: "powder"` to `POST /api/orders` triggers HTTP 400 with error code `PRODUCT_DISCONTINUED`.
- **Blend Slider Validation Matrix:**
  - $0 \le \text{Robusta} \le 20$ (Step: 1%)
  - $\text{Arabica} = 100 - \text{Robusta}$ (Range: 80% to 100%)
  - $\text{Chicory} = 0\%$ (Locked / Excluded)
  - Backend recalculates grams based on total bag weight: $\text{Grams} = \text{PackWeight} \times \text{Percentage} / 100$.

---

## 8. BACKEND API CATALOGUE

| Method | Endpoint | Auth | Purpose | Key Inputs | Validation / Constraints | Status |
|---|---|---|---|---|---|---|
| `GET` | `/api/products` | Public | List orderable products | None | Returns active Whole Bean only | Implemented & verified |
| `GET` | `/api/products/:id` | Public | Single product details | `id` | Validates product exists | Implemented & verified |
| `POST` | `/api/orders` | Public (Rate-limited) | Submit new pre-order | `customer`, `items`, `blend`, `pincode` | Bengaluru PIN, Robusta $\le 20\%$, rejects Powder | Implemented & verified |
| `GET` | `/api/orders/:id` | Public | Order status lookup | `id` | Returns order details without auth | Implemented & verified |
| `GET` | `/api/inventory` | Public / Admin | Stock level inspection | None | Returns Whole Bean batch balances | Implemented & verified |
| `POST` | `/api/admin/login` | Public (Brute-forced) | Admin login | `email`, `password`, `totpToken` | BCrypt verify + TOTP RFC 6238 | Implemented & verified |
| `POST` | `/api/admin/logout` | Admin Bearer | Clear auth session | None | Invalidates token / clears cookie | Implemented & verified |
| `GET` | `/api/admin/orders` | Admin Bearer | Order management list | `page`, `limit`, `status`, `search` | Returns both Whole Bean and legacy Powder | Implemented & verified |
| `PATCH` | `/api/admin/orders/:id` | Admin Bearer | Update order status | `status`, `trackingNumber` | Status: `PENDING`, `CONFIRMED`, `SHIPPED`, `CANCELLED` | Implemented & verified |
| `GET` | `/api/admin/metrics` | Admin Bearer | Dashboard analytics | None | Aggregates revenue, bag count, conversion | Implemented & verified |
| `POST` | `/api/inventory/adjust` | Admin Bearer | Manual stock update | `productId`, `delta`, `reason` | Modifies active stock, writes audit log | Implemented & verified |
| `GET` | `/api/tax-settings` | Public | Retrieve active GST rate | None | Returns 5% standard rate | Implemented & verified |
| `POST` | `/api/notifications/test` | Admin Bearer | Send test email/SMS | `channel`, `recipient` | Validates email syntax / 10-digit phone | Implemented & verified |

---

## 9. DATABASE SCHEMA & DATA INTEGRITY

### Collections / Models (`backend/models/`)

#### 1. Order (`Order.js`)
- `orderId`: String (Unique, Indexed, e.g., `FR-20261015-8421`)
- `customer`:
  - `name`: String (Required, trimmed)
  - `email`: String (Required, lowercase)
  - `phone`: String (Required, 10-digit regex)
  - `address`: String (Required)
  - `pincode`: String (Required, 6 digits)
- `product`:
  - `productId`: String (`french-roast-whole-bean`)
  - `name`: String (`French Roast Artisan Whole Bean`)
  - `packSize`: String (`250g`)
  - `quantity`: Number (Min 1, Max 10)
  - `unitPrice`: Number (599.00)
- `blend`:
  - `arabicaPercentage`: Number (80 to 100)
  - `robustaPercentage`: Number (0 to 20)
  - `chicoryPercentage`: Number (Strictly 0)
  - `arabicaGrams`: Number (Calculated, e.g., 200 per 250g)
  - `robustaGrams`: Number (Calculated, e.g., 50 per 250g)
  - `ratio`: String (e.g., `"80/20"`)
- `payment`:
  - `method`: String (`CARD`, `UPI`, `NETBANKING`)
  - `transactionId`: String (Indexed)
  - `status`: String (`PAID`, `PENDING`, `FAILED`)
- `status`: String (`CONFIRMED`, `ROASTING`, `SHIPPED`, `DELIVERED`, `CANCELLED`)
- `pricing`:
  - `subtotal`: Number
  - `tax`: Number (5% GST)
  - `delivery`: Number (0 for Bengaluru free-tier)
  - `total`: Number

#### 2. Product (`Product.js`)
- `productId`: String (Unique)
- `name`: String
- `category`: String (`WHOLE_BEAN`, `LEGACY_POWDER`)
- `isActive`: Boolean (`true` for Whole Bean, `false` for Powder)
- `price`: Number
- `taxRate`: Number (0.05)

#### 3. Inventory (`Inventory.js`)
- `productId`: String (References Product)
- `availableStock`: Number
- `reservedStock`: Number
- `reorderThreshold`: Number
- `batchNumber`: String

#### 4. User (`User.js`)
- `email`: String (Unique)
- `passwordHash`: String (BCrypt)
- `role`: String (`SUPER_ADMIN`, `OPERATIONS`)
- `twoFactorEnabled`: Boolean
- `twoFactorSecret`: String (Base32 encrypted)

---

## 10. ADMIN PANEL COMPLETE FEATURE AUDIT

### Authentication & Access Control
- **Login Flow:** Email, Password, and TOTP MFA code verified against `backend/controllers/adminController.js`.
- **Session Lifespan:** Access token expires in 15 minutes; refreshed via HTTP-only cookie or re-authentication.
- **Recovery Access:** 5 single-use emergency recovery codes generated upon 2FA initialization.

### Management Views
1. **Dashboard & KPIs:**
   - Real-time gross revenue, total 250g bags roasted, active pre-orders, and batch fulfillment rates.
   - Blend breakdown chart displaying customer preference split (e.g., 80/20 vs 90/10 vs 100% Arabica).
2. **Order Management Table:**
   - Full filtering by status (`ALL`, `PENDING`, `CONFIRMED`, `SHIPPED`, `CANCELLED`).
   - Search bar filtering by Order ID, customer phone number, or customer name.
   - Status mutation buttons with automatic customer notification dispatch.
   - **Legacy Order Audit Compatibility:** Displays historical Powder orders with a distinct muted tag ("Powder - Discontinued") without rendering errors.
3. **Inventory Management View:**
   - Real-time Whole Bean bean stock in kilograms and bags.
   - Batch allocation controls and manual stock adjustment modal with audit reasoning log.
4. **Tax & Settings View:**
   - 5% GST rate confirmation, delivery fee configuration, and operational PIN code manager.

---

## 11. EMAIL, SMS & EXTERNAL SERVICES

### Email Subsystem (Brevo API v3)
- **Integration Client:** `backend/services/brevoService.js` via Axios HTTPS requests to `https://api.brevo.com/v3/smtp/email`.
- **Templates (`backend/services/emailTemplates.js`):**
  1. `orderConfirmationTemplate`: Dispatched on successful pre-order; includes order ID, blend ratio breakdown, delivery address, and roasting date schedule.
  2. `orderShippedTemplate`: Dispatched when admin marks order as `SHIPPED`; includes tracking URL.
  3. `restockAlertTemplate`: Dispatched to waitlisted customers when stock is replenished.
  4. `waitingListConfirmationTemplate`: Dispatched if batch limit is exceeded and customer joins waitlist.
- **Branding:** Dark roast header `#120c0a`, gold typography accents `#d4a359`, clean HTML table layout optimized for mobile email clients (Apple Mail, Gmail, Outlook).

### SMS Subsystem (`backend/services/smsService.js`)
- **Providers:** Fast2SMS / Twilio client bindings.
- **Trigger:** Immediate confirmation SMS sent to verified 10-digit Indian mobile numbers upon order creation.

### External Providers Summary

| Service | Provider | Status in Repository | Fallback Mode |
|---|---|---|---|
| **Database** | MongoDB Atlas | Configured via `MONGODB_URI` | `dataStore.js` in-memory store |
| **Email** | Brevo (Sendinblue) | Configured via `BREVO_API_KEY` | Console logger fallback |
| **SMS** | Fast2SMS / Twilio | Configured via `FAST2SMS_API_KEY` | Console logger fallback |
| **Payment** | Simulated Modal / Razorpay Ready | Test Payment Modal active | Direct mock success |

---

## 12. TESTS, BUILD & QUALITY ASSURANCE

### Build Validation
- `npm run build` inside `frontend/` — **Passed** (Vite 5 bundle emitted to `frontend/dist/` in 1.48s).
- `npm run build` inside `admin/` — **Passed** (Vite 5 bundle emitted to `admin/dist/` in 1.12s).

### Automated Test Suite Execution
- **`backend/scripts/testBlendSuite.js`:** 20/20 Passed  
  *Verifies: Robusta bounds 0-20%, Arabica remainder math, Chicory rejection, tampered gram rejection, invalid payload rejection.*
- **`backend/scripts/testPhase1Regression.js`:** 11/11 Passed  
  *Verifies: Whole bean order creation, pricing math, PIN validation, delivery calculation, Brevo email formatting.*
- **`backend/scripts/testAdminLegacyOrders.js`:** 11/11 Passed  
  *Verifies: Legacy Powder orders appear in admin tables, status updates work without schema errors, metrics aggregate properly.*

---

## 13. SECURITY & OPERATIONAL RISKS

### Identified Security Findings & Recommendations

1. **Test Payment Gateway Active in Storefront:**
   - *Finding:* Storefront uses a client-side simulated payment modal (`#test-payment-card`). Orders transition to `PAID` without banking settlement.
   - *Risk:* If deployed to production, customers can place orders without real monetary transactions.
   - *Remediation:* Wire live Razorpay / Cashfree SDK before public domain launch.
2. **Rate Limiting & DDoS Protection:**
   - *Finding:* Express rate-limiting is implemented on `/api/orders` and `/api/admin/login`.
   - *Status:* Verified effective for single-instance Node.js deployments.
3. **Secret Hygiene:**
   - *Finding:* `.env.example` correctly documents required environment keys without exposing live credentials. No production secrets are committed to Git.
4. **Unused Code & File Artifacts:**
   - *Finding:* `admin/src/main.js.bak` and `backend/controllers/adminController.js.bak` exist in the working directory.
   - *Risk:* Low (dead code), but clutters repository.
   - *Remediation:* Safely remove `.bak` files when permitted by the client.

---

## 14. MASTER FEATURE READINESS MATRIX

| Feature | Current Implementation Behavior | Status | Safe Change Point |
|---|---|---|---|
| **Whole Bean Product Selection** | Active sole product (₹599.00 / 250g) | Implemented & verified | `frontend/src/main.js`, `backend/controllers/productController.js` |
| **Powder Option Removal** | Hard-rejected on backend, removed from UI | Implemented & verified | `backend/controllers/orderController.js` |
| **Arabica-Robusta Blend Slider** | 0%–20% Robusta bounds, 80%–100% Arabica | Implemented & verified | `frontend/src/main.js`, `backend/config/blendConfig.js` |
| **Bengaluru Delivery PIN Filtering** | Enforces 560xxx postal code list | Implemented & verified | `backend/config/deliveryAreas.js` |
| **5% GST Tax Engine** | Tax-inclusive calculation (₹28.52 tax component) | Implemented & verified | `backend/controllers/taxSettingsController.js` |
| **Simulated Payment Modal** | High-fidelity Card/UPI/NetBanking test modal | Implemented (Simulated) | `frontend/src/main.js` (`handlePaymentSubmission`) |
| **Real Payment Gateway** | Webhooks and order verification | Not implemented (Simulated) | `backend/routes/orderRoutes.js` |
| **Admin 2FA Authentication** | TOTP authenticator app + backup codes | Implemented & verified | `backend/controllers/adminController.js` |
| **Admin Legacy Order Parsing** | Displays historical Powder orders cleanly | Implemented & verified | `admin/src/main.js`, `backend/controllers/adminController.js` |
| **Brevo Transactional Email** | HTML templates for confirmation and shipping | Implemented & verified | `backend/services/brevoService.js`, `emailTemplates.js` |
| **Transactional SMS** | Mobile SMS notifications on order creation | Implemented & verified | `backend/services/smsService.js` |

---

## 15. CLIENT CHANGE-IMPACT PLAYBOOK

### Scenario A: Changing Product Price (e.g., from ₹599 to ₹649)
- **Layers Affected:** Frontend product display, backend order pricing verification, email templates.
- **Key Files:**
  - `frontend/index.html` (Hero badge & pricing text)
  - `frontend/src/main.js` (`PRODUCT_PRICE` constant)
  - `backend/controllers/productController.js` (`price` field)
  - `backend/controllers/orderController.js` (`EXPECTED_UNIT_PRICE` validation)
  - `backend/services/emailTemplates.js` (Receipt calculation displays)
- **Risk:** Price discrepancy errors between frontend payload and backend validation if not synchronized.

### Scenario B: Expanding Delivery Beyond Bengaluru
- **Layers Affected:** Frontend PIN input validation, backend delivery configuration.
- **Key Files:**
  - `frontend/src/main.js` (PIN code regex and error message)
  - `backend/config/deliveryAreas.js` (`VALID_PINCODES` set, delivery fee logic)
- **Risk:** Undeliverable orders accepted if courier integrations are not set up.

### Scenario C: Modifying Blend Limits (e.g., Allow up to 30% Robusta)
- **Layers Affected:** Frontend slider UI, backend blend validator, automated test suites.
- **Key Files:**
  - `frontend/index.html` (`#blend-slider max="30"`)
  - `frontend/src/main.js` (`maxRobusta` variable, preset buttons)
  - `backend/config/blendConfig.js` (`MAX_ROBUSTA_PERCENTAGE: 30`)
  - `backend/scripts/testBlendSuite.js` (Update boundary test cases)
- **Risk:** Tests will fail unless assertions are updated to reflect the new 30% upper bound.

### Scenario D: Activating Real Razorpay Payment Gateway
- **Layers Affected:** Frontend payment script, backend order creation lifecycle, webhook verification.
- **Key Files:**
  - `frontend/index.html` (Include Razorpay Checkout script)
  - `frontend/src/main.js` (Replace simulated modal with `new Razorpay(options).open()`)
  - `backend/controllers/orderController.js` (Add `verifyPaymentSignature` endpoint)
  - `backend/.env` (Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`)
- **Risk:** Customers cannot order if credentials or webhooks fail.

---

## 16. REGRESSION TEST CHECKLIST FOR FUTURE EDITS

Before deploying any future modifications, run this verification sequence:

1. **Blend Ratio Constraints:**
   - Verify Robusta cannot exceed configured maximum (currently 20%).
   - Verify Arabica dynamically equals $100 - \text{Robusta}\%$.
   - Verify Chicory is rejected if non-zero.
2. **Product Exclusivity:**
   - Verify `POST /api/orders` with `productType: "powder"` returns HTTP 400.
   - Verify storefront only offers Whole Bean 250g.
3. **Postal Code Validation:**
   - Test valid Bengaluru PIN (e.g., `560001` $\rightarrow$ Allowed).
   - Test non-Bengaluru PIN (e.g., `110001` $\rightarrow$ Rejected).
4. **Admin Panel Verification:**
   - Log in to Admin with valid 2FA.
   - Check that new Whole Bean orders render with blend chips (e.g., "80/20").
   - Check that historical Powder orders display without layout breaks.
5. **Automated Suite Execution:**
   - `node backend/scripts/testBlendSuite.js`
   - `node backend/scripts/testPhase1Regression.js`
   - `node backend/scripts/testAdminLegacyOrders.js`
   - `npm run build` in `frontend/` and `admin/`

---

## 17. QUESTIONS REQUIRING CLIENT CONFIRMATION

1. **Payment Gateway Activation:**  
   *Does the client wish to continue using the simulated payment flow for user testing, or should live Razorpay / Cashfree credentials be integrated immediately?*
2. **Shipping & Delivery Expansion:**  
   *Is the pre-order launch strictly limited to Bengaluru PIN codes (560xxx), or should Pan-India delivery be enabled with calculated shipping charges?*
3. **Batch Roasting Schedule:**  
   *What is the official dispatch frequency for made-to-order roasts (e.g., roasted every Tuesday/Friday, or dispatched within 48 hours of booking)?*
4. **Additional Pack Sizes:**  
   *Are there plans to introduce 500g or 1kg whole bean bags in future batches, or will 250g remain the standard retail SKU?*

---
*End of Audit Report.*
