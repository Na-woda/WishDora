const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorHandler');

const signToken = (id, type) =>
  jwt.sign({ id, type }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sanitizeAdmin = (admin) => ({
  id: admin._id,
  name: admin.name,
  email: admin.email,
  role: admin.role,
});

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  isPremium: user.isPremium,
});

// @route  POST /api/admin/auth/login
// @access Public
const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');
  if (!admin || !admin.isActive) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = signToken(admin._id, 'admin');
  res.status(200).json({ success: true, token, admin: sanitizeAdmin(admin) });
});

// @route  POST /api/auth/register
// @access Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ success: false, message: 'An account with this email already exists' });
  }

  const user = await User.create({ name, email, password });
  const token = signToken(user._id, 'user');
  res.status(201).json({ success: true, token, user: sanitizeUser(user) });
});

// @route  POST /api/auth/login
// @access Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = signToken(user._id, 'user');
  res.status(200).json({ success: true, token, user: sanitizeUser(user) });
});

// @route  GET /api/auth/me
// @access Private (user or admin)
const getMe = asyncHandler(async (req, res) => {
  if (req.userType === 'admin') {
    return res.status(200).json({ success: true, type: 'admin', account: sanitizeAdmin(req.admin) });
  }
  res.status(200).json({ success: true, type: 'user', account: sanitizeUser(req.user) });
});

module.exports = { adminLogin, registerUser, loginUser, getMe };
