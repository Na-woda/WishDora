const express = require('express');
const { createCard, updateCard, deleteCard, getCards, getCardById } = require('../controllers/cardController');
const { protect, optionalAuth } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminAuth');
const { uploadCardImage } = require('../middleware/upload');

// Public-facing card routes: GET /api/cards, GET /api/cards/:id
const publicRouter = express.Router();
publicRouter.get('/', optionalAuth, getCards);
publicRouter.get('/:id', optionalAuth, getCardById);

// Admin card management: mounted at /api/admin/cards
const adminRouter = express.Router();
adminRouter.use('/', protect, adminOnly);
adminRouter.post('/', uploadCardImage, createCard);
adminRouter.put('/:id', uploadCardImage, updateCard);
adminRouter.delete('/:id', deleteCard);

module.exports = { publicCardRoutes: publicRouter, adminCardRoutes: adminRouter };
