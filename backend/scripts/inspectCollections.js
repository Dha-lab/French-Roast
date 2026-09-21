import dotenv from 'dotenv';
import mongoose from 'mongoose';
import dns from 'dns';

dotenv.config();
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

async function inspect() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('Connected to MongoDB Atlas. DB Name:', mongoose.connection.name);

  const adminDb = mongoose.connection.db.admin();
  const dbs = await adminDb.listDatabases();
  console.log('\n--- ALL DATABASES IN ATLAS CLUSTER ---');
  console.log(dbs.databases.map(d => d.name));

  for (const dbInfo of dbs.databases) {
    if (['admin', 'local'].includes(dbInfo.name)) continue;
    const db = mongoose.connection.useDb(dbInfo.name);
    const collections = await db.db.listCollections().toArray();
    console.log(`\n=== Database: ${dbInfo.name} ===`);
    for (const col of collections) {
      const count = await db.db.collection(col.name).countDocuments();
      console.log(`  Collection "${col.name}": ${count} document(s)`);
      if (count > 0 && count <= 10) {
        const docs = await db.db.collection(col.name).find().toArray();
        console.log(`    Docs sample:`, docs.map(d => ({ email: d.email, name: d.name || d.fullName, emailOptIn: d.emailOptIn })));
      }
    }
  }

  await mongoose.disconnect();
}

inspect().catch(console.error);
