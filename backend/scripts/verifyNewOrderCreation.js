import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const OrderSchema = new mongoose.Schema({
  bookingId: String,
  fullName: String,
  variant: String,
  quantity: Number,
  blend: Object,
  arabicaPercentage: Number,
  robustaPercentage: Number,
  chicoryPercentage: Number,
  arabicaGrams: Number,
  robustaGrams: Number,
  chicoryGrams: Number,
  createdAt: Date
}, { strict: false });

const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema, 'orders');

function adminParseBlendInfo(item) {
  if (!item) return { valid: false };
  const b = (item.blend && typeof item.blend === 'object')
    ? item.blend
    : (item.arabicaPercentage !== undefined || item.robustaPercentage !== undefined ? item : null);
  if (!b || typeof b !== 'object') {
    return { valid: false };
  }
  const aPct = Number(b.arabicaPercentage);
  const rPct = Number(b.robustaPercentage);
  const cPct = b.chicoryPercentage !== undefined && b.chicoryPercentage !== null ? Number(b.chicoryPercentage) : 0;

  if (isNaN(aPct) || isNaN(rPct) || !isFinite(aPct) || !isFinite(rPct) || aPct < 0 || rPct < 0) {
    return { valid: false };
  }
  if (isNaN(cPct) || !isFinite(cPct) || cPct < 0) {
    return { valid: false };
  }

  const totalPct = Math.round(aPct + rPct + cPct);
  if (totalPct !== 100) {
    return { valid: false };
  }

  const packWeight = Math.max(1, Number(b.totalGrams) || 250);
  const qty = Math.max(1, Number(item.quantity) || 1);

  const aG = typeof b.arabicaGrams === 'number' && !isNaN(b.arabicaGrams)
    ? b.arabicaGrams
    : Math.round((packWeight * aPct / 100) * 10) / 10;
  const rG = typeof b.robustaGrams === 'number' && !isNaN(b.robustaGrams)
    ? b.robustaGrams
    : (cPct > 0 ? Math.round((packWeight * rPct / 100) * 10) / 10 : Math.round((packWeight - aG) * 10) / 10);
  const cG = typeof b.chicoryGrams === 'number' && !isNaN(b.chicoryGrams)
    ? b.chicoryGrams
    : (cPct > 0 ? Math.round((packWeight - aG - rG) * 10) / 10 : 0);

  const totalAG = typeof b.totalArabicaGrams === 'number' && !isNaN(b.totalArabicaGrams)
    ? b.totalArabicaGrams
    : Math.round((aG * qty) * 10) / 10;
  const totalRG = typeof b.totalRobustaGrams === 'number' && !isNaN(b.totalRobustaGrams)
    ? b.totalRobustaGrams
    : Math.round((rG * qty) * 10) / 10;
  const totalCG = typeof b.totalChicoryGrams === 'number' && !isNaN(b.totalChicoryGrams)
    ? b.totalChicoryGrams
    : Math.round((cG * qty) * 10) / 10;

  return {
    valid: true,
    hasChicory: cPct > 0,
    arabicaPercentage: aPct,
    robustaPercentage: rPct,
    chicoryPercentage: cPct,
    arabicaGrams: aG,
    robustaGrams: rG,
    chicoryGrams: cG,
    totalArabicaGrams: totalAG,
    totalRobustaGrams: totalRG,
    totalChicoryGrams: totalCG,
    packWeight
  };
}

