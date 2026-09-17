import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

export const protectAdmin = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const jwtSecret = process.env.JWT_SECRET || 'french_roast_jwt_secret_key_2026_super_secure_auth_token_hash_89123';
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
