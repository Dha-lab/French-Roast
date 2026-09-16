import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Connect Database
connectDB();

// CORS Configuration (Easy to update for Render / Vercel deployment)
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3010',
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
        callback(null, true); // Allow during dev & staging
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
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// Backward Compatibility Aliases for Existing Frontend / Admin Panel
app.use('/api/product', productRoutes);
app.use('/api/pre-book', orderRoutes);

// 3. ERROR HANDLING MIDDLEWARE
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 French Roast Production Backend API listening on http://localhost:${PORT}`);
});
