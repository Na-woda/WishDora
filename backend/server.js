// server.js — WishDora Backend
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

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// ── Security & Middleware ──────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
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

// Serve frontend static files for the public site
const frontendRoot = path.join(__dirname, '../frontend');
app.use(express.static(frontendRoot));
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'public/index.html'));
});
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'public/index.html'));
});

app.post('/api/feedback', (req, res) => {
  const { rating, suggestion = '', storeRecommendation, recommendFriend, userName, userEmail, userId } = req.body || {};

  if (!rating) {
    return res.status(400).json({ success: false, message: 'Please select a rating.' });
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

  return res.status(201).json({
    success: true,
    message: 'Thank you for your feedback!',
  });
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

// ── Database & Server Start ────────────────────────────────
async function startServer() {
  try {
    await connectDB();
    console.log('✅ MongoDB connected:', mongoose.connection.host);

    const tryListen = (port) => {
      const server = app.listen(port, () => {
        console.log(`\n🚀 WishDora API running on http://localhost:${port}`);
        console.log(`📋 API Docs: http://localhost:${port}/api/health`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && port < 5010) {
          console.warn(`⚠️ Port ${port} is busy, trying ${port + 1}...`);
          server.close(() => tryListen(port + 1));
        } else {
          console.error('❌ Failed to start server:', err.message);
          process.exit(1);
        }
      });
    };

    tryListen(PORT);
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down gracefully');
  await mongoose.connection.close();
  process.exit(0);
});

startServer();
