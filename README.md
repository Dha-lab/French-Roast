# French Roast

French Roast is an artisanal coffee pre-order platform built with Node.js, Express, MongoDB Atlas, and Vite. The system consists of a customer-facing pre-order storefront, a separate web-based operations/admin panel, and a RESTful backend API.

The current customer product configuration supports **250g Powder** and **250g Whole Bean**, with delivery restricted to **Bengaluru**. Customer orders currently function as **unpaid pre-order reservations**; HDFC payment gateway integration is not implemented.

---

## Project Status

| Feature / Module | Status |
|---|---|
| Public Storefront | Operational |
| Backend REST API | Operational |
| MongoDB Atlas | Operational |
| Bengaluru PIN Validation | Operational |
| Admin Operations Panel | Operational (Web) |
| Admin Authentication | Operational |
| Admin 2FA | Operational |
| Inventory Management | Operational |
| Waiting Pre-Orders | Operational |
| Order Confirmation Email | Operational |
| Pre-Order Opening Email | Operational |
| Waiting Stock Email | Operational |
| Brevo Transactional SMS Integration | Operational; Brevo SMS credits/sender configuration required |
| Windows Desktop App (Tauri) | Removed (Admin Panel is web-only) |
| HDFC Payment Gateway | Not implemented |
| Android Mobile App | Not implemented |

---

## Architecture

```text
                         FRENCH ROAST
                              |
             +----------------+----------------+
             |                                 |
             v                                 v
      Public Storefront              Admin Operations Panel
             |                                 |
             +----------------+----------------+
                              |
                              v
                     Express Backend API
                              |
                         +--------------+--------------+
                         |                             |
                         v                             v
                  MongoDB Atlas                    Brevo
                                                /          \
                                             Email         SMS
```

### Production services

- Backend API: `https://french-roast-backend.onrender.com`
- Public storefront: `https://french-roast.onrender.com/`

The web Admin Panel reuses the same backend API and business logic.

---

## Technology Stack

### Public Storefront

- HTML5
- CSS
- Vanilla JavaScript / ES Modules
- Vite
- Tailwind CSS

### Admin Panel

- HTML5
- Vanilla JavaScript / ES Modules
- Vite
- Tailwind CSS

### Backend

- Node.js
- Express.js
- MongoDB Atlas
- Mongoose
- JWT authentication
- bcrypt/bcryptjs password hashing
- TOTP/2FA
- QR-code support for 2FA
- Helmet security headers
- Express rate limiting
- CORS
- Cookie handling

### External Services

- Brevo Transactional Email
- Brevo Transactional SMS
- MongoDB Atlas

---

## Repository Structure

```text
French-Roast/
├── frontend/                         # Public customer storefront
│   ├── src/
│   │   ├── assets/
│   │   ├── main.js
│   │   └── style.css
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── admin/                            # Admin web operations panel
│   ├── public/
│   │   └── images/
│   │       └── products/
│   ├── src/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/                          # Express REST API
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── scripts/
│   ├── utils/
│   ├── data/
│   ├── server.js
│   ├── .env.example
│   └── package.json
│
├── package.json                      # Root development/build scripts
├── .gitignore
└── README.md
```

Generated/local directories such as `node_modules/`, `dist/`, and `.env` files should not be committed.

---

# Core Features

## 1. Customer Storefront

The public website provides the customer pre-order experience.

### Current products

- Powder — 250g
- Whole Bean — 250g

The customer-facing website is intentionally pre-order focused and does not expose internal inventory quantities.

The pre-order form supports the current customer information fields, including:

- Full name
- Mobile number
- Email
- Coffee type
- Pack size
- Quantity
- Delivery address
- Bengaluru PIN code
- Notes
- Notification opt-in where applicable

---

## 2. Bengaluru Delivery Validation

Delivery is currently restricted to **Bengaluru**.

The backend is the final authority for delivery-area validation.

Invalid/outside-area PIN codes are rejected before the order is created.

The supported Bengaluru PIN-code dataset is maintained in the backend delivery-area configuration.

---

## 3. Orders and Pre-Orders

The current ordering flow is:

```text
Customer
   |
   v
Select Powder / Whole Bean
   |
   v
Select 250g
   |
   v
Enter customer information
   |
   v
Enter Bengaluru PIN
   |
   v
Backend validation
   |
   v
Order creation
   |
   v
MongoDB
   |
   +---- Customer confirmation
   |
   +---- Email/SMS notification where configured
   |
   v
Admin Panel
```

Orders currently represent **unpaid reservations**.

### Payment status

Online payment is not currently processed.

HDFC payment gateway integration is a future feature and requires actual merchant/gateway credentials and integration documentation.

---

## 4. Inventory Management

Inventory is managed through the Admin Panel.

Current inventory products:

- Powder 250g
- Whole Bean 250g

The Admin Panel inventory system supports the implemented stock-management features, including:

