import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../../scratch/french-roast-website/backend/.env') });

const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'admin' },
  twoFactorEnabled: { type: Boolean, default: false },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB Atlas');

    const username = 'frenchroastadmin';
    const password = 'AdminPassword123!';
    const email = 'admin@frenchroast.com';

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    let admin = await Admin.findOne({ username });
    if (admin) {
      admin.passwordHash = passwordHash;
      admin.twoFactorEnabled = false;
      admin.failedLoginAttempts = 0;
      admin.lockUntil = null;
      admin.isActive = true;
      await admin.save();
      console.log(`Updated admin account "${username}" password successfully.`);
    } else {
      admin = await Admin.create({
        username,
        email,
        passwordHash,
        role: 'admin',
        twoFactorEnabled: false,
        failedLoginAttempts: 0,
        lockUntil: null,
        isActive: true
      });
      console.log(`Created new admin account "${username}" successfully.`);
    }

    console.log('\n--- ADMIN CREDENTIALS ---');
    console.log('Username:', username);
    console.log('Password:', password);
  } catch (err) {
    console.error('Error seeding admin user:', err);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
