const COMMON_WEAK_PASSWORDS = new Set([
  'password1234',
  'admin12345678',
  '123456789012',
  'administrator1',
  'frenchroast123',
  'letmein123456',
  'welcome123456'
]);

export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }

  if (password.length < 12) {
    return { valid: false, message: 'Password must be at least 12 characters long' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character/symbol' };
  }

  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, message: 'Password is too common or easily guessable' };
  }

  return { valid: true, message: 'Password meets complexity requirements' };
};