- Current stock
- Total sold
- Waiting pre-orders
- Low-stock threshold
- Out-of-stock state
- Add stock
- Remove stock
- Set stock
- Stock history
- Waiting pre-orders
- Restock notifications
- Inventory insights
- Inventory export where implemented

The customer storefront does not expose internal stock quantities.

---

## 5. Waiting Pre-Orders

When the relevant product is unavailable, the implemented order/inventory flow can place the order into a waiting-stock state.

Admin workflow:

```text
Inventory
   |
   v
Waiting Pre-Orders
   |
   v
Select waiting customer
   |
   v
NOTIFY
   |
   v
Backend
   |
   v
Brevo
   |
   v
Waiting-stock email
```

The waiting-stock notification uses a dedicated notification flow rather than reusing the normal order-confirmation template.

---

# Notification Systems

| Notification | Trigger | Recipient |
|---|---|---|
| Order Confirmation | Customer order | Customer |
| Pre-Order Opening | Admin notification batch | Opted-in subscribers |
| Waiting Stock | Admin clicks NOTIFY | Waiting customer |
| Order Confirmation SMS | Customer order, when configured | Customer |

## Order Confirmation Email

After a successful order creation, the backend can send the customer's order confirmation through Brevo Transactional Email.

Duplicate protection is implemented for the order-confirmation flow.

Email delivery failure does not invalidate the underlying order.

## Pre-Order Opening Notifications

Customers can opt in to be notified when French Roast pre-orders open.

The Admin Panel provides subscriber management and batch notification functionality, including eligible-subscriber filtering and batch-based duplicate protection.

## Waiting Stock Notifications

The Admin Panel provides a **NOTIFY** action for waiting pre-orders.

The backend uses a dedicated waiting-restock email template/service.

## Transactional SMS

Brevo Transactional SMS is integrated for order-confirmation messaging.

The SMS service handles Indian phone-number normalization and uses the configured Brevo SMS sender.

The current Brevo Transactional SMS API integration uses:

```text
POST https://api.brevo.com/v3/transactionalSMS/send
```

Brevo SMS requires the appropriate account configuration, sender setup, and available SMS credits.

---

# Admin Panel

## Dashboard

The Admin Panel is a separate operations application providing visibility into areas such as:

- Pre-orders
- Quantity
- Powder orders
- Whole Bean orders
- Order status
- Recent orders
- Activity
- Inventory
- Subscribers
- Notifications

## Admin Authentication

Implemented security mechanisms include:

- Username/password authentication
- Password hashing
- JWT access tokens
- Refresh tokens
- Logout/session revocation
- TOTP 2FA
- QR-code setup
- Recovery codes
- Password change
- Protected admin routes
- Audit logging
- Rate limiting
- Security headers

Never place an admin password, password hash, JWT secret, recovery code, MongoDB credential, or Brevo API key in this repository.

---

# Windows Desktop Application (Retired)

The Windows desktop version using Tauri has been completely removed from the project. The French Roast Admin Panel is maintained exclusively as a web application (`admin/`).

---

# Environment Variables

## Backend

Create:

```text
backend/.env
```

from:

```text
backend/.env.example
```

Typical configuration:

```dotenv
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_unique_secret
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=your_sender_email
BREVO_SENDER_NAME=French Roast
BREVO_SMS_SENDER=your_sender_id
```

Only use variables defined by the current backend configuration.

## Storefront

For local development:

```dotenv
VITE_API_URL=http://localhost:5000
```

## Admin

For local web development:

```dotenv
VITE_API_URL=http://localhost:5000
```

For production/desktop usage:

```dotenv
VITE_API_URL=https://french-roast-backend.onrender.com
```

Never commit real `.env` files or credentials.

---

# Local Development

## Install dependencies

