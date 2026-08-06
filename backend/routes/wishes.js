// routes/wishes.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Wish = require('../models/Wish');
const GreetingCard = require('../models/GreetingCard');
const { protect } = require('../middleware/auth');

// All wish routes require authentication
router.use(protect);

// ── GET /api/wishes ────────────────────────────────────────
// Get all wishes for the logged-in user
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const query = { userId: req.user._id };
    if (status) query.status = status;

    const wishes = await Wish.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Wish.countDocuments(query);

    // Stats
    const stats = await Wish.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statsMap = { Pending: 0, Sent: 0, Failed: 0, Draft: 0 };
    stats.forEach(s => { statsMap[s._id] = s.count; });

    res.json({
      success: true,
      wishes,
      total,
      stats: statsMap,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/wishes/upcoming ───────────────────────────────
// Get upcoming wishes (next 30 days)
router.get('/upcoming', async (req, res) => {
  try {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const wishes = await Wish.find({
      userId: req.user._id,
      status: 'Pending',
      scheduleDate: { $gte: now, $lte: in30 },
    }).sort({ scheduleDate: 1 }).limit(10);

    res.json({ success: true, wishes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/wishes ───────────────────────────────────────
// Create and schedule a wish
router.post('/', [
  body('receiverName').trim().notEmpty().withMessage('Receiver name required'),
  body('greeting').trim().notEmpty(),
  body('message').trim().notEmpty().withMessage('Message required'),
  body('scheduleDate').notEmpty().withMessage('Schedule date required'),
  body('deliveryMethod').isIn(['email', 'whatsapp', 'both']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const {
      senderName, receiverName, receiverEmail, receiverWhatsapp,
      greeting, message, cardImage, selectedCardId,
      scheduleDate, scheduleTime, repeat, deliveryMethod,
    } = req.body;

    // Validate delivery method has required contact
    if ((deliveryMethod === 'email' || deliveryMethod === 'both') && !receiverEmail) {
      return res.status(400).json({ success: false, message: 'Receiver email required for email delivery' });
    }
    if ((deliveryMethod === 'whatsapp' || deliveryMethod === 'both') && !receiverWhatsapp) {
      return res.status(400).json({ success: false, message: 'Receiver WhatsApp number required' });
    }

    const scheduledDt = new Date(scheduleDate);
    if (isNaN(scheduledDt)) {
      return res.status(400).json({ success: false, message: 'Invalid schedule date' });
    }

    let resolvedCardImage = cardImage || '';

    // Preserve the selected card's image URL in the wish record so the scheduler can use it later.
    if (selectedCardId) {
      const card = await GreetingCard.findById(selectedCardId).select('imageUrl').lean();
      if (!card) {
        return res.status(400).json({ success: false, message: 'Selected card does not exist' });
      }
      if (!resolvedCardImage && card.imageUrl) {
        resolvedCardImage = card.imageUrl;
      }
    }

    const wish = await Wish.create({
      userId: req.user._id,
      senderName: senderName || req.user.name,
      senderEmail: req.user.email,
      receiverName,
      receiverEmail,
      receiverWhatsapp,
      greeting,
      message,
      selectedCardId: selectedCardId || null,
      cardImage: resolvedCardImage,
      scheduleDate: scheduledDt,
      scheduleTime,
      repeat: repeat || 'none',
      deliveryMethod,
      status: 'Pending',
    });

    res.status(201).json({
      success: true,
      message: `Wish scheduled for ${scheduledDt.toLocaleString()}`,
      wish,
    });
  } catch (err) {
    console.error('Create wish error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/wishes/:id ────────────────────────────────────
// Update a wish (only Pending or Draft can be edited)
router.put('/:id', protect, async (req, res) => {
  try {
    const wish = await Wish.findOne({ _id: req.params.id, userId: req.user._id });
    if (!wish) return res.status(404).json({ success: false, message: 'Wish not found' });

    if (wish.status === 'Sent') {
      return res.status(400).json({ success: false, message: 'Cannot edit a sent wish' });
    }

    const allowed = ['receiverName', 'receiverEmail', 'receiverWhatsapp', 'greeting',
      'message', 'selectedCardId', 'cardImage', 'scheduleDate', 'scheduleTime', 'repeat', 'deliveryMethod', 'status'];

    allowed.forEach(field => {
      if (req.body[field] !== undefined) wish[field] = req.body[field];
    });

    if (req.body.scheduleDate) wish.scheduleDate = new Date(req.body.scheduleDate);

    await wish.save();
    res.json({ success: true, wish });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/wishes/:id ─────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const wish = await Wish.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!wish) return res.status(404).json({ success: false, message: 'Wish not found' });
    res.json({ success: true, message: 'Wish deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/wishes/:id/resend ────────────────────────────
// Manually resend a failed wish
router.post('/:id/resend', protect, async (req, res) => {
  try {
    const wish = await Wish.findOne({ _id: req.params.id, userId: req.user._id });
    if (!wish) return res.status(404).json({ success: false, message: 'Wish not found' });

    const result = await dispatchWish(wish);
    const status = (!result.emailSent && !result.whatsappSent) ? 'Failed' : 'Sent';

    await Wish.findByIdAndUpdate(wish._id, {
      status,
      sentAt: status === 'Sent' ? new Date() : wish.sentAt,
      failReason: result.errors.join('; ') || undefined,
    });

    res.json({
      success: status === 'Sent',
      message: status === 'Sent' ? 'Wish resent successfully!' : 'Resend failed',
      result,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
