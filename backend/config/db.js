import mongoose from 'mongoose';
import dns from 'dns';

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI environment variable is missing in backend/.env');
    throw new Error('MONGODB_URI environment variable is missing');
  }

  // Ensure DNS SRV resolution succeeds across environments
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (dnsErr) {
    // Ignore if environment restricts custom DNS servers
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`🍃 MongoDB Atlas Connected: ${conn.connection.host} / Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Atlas Connection Error: ${error.message}`);
    throw error;
  }
};
