import dotenv from 'dotenv';
import mongoose from 'mongoose';
import dns from 'dns';
import Order from '../models/Order.js';
import NotificationSubscriber from '../models/NotificationSubscriber.js';
import { getNotificationSubscribersCount, getNotificationSubscribers } from '../controllers/adminController.js';

dotenv.config();
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

async function testSync() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB Atlas.');

  // Check before sync
  const countBefore = await NotificationSubscriber.countDocuments({ emailOptIn: true });
  console.log('NotificationSubscriber count before sync:', countBefore);

  // Perform sync
  const orders = await Order.find().select('name fullName email phone phoneNo emailOptIn notificationOptIn marketingOptIn preorderNotificationOptIn optin createdAt');
  console.log(`Found ${orders.length} order(s) in Order collection.`);

  for (const b of orders) {
    const email = (b.email || '').trim().toLowerCase();
    if (!email) continue;
    const rawOptIn = b.emailOptIn ?? b.notificationOptIn ?? b.marketingOptIn ?? b.preorderNotificationOptIn ?? b.optin;
    const isOptedIn = rawOptIn === undefined ? true : (rawOptIn === true || rawOptIn === 'true' || rawOptIn === 'on' || rawOptIn === 1 || rawOptIn === '1');
    if (isOptedIn) {
      const customerName = (b.fullName || b.name || '').trim() || 'Coffee Enthusiast';
      const customerPhone = (b.phone || b.phoneNo || '').trim() || '';
      await NotificationSubscriber.findOneAndUpdate(
        { email },
        { name: customerName, phone: customerPhone, emailOptIn: true },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  const countAfter = await NotificationSubscriber.countDocuments({ emailOptIn: true });
  console.log('NotificationSubscriber count after sync:', countAfter);

  const subscribers = await NotificationSubscriber.find({ emailOptIn: true }).sort({ createdAt: -1 });
  console.log('\n--- SUBSCRIBERS IN DATABASE ---');
  console.dir(subscribers.map(s => ({ name: s.name, email: s.email, phone: s.phone, emailOptIn: s.emailOptIn })), { depth: null });

  await mongoose.disconnect();
}

testSync().catch(console.error);
