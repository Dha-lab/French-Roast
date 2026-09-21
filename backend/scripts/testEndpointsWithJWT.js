import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import dns from 'dns';
import Admin from '../models/Admin.js';
import mongoose from 'mongoose';

dotenv.config();
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

async function testEndpointsWithJWT() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB Atlas');

  const admin = await Admin.findOne({ username: 'frenchroastadmin' });
  if (!admin) {
    console.error('Admin user not found in database');
    process.exit(1);
  }

  const secret = process.env.JWT_SECRET || 'french_roast_jwt_secret_key_2026_super_secure_auth_token_hash_89123';
  const token = jwt.sign(
    { id: admin._id, username: admin.username, role: admin.role },
    secret,
    { expiresIn: '15m' }
  );

  console.log('Generated Admin JWT Token.');

  const baseUrl = 'http://localhost:5000';

  const countRes = await fetch(`${baseUrl}/api/admin/notifications/subscribers-count`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const countData = await countRes.json();
  console.log('\n--- 1. GET /api/admin/notifications/subscribers-count ---');
  console.log('HTTP Status:', countRes.status);
  console.log('Count Response:', countData);

  const listRes = await fetch(`${baseUrl}/api/admin/notifications/subscribers`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const listData = await listRes.json();
  console.log('\n--- 2. GET /api/admin/notifications/subscribers ---');
  console.log('HTTP Status:', listRes.status);
  console.log('List Count Field:', listData.count);
  console.log('Subscribers Array Length:', listData.subscribers ? listData.subscribers.length : 'undefined');

  console.log('\n--- SUMMARY ---');
  console.log(`Count API count: ${countData.count}`);
  console.log(`List API count: ${listData.count}`);
  console.log(`List subscribers length: ${listData.subscribers ? listData.subscribers.length : 0}`);

  if (countData.count === listData.count && listData.count === listData.subscribers.length) {
    console.log('\n✅ BOTH ENDPOINTS MATCH 100%! All 3 values =', countData.count);
  } else {
    console.error('\n❌ MISMATCH DETECTED!');
  }

  await mongoose.disconnect();
}

testEndpointsWithJWT().catch(console.error);
