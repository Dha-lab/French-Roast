import bcrypt from 'bcryptjs';

const password = process.argv[2] || 'FrenchRoast2026!Secret';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('--- ADMIN PASSWORD BCRYPT HASH GENERATOR ---');
console.log('Provided Password:', password);
console.log('Generated Bcrypt Hash:', hash);
console.log('\nCopy the hash above into backend/.env as:');
console.log(`ADMIN_PASSWORD_HASH="${hash}"`);
