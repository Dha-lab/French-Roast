import readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import Admin from '../models/Admin.js';
import { validatePassword } from '../utils/passwordPolicy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query, isPassword = false) => {
  return new Promise((resolve) => {
    if (!isPassword) {
      rl.question(query, (answer) => resolve(answer.trim()));
    } else {
      // Basic secure prompt
      rl.question(query, (answer) => resolve(answer.trim()));
    }
  });
};

const main = async () => {
  console.log('\n--- 🔐 FRENCH ROAST ADMIN ACCOUNT CREATION CLI ---');
  try {
    await connectDB();

    const existingAdminsCount = await Admin.countDocuments();
    if (existingAdminsCount > 0) {
      console.log(`⚠️ Warning: ${existingAdminsCount} admin account(s) already exist in the database.`);
      const proceed = await askQuestion('Do you want to create an additional admin account? (y/N): ');
      if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
        console.log('Aborted admin account creation.');
        process.exit(0);
      }
    }

    const username = await askQuestion('Enter Admin Username: ');
    if (!username || username.length < 3) {
      console.error('❌ Username must be at least 3 characters long.');
      process.exit(1);
    }

    const email = await askQuestion('Enter Admin Email: ');
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      console.error('❌ Valid email address is required.');
      process.exit(1);
    }

    // Check duplicate
    const existing = await Admin.findOne({ $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] });
    if (existing) {
      console.error(`❌ An admin account with username "${username}" or email "${email}" already exists.`);
      process.exit(1);
    }

    const password = await askQuestion('Enter Password (min 12 chars, upper/lower/number/symbol): ', true);
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      console.error(`❌ Password does not meet security policy: ${passwordCheck.message}`);
      process.exit(1);
    }

    const confirmPassword = await askQuestion('Confirm Password: ', true);
    if (password !== confirmPassword) {
      console.error('❌ Passwords do not match.');
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const newAdmin = await Admin.create({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      passwordHash,
      role: 'admin',
      twoFactorEnabled: false,
      isActive: true
    });

    console.log(`\n✅ Admin account "${newAdmin.username}" (${newAdmin.email}) created successfully!`);
    console.log('You can now log in to the French Roast Admin Panel.\n');
  } catch (err) {
    console.error('❌ Error creating admin account:', err.message);
  } finally {
    rl.close();
    process.exit(0);
  }
};

main();
