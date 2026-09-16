# French Roast — Premium Coffee Website

A premium dark coffee-brand website for **French Roast** cleanly separated into **Frontend** (`frontend/`) and **Backend** (`backend/`).

---

## 📁 Project Structure

```
French-Roast/
├── frontend/             # Frontend web application (Vite, Tailwind CSS, Vanilla JS)
│   ├── src/              # Assets, styles, and main application script
│   ├── index.html        # Public homepage & hero section
│   ├── admin.html        # Admin Dashboard for pre-book & inventory management
│   ├── vite.config.js    # Vite dev server configuration
│   ├── tailwind.config.js# Tailwind CSS configuration
│   ├── postcss.config.js # PostCSS configuration
│   └── package.json      # Frontend dependencies & scripts
│
├── backend/              # Production REST API Backend (Node.js, Express)
│   ├── server.js         # Backend server entrypoint
│   ├── config/           # Database layer & modular data store
│   ├── controllers/      # API Controllers (Products, Orders)
│   ├── models/           # Mongoose schemas (Product, Order)
│   ├── routes/           # Express REST API routes
│   ├── middleware/       # Express 404 & error handlers
│   ├── product_db.json   # Local product database file
│   ├── prebook_db.json   # Local pre-book database file
│   └── package.json      # Backend dependencies & scripts
│
├── .gitignore            # Git ignore rules
└── README.md             # Project documentation
```

---

## 🚀 How to Run

### 1. Backend REST API
```bash
cd backend
npm install
npm start
```
*Backend listens on `http://localhost:5000`*

### 2. Frontend Web Application
```bash
cd frontend
npm install
npm run dev
```
*Public Website: `http://localhost:3000`*  
*Admin Panel: `http://localhost:3000/admin.html`*