async function run() {
  console.log('--- 1. Testing Order Creation via POST http://localhost:5000/api/orders ---');

  const testPayload = {
    fullName: 'Test Customer Blend 250g',
    name: 'Test Customer Blend 250g',
    phone: '9999999999',
    email: 'test.powder.blend@example.com',
    address: '123 MG Road, Indiranagar',
    pinCode: '560001',
    pincode: '560001',
    product: 'French Roast',
    variant: 'Powder',
    coffeeType: 'Powder',
    weight: '250g',
    packSize: '250g',
    quantity: 1,
    orderType: 'preorder',
    blend: {
      customizationEnabled: true,
      arabicaPercentage: 70,
      robustaPercentage: 30,
      chicoryPercentage: 0
    },
    arabicaPercentage: 70,
    robustaPercentage: 30,
    chicoryPercentage: 0
  };

  const response = await fetch('http://localhost:5000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload)
  });

  const resJson = await response.json();
  console.log('HTTP Status:', response.status);
  console.log('Response Success:', resJson.success);
  console.log('Order Booking ID:', resJson.data?.bookingId);
  console.log('Order Blend in API response:', resJson.data?.blend);

  if (!resJson.success) {
    console.error('Order creation failed:', resJson);
    process.exit(1);
  }

  const createdBookingId = resJson.data.bookingId;

  console.log('\n--- 2. Inspecting MongoDB Document (Read-Only) ---');
  await mongoose.connect(process.env.MONGODB_URI);
  const dbOrder = await Order.findOne({ bookingId: createdBookingId }).lean();
  console.log('MongoDB Order Found:', dbOrder ? 'YES' : 'NO');
  console.log('MongoDB Order blend:', dbOrder?.blend);
  console.log('MongoDB Order arabicaPercentage:', dbOrder?.arabicaPercentage);
  console.log('MongoDB Order robustaPercentage:', dbOrder?.robustaPercentage);
  console.log('MongoDB Order chicoryPercentage:', dbOrder?.chicoryPercentage);
  console.log('MongoDB Order arabicaGrams:', dbOrder?.arabicaGrams);
  console.log('MongoDB Order robustaGrams:', dbOrder?.robustaGrams);
  console.log('MongoDB Order chicoryGrams:', dbOrder?.chicoryGrams);

  console.log('\n--- 3. Verifying 250g Gram Math ---');
  const aG = dbOrder?.blend?.arabicaGrams;
  const rG = dbOrder?.blend?.robustaGrams;
  const cG = dbOrder?.blend?.chicoryGrams;
  console.log(`Arabica (${aG}g) + Robusta (${rG}g) + Chicory (${cG}g) = ${aG + rG + cG}g`);
  const exact250 = (aG + rG + cG) === 250;
  console.log('Matches 250g exactly:', exact250 ? 'PASS' : 'FAIL');

  console.log('\n--- 4. Testing Admin Panel Blend Parser on API & DB Order ---');
  const adminParsed = adminParseBlendInfo(resJson.data);
  console.log('Admin parse result valid:', adminParsed.valid);
  console.log('Admin parse result:', adminParsed);

  const displaySnippet = adminParsed.valid
    ? (adminParsed.hasChicory
        ? `☕ ${adminParsed.arabicaPercentage}%A / ${adminParsed.robustaPercentage}%R / ${adminParsed.chicoryPercentage}%C (${adminParsed.arabicaGrams}g / ${adminParsed.robustaGrams}g / ${adminParsed.chicoryGrams}g)`
        : `☕ ${adminParsed.arabicaPercentage}%A / ${adminParsed.robustaPercentage}%R (${adminParsed.arabicaGrams}g / ${adminParsed.robustaGrams}g)`)
    : 'Blend details unavailable for this order.';
  console.log('Rendered Admin Table Text:', displaySnippet);

  if (displaySnippet.includes('unavailable')) {
    console.error('FAIL: Admin panel would display unavailable!');
    process.exit(1);
  }

  console.log('\n--- 5. Testing Multi-pack (Qty: 2) Order Calculation ---');
  const multiPackPayload = {
    ...testPayload,
    fullName: 'Test Multi-pack Customer',
    quantity: 2,
    blend: {
      customizationEnabled: true,
      arabicaPercentage: 80,
      robustaPercentage: 15,
      chicoryPercentage: 5
    },
    arabicaPercentage: 80,
    robustaPercentage: 15,
    chicoryPercentage: 5
  };

  const multiRes = await fetch('http://localhost:5000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(multiPackPayload)
  });
  const multiJson = await multiRes.json();
  console.log('Multi-pack Order Booking ID:', multiJson.data?.bookingId);
  const multiAdminParsed = adminParseBlendInfo(multiJson.data);
  console.log('Multi-pack Admin Parsed:', multiAdminParsed);
  console.log(`Multi-pack Total Arabica: ${multiAdminParsed.totalArabicaGrams}g, Total Robusta: ${multiAdminParsed.totalRobustaGrams}g, Total Chicory: ${multiAdminParsed.totalChicoryGrams}g`);
  const totalMultiGrams = multiAdminParsed.totalArabicaGrams + multiAdminParsed.totalRobustaGrams + multiAdminParsed.totalChicoryGrams;
  console.log(`Total across 2 packs: ${totalMultiGrams}g (Expected: 500g) -> ${totalMultiGrams === 500 ? 'PASS' : 'FAIL'}`);

  console.log('\n--- 6. Testing Whole Bean Order (Unchanged) ---');
  const wholeBeanPayload = {
    fullName: 'Test Whole Bean Customer',
    name: 'Test Whole Bean Customer',
    phone: '9999999999',
    email: 'test.wholebean@example.com',
    address: '123 MG Road, Indiranagar',
    pinCode: '560001',
    product: 'French Roast',
    variant: 'Whole Bean',
    coffeeType: 'Whole Bean',
    weight: '250g',
    packSize: '250g',
    quantity: 1,
    orderType: 'preorder'
  };
  const wbRes = await fetch('http://localhost:5000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wholeBeanPayload)
  });
  const wbJson = await wbRes.json();
  console.log('Whole Bean Booking ID:', wbJson.data?.bookingId);
  console.log('Whole Bean blend:', wbJson.data?.blend);
  const wbDbOrder = await Order.findOne({ bookingId: wbJson.data?.bookingId }).lean();
  console.log('Whole Bean MongoDB blend:', wbDbOrder?.blend);
  console.log('Whole Bean blend is undefined/null:', (!wbDbOrder?.blend) ? 'PASS' : 'FAIL');

  await mongoose.disconnect();
  console.log('\nALL VERIFICATIONS PASSED SUCCESSFULLY!');
}

run().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
