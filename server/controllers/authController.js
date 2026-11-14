const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const COOKIE_NAME = 'token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Register a new manager
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    const { full_name, email, password } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    // Check if email already registered
    const existing = await db.query('SELECT id FROM managers WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in.',
      });
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert manager
    const insertResult = await db.query(
      `INSERT INTO managers (full_name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, created_at`,
      [full_name.trim(), cleanEmail, hashedPassword]
    );

    const manager = insertResult.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { id: manager.id, email: manager.email, full_name: manager.full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HTTP-only cookie
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to QueueFlow.',
      manager,
      token, // Also send token in response for flexibility in API clients
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Log in an existing manager
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    // Find manager
    const result = await db.query(
      'SELECT id, full_name, email, password, created_at FROM managers WHERE email = $1',
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const manager = result.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, manager.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: manager.id, email: manager.email, full_name: manager.full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set HTTP-only cookie
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    const safeManager = {
      id: manager.id,
      full_name: manager.full_name,
      email: manager.email,
      created_at: manager.created_at,
    };

    return res.json({
      success: true,
      message: 'Login successful! Welcome back.',
      manager: safeManager,
      token,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Log out manager (clears session cookie)
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  return res.json({
    success: true,
    message: 'Logged out successfully.',
  });
};

/**
 * Get current authenticated manager profile
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  return res.json({
    success: true,
    manager: req.manager,
  });
};

module.exports = {
  register,
  login,
  logout,
  getMe,
};