From the repository root:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix admin install
```

## Configure backend

Create `backend/.env` and configure the required MongoDB, authentication, and notification variables.

## Start all services

If the root development script is configured to start all services:

```bash
npm run dev
```

Typical local endpoints:

```text
Public Storefront: http://localhost:3000
Admin Panel:       http://localhost:3010
Backend:           http://localhost:5000
Health:            http://localhost:5000/api/health
```

## Run individually

```bash
npm run dev:backend
npm run dev:frontend
npm run dev:admin
```

Use the scripts defined by the current root `package.json`.

---

# Build

From the repository root:

```bash
npm run build
```

This runs the configured backend validation and builds the Vite applications.

---

# Production Deployment

### Backend

```text
https://french-roast-backend.onrender.com
```

### Public Website

```text
https://french-roast.onrender.com/
```

Production secrets must be configured through the deployment provider's environment settings.

---

# API Reference

The backend API is mounted under `/api`.

## Health

```http
GET /api/health
```

## Admin Authentication

```http
POST /api/admin/login
POST /api/admin/verify-2fa
POST /api/admin/refresh-token
POST /api/admin/logout
POST /api/admin/setup-2fa
POST /api/admin/enable-2fa
POST /api/admin/disable-2fa
POST /api/admin/regenerate-recovery-codes
POST /api/admin/change-password
GET  /api/admin/audit-logs
```

## Orders

```http
POST   /api/orders
GET    /api/orders
PATCH  /api/orders/:id/status
DELETE /api/orders/:id
```

The pre-order compatibility alias is also available where configured:

```http
POST /api/pre-book
```

## Inventory

```http
GET  /api/inventory/summary
GET  /api/inventory/products
GET  /api/inventory/history
GET  /api/inventory/waiting-orders
GET  /api/inventory/insights
POST /api/inventory/add-stock
POST /api/inventory/remove-stock
POST /api/inventory/set-stock
POST /api/inventory/threshold
POST /api/inventory/notify-waiting
GET  /api/inventory/export
```

## Notifications

```http
POST /api/notifications/subscribe
GET  /api/notifications/unsubscribe
GET  /api/admin/notifications/subscribers
GET  /api/admin/notifications/subscribers-count
POST /api/admin/notifications/preorder-open
```

All protected endpoints require the appropriate admin authentication.

---

# Database

MongoDB Atlas is used for persistent application data through Mongoose.

The backend contains models for application areas such as:

- Orders
- Products
- Notification subscribers
- Inventory/history
- Admin/authentication records
- Login history
- Audit/activity records

The exact schemas are defined in `backend/models/`.

---

# Testing and Verification

Important areas to verify before production changes:

### Customer

- Product selection
- 250g restriction
- Bengaluru PIN validation
- Order submission
- Customer confirmation

### Backend

- `/api/health`
- MongoDB connection
- Order persistence
- Protected admin routes

### Admin

- Login
- 2FA
- Dashboard
- Orders
- Inventory
- Waiting pre-orders
- Notifications
- Logout

### Notifications

- Order confirmation email
- Pre-order opening email
- Waiting-stock email
- Transactional SMS

### Desktop

- Tauri development launch
- Login
- 2FA
- Dashboard
- Orders
- Inventory
- Notifications
- Logout

---

# Payment Integration Status

## HDFC Payment Gateway

**Status: NOT IMPLEMENTED**

The current platform operates as an unpaid pre-order reservation system.

Future HDFC integration will require actual merchant/gateway information, including:

- Merchant account
- UAT/sandbox access
- Production credentials
- Gateway documentation
- Payment verification
- Callback/webhook configuration
- Product pricing
- Delivery pricing, if applicable

No HDFC credentials should be invented or committed.

---

# Mobile Application Status

## Android / iOS

**Status: NOT IMPLEMENTED**

The current repository does not contain a native Android/iOS Admin application.

The existing Admin Panel is maintained as a reusable web application so it can be packaged for additional platforms later without duplicating backend business logic.

---

# Troubleshooting

## Backend cannot connect

Check:

1. Backend is running.
2. `MONGODB_URI` is valid.
3. MongoDB Atlas allows the connection.
4. `VITE_API_URL` points to the correct backend.

## Admin cannot connect to backend

For local web development:

```text
http://localhost:5000
```

For production/desktop:

```text
https://french-roast-backend.onrender.com
```

Check the environment configuration used by the specific build.
---

# Git and Security

Never commit:

```text
.env
.env.*
node_modules/
dist/
```

Never commit:

- MongoDB credentials
- Brevo API keys
- JWT secrets
- admin passwords
- password hashes
- recovery codes
- customer private information

Production secrets belong in the deployment provider's environment settings.

---

# Current Product Configuration

| Item | Current Configuration |
|---|---|
| Coffee | French Roast |
| Powder | 250g |
| Whole Bean | 250g |
| Delivery Area | Bengaluru only |
| Customer Order Type | Pre-order |
| Online Payment | Not implemented |
| HDFC Gateway | Not implemented |

---

# Future Work

1. HDFC payment gateway integration
2. Production Windows installer/release packaging
3. Android mobile application packaging

Bengaluru-only delivery is intentional and is not considered an unfinished feature.

---

## Complete System Data Flow

```text
                         CUSTOMER
                            |
                            v
                 +---------------------+
                 | Public Storefront   |
                 | Vite / JavaScript   |
                 +----------+----------+
                            |
                            | REST API
                            v
                 +---------------------+
                 | Express Backend     |
                 | Node.js             |
                 +----------+----------+
                            |
             +--------------+--------------+
             |                             |
             v                             v
      +-------------+              +---------------+
      | MongoDB     |              | Brevo         |
      | Atlas       |              | Email / SMS   |
      +-------------+              +---------------+
             ^
             |
    +------------------+
    | Web Admin        |
    | Admin Panel      |
    +------------------+
```

---

## License / Project Use

This repository contains the French Roast application and its operational components.

Project-specific usage and distribution should follow the owner's requirements.
