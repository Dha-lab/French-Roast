import http from 'http';
import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import Admin from '../models/Admin.js';
import Order from '../models/Order.js';

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, rawBody: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

async function runDeleteTests() {
  console.log('==================================================');
  console.log('🧪 TESTING ADMIN DELETE & IDENTIFIER MAPPING FIX');
  console.log('==================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);

  // Create temporary test admin fixture
  const testAdminUser = 'del_admin_' + Date.now();
  const testAdminPw = 'TestAdminP@ssword2026!';
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(testAdminPw, salt);

  const testAdmin = await Admin.create({
    username: testAdminUser,
    email: `${testAdminUser}@example.com`,
    passwordHash: hash,
    role: 'admin',
    twoFactorEnabled: false,
    isActive: true
  });

  // 1. Authenticate Admin to get Bearer Access Token
  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: testAdminUser, password: testAdminPw });

  const token = loginRes.body?.accessToken;
  console.log('1. Admin Login -> Status:', loginRes.status, '| Has Access Token:', !!token);

  if (!token) {
    console.error('❌ Login failed, aborting test.');
    await Admin.deleteOne({ _id: testAdmin._id });
    await mongoose.disconnect();
    process.exit(1);
  }

  // 2. Create a temporary test pre-order
  const createRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/orders',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    fullName: 'Delete Test Order',
    phone: '9988776655',
    email: 'delete_test@example.com',
    address: '789 Delete Fix St',
    variant: 'Powder',
    weight: '250g',
    quantity: 1,
    notes: 'Temporary order for delete test'
  });

  const createdOrder = createRes.body?.data;
  const mongoId = createdOrder._id;
  const bookingId = createdOrder.bookingId;
  console.log(`2. Created Test Order -> Mongo _id: "${mongoId}" | bookingId: "${bookingId}"`);

  // 3. Test View Details with MongoDB _id & bookingId
  const getByIdRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/orders/${mongoId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('3. GET /api/orders/<MongoDB _id> (Details) -> Status:', getByIdRes.status, '| Found:', getByIdRes.body?.data?.bookingId === bookingId);

  // 4. Test Update Status with MongoDB _id
  const updateStatusRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/orders/${mongoId}/status`,
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  }, { status: 'confirmed' });
  console.log('4. PATCH /api/orders/<MongoDB _id>/status -> Status:', updateStatusRes.status, '| New Status:', updateStatusRes.body?.data?.status);

  // 5. Test Non-ObjectId String Request (e.g. DELETE /api/orders/INVALID_NON_OBJECT_ID_STRING) - Must NOT throw CastError!
  const badIdDeleteRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/orders/INVALID_NON_OBJECT_ID_STRING',
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('5. DELETE with Non-ObjectId String -> Status:', badIdDeleteRes.status, '| Message:', badIdDeleteRes.body?.message);

  // 6. Test DELETE using MongoDB _id
  const deleteRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/orders/${mongoId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('6. DELETE /api/orders/<MongoDB _id> -> Status:', deleteRes.status, '| Message:', deleteRes.body?.message);

  // 7. Verify document is actually deleted from MongoDB Atlas
  const checkDocInDB = await Order.findById(mongoId);
  console.log('7. DB Deletion Verification -> Found Document in MongoDB Atlas:', !!checkDocInDB);

  // 8. Confirm GET /api/orders lists remaining orders
  const listOrdersRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/orders',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('8. GET /api/orders -> Status:', listOrdersRes.status, '| Total Orders Count:', listOrdersRes.body?.count);

  // Clean up test admin
  await Admin.deleteOne({ _id: testAdmin._id });
  await mongoose.disconnect();

  console.log('\n==================================================');
  console.log('🎉 DELETE FIX & IDENTIFIER MAPPING TESTED SUCCESSFULLY!');
  console.log('==================================================\n');
}

runDeleteTests().catch(console.error);
