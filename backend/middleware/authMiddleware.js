import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production environment.');
    }
    return 'dev_french_roast_jwt_secret_key_local_only';
  }
  return secret;
};

export const protectAdmin = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const jwtSecret = getJwtSecret();
      const decoded = jwt.verify(token, jwtSecret);

      if (decoded.scope === '2fa_required') {
        return res.status(401).json({
          success: false,
          message: 'Two-factor authentication verification required'
        });
      }

      const admin = await Admin.findById(decoded.id);

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, admin account not found'
        });
      }

      if (!admin.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account disabled. Please contact system administrator.'
        });
      }

      req.admin = admin;
      return next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed or expired'
      });
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Not authorized, no token provided'
  });
};
