const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Enforce JWT_SECRET in production; require environment variable
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable is missing in production.');
}

const JWT_SECRET = process.env.JWT_SECRET || 'queueflow_super_secret_jwt_key_2026_dev';

/**
 * Authentication Middleware
 * Verifies JWT token from HTTP-only cookie or Authorization header.
 * Attaches the manager object to the request.
 */
const requireAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    // Also support Bearer header as a fallback
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch fresh manager record from database to ensure account still exists
    const result = await db.query(
      'SELECT id, full_name, email, created_at FROM managers WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Manager account not found or has been removed.',
      });
    }

    // Attach manager to request
    req.manager = result.rows[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session. Please log in again.',
    });
  }
};

module.exports = {
  requireAuth,
  JWT_SECRET,
};

