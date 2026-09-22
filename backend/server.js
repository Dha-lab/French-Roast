import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Security Headers & Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cookieParser());

// CORS Configuration (Easy to update for Render / Vercel deployment)
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  process.env.ADMIN_URL || 'http://localhost:3010',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3010'
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.render.com')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true
  })
);

app.use(express.json());

// 1. HEALTH CHECK ENDPOINT
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'French Roast backend is running'
  });
});

// 2. MOUNT API ROUTES
app.use('/api/admin', adminRoutes);
app.use('/api/admin/inventory', inventoryRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);

// Backward Compatibility Aliases for Existing Frontend / Admin Panel
app.use('/api/product', productRoutes);
app.use('/api/pre-book', orderRoutes);

// 3. ERROR HANDLING MIDDLEWARE
app.use(notFound);
app.use(errorHandler);

// Connect Database & Start Express Server
const startServer = async () => {
  try {
    // 1. Load dotenv & connect to MongoDB Atlas
    await connectDB();

    // 2. Confirm MongoDB connection & start Express on PORT
    const server = app.listen(PORT, () => {
      console.log(`🚀 French Roast Production Backend API listening on http://localhost:${PORT}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is busy. Please stop the existing process occupying port ${PORT}.`);
      } else {
        console.error('❌ Server startup error:', error);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('❌ Server startup aborted:', err.message);
    process.exit(1);
  }
};

startServer();
