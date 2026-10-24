// routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { sendWelcomeEmail, sendOtpEmail } = require('../services/emailService');
const { protect } = require('../middleware/auth');
const { getTokenVersion } = require('../utils/tokenVersion');

function signToken(user) {
  return jwt.sign({ id: user._id, tokenVersion: getTokenVersion(user) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// ── POST /api/auth/register ────────────────────────────────
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, email, password, phone } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, phone: phone || '' });
    const token = signToken(user);

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user).catch(err => console.error('Welcome email failed:', err.message));

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error('Register error:', err.name || 'Error');
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/auth/login ───────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Invalid email or password format' });
  }

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = signToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error('Login error:', err.name || 'Error');
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/auth/forgot-password ─────────────────────────
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email address'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
  }

  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(444 || 404).json({ success: false, message: 'No account found with this email address' });
    }

    // Generate 6-digit numeric OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expireTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetOtp = otp;
    user.resetOtpExpire = expireTime;
    await user.save();

    // Try sending email via emailService
    try {
      await sendOtpEmail(user.email, user.name, otp);
    } catch (emailErr) {
      console.error('Password reset email delivery failed:', emailErr.name || 'Error');
      return res.status(503).json({
        success: false,
        message: 'Unable to send a verification code right now. Please try again later.',
      });
    }

    res.json({
      success: true,
      message: 'OTP verification code has been sent to your email!',
    });
  } catch (err) {
    console.error('Forgot password error:', err.name || 'Error');
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
});

// ── POST /api/auth/verify-otp ──────────────────────────────
router.post('/verify-otp', [
  body('email').isEmail().normalizeEmail(),
  body('otp').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Please enter a valid 6-digit OTP code' });
  }

  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.resetOtp || !user.resetOtpExpire) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code request' });
    }

    if (user.resetOtpExpire < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP code has expired. Please request a new one.' });
    }

    if (user.resetOtp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP verification code' });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully!',
    });
  } catch (err) {
    console.error('Verify OTP error:', err.name || 'Error');
    res.status(500).json({ success: false, message: 'Server error during OTP verification' });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────
router.post('/reset-password', [
  body('email').isEmail().normalizeEmail(),
  body('otp').trim().isLength({ min: 6, max: 6 }),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.resetOtp || !user.resetOtpExpire) {
      return res.status(400).json({ success: false, message: 'Invalid session. Please request a new OTP code.' });
    }

    if (user.resetOtpExpire < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP code has expired. Please request a new one.' });
    }

    if (user.resetOtp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP code.' });
    }

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        resetOtp: otp.trim(),
        resetOtpExpire: { $gt: new Date() },
      },
      {
        $set: {
          password: await bcrypt.hash(newPassword, 12),
          resetOtp: null,
          resetOtpExpire: null,
        },
        $inc: { tokenVersion: 1 },
      },
      { new: true, runValidators: true },
    );

    if (!updatedUser) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code request.' });
    }

    res.json({
      success: true,
      message: 'Password reset successfully! You can now sign in with your new password.',
    });
  } catch (err) {
    console.error('Reset password error:', err.name || 'Error');
    res.status(500).json({ success: false, message: 'Server error during password reset' });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ── PUT /api/auth/profile ──────────────────────────────────
router.put('/profile', protect, [
  body('name').optional().trim().notEmpty(),
  body('phone').optional().trim(),
], async (req, res) => {
  try {
    const { name, phone } = req.body;
    const update = {};
    if (name) update.name = name;
    if (phone !== undefined) update.phone = phone;

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update failed' });
  }
});

module.exports = router;
