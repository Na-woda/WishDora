// app.js — WishDora Express app.
// Builds the app instance shared by the local dev server (server.js) and the
// Netlify Function wrapper (netlify/functions/api.js). Kept separate from
// server.js so the Netlify Function can reuse it without also pulling in
// app.listen()/static frontend serving, which Netlify's CDN handles instead.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const wishRoutes = require('./routes/wishes');
const userRoutes = require('./routes/userRoutes');
const { publicCardRoutes, adminCardRoutes } = require('./routes/cardRoutes');
const { publicCategoryRoutes, adminCategoryRoutes } = require('./routes/categoryRoutes');
const { adminLogin } = require('./controllers/authController');
const schedulerRoutes = require('./routes/schedulerRoutes');
const { sendFeedbackEmail } = require('./services/emailService');

// createApp({ serveStatic }) — serveStatic must be enabled (local dev) BEFORE the
// catch-all 404 handler is registered, since Express middleware order determines
// which handler responds first. Netlify's own CDN serves the frontend in
// production, so the Netlify Function build omits it entirely.
function createApp({ serveStatic = false } = {}) {
  connectDB();

  const app = express();

  // Netlify's Functions/CDN layer sits in front of this app as a single proxy
  // hop, so Express needs to trust exactly that one hop's X-Forwarded-For to see
  // the real client IP — otherwise express-rate-limit can't key limits per-IP
  // (ERR_ERL_UNDEFINED_IP_ADDRESS). Trusting more than the real hop count would
  // let a client spoof X-Forwarded-For to bypass rate limiting.
  app.set('trust proxy', 1);

  // ── Security & Middleware ──────────────────────────────────
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    contentSecurityPolicy: false, // disabled — the app uses inline scripts extensively
  }));
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  }));
  app.use(express.json({ limit: '5mb' })); // 5MB for base64 card images
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { success: false, message: 'Too many requests, please try again later.' },
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: 'Too many login attempts.' },
  });
  const feedbackLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many feedback submissions. Please try again later.' },
  });

  app.use('/api/', limiter);
  app.use('/api/auth/', authLimiter);

  // ── Routes ─────────────────────────────────────────────────
  app.post('/api/admin/auth/login', adminLogin);
  app.use('/api/auth', authRoutes);
  app.use('/api/wishes', wishRoutes);
  app.use('/api/scheduler', schedulerRoutes);
  app.use('/api/cards', publicCardRoutes);
  app.use('/api/admin/cards', adminCardRoutes);
  app.use('/api/categories', publicCategoryRoutes);
  app.use('/api/admin/categories', adminCategoryRoutes);
  app.use('/api/admin', userRoutes);

  if (serveStatic) {
    const frontendRoot = path.join(__dirname, '../frontend');
    app.use(express.static(frontendRoot));
    app.get('/', (req, res) => {
      res.sendFile(path.join(frontendRoot, 'index.html'));
    });
    app.get('/index.html', (req, res) => {
      res.sendFile(path.join(frontendRoot, 'index.html'));
    });
  }

  app.post('/api/feedback', feedbackLimiter, async (req, res) => {
    const { rating, suggestion = '', storeRecommendation, recommendFriend, userName, userEmail, userId } = req.body || {};

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, message: 'Please select a rating.' });
    }
    if (!['Yes', 'Maybe', 'No'].includes(storeRecommendation)) {
      return res.status(400).json({ success: false, message: 'Please answer the store recommendation question.' });
    }
    if (typeof suggestion !== 'string' || suggestion.length > 2000) {
      return res.status(400).json({ success: false, message: 'Feedback must be 2,000 characters or fewer.' });
    }
    if (userEmail && (typeof userEmail !== 'string' || !/^\S+@\S+\.\S+$/.test(userEmail))) {
      return res.status(400).json({ success: false, message: 'The supplied email address is invalid.' });
    }

    console.log('💬 New feedback received:', {
      rating,
      storeRecommendation,
      recommendFriend,
      suggestion: suggestion.trim(),
      userName,
      userEmail,
      userId,
    });

    const feedback = {
      rating: numericRating,
      storeRecommendation,
      recommendFriend: Boolean(recommendFriend),
      suggestion: suggestion.trim(),
      userName: typeof userName === 'string' ? userName.trim().slice(0, 120) : '',
      userEmail: typeof userEmail === 'string' ? userEmail.trim().slice(0, 254) : '',
      userId: typeof userId === 'string' ? userId.slice(0, 120) : '',
    };

    try {
      await sendFeedbackEmail(feedback);
      console.log(`Feedback email sent: ${numericRating}/5`);
      return res.status(201).json({ success: true, message: 'Thank you for your feedback!' });
    } catch (error) {
      console.error('Feedback email delivery failed:', error.message);
      const unconfigured = error.message === 'Feedback email delivery is not configured.';
      return res.status(unconfigured ? 503 : 502).json({
        success: false,
        message: unconfigured ? 'Feedback email delivery is not configured yet.' : 'Unable to deliver feedback. Please try again later.',
      });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      message: '💌 WishDora API is running',
      time: new Date().toISOString(),
      db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('🔥 Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  });

  return app;
}

module.exports = createApp;
