const ScheduledWish = require('../models/ScheduledWish');
const GreetingCard = require('../models/GreetingCard');
const { asyncHandler } = require('../middleware/errorHandler');

// @route  POST /api/wishes
// @access Private/User
const createWish = asyncHandler(async (req, res) => {
  const { senderName, receiverName, receiverEmail, receiverWhatsapp, message, scheduleDate, selectedCardId } =
    req.body;

  if (!senderName || !receiverName || !message || !scheduleDate || !selectedCardId) {
    return res.status(400).json({
      success: false,
      message: 'senderName, receiverName, message, scheduleDate, and selectedCardId are required',
    });
  }

  const card = await GreetingCard.findById(selectedCardId);
  if (!card) {
    return res.status(400).json({ success: false, message: 'Selected card does not exist' });
  }

  // Enforce premium gating server-side — never trust the client on this.
  if (card.isPremium && !req.user.isPremium) {
    return res.status(403).json({
      success: false,
      message: 'This greeting card is available only for Premium users.',
      upgradeRequired: true,
    });
  }

  const wish = await ScheduledWish.create({
    senderName,
    receiverName,
    receiverEmail,
    receiverWhatsapp,
    message,
    scheduleDate,
    selectedCardId, // only the card ID is stored, never the image URL directly
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, wish });
});

// @route  GET /api/wishes/:id
// @access Private/User (owner) or Admin
// Populates the selected card so the frontend can render it above the message.
const getWishById = asyncHandler(async (req, res) => {
  const wish = await ScheduledWish.findById(req.params.id).populate({
    path: 'selectedCardId',
    select: 'title imageUrl category isPremium',
    populate: { path: 'category', select: 'name' },
  });

  if (!wish) {
    return res.status(404).json({ success: false, message: 'Scheduled wish not found' });
  }

  if (req.userType === 'user' && String(wish.createdBy) !== String(req.user._id)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  res.status(200).json({
    success: true,
    wish: {
      id: wish._id,
      senderName: wish.senderName,
      receiverName: wish.receiverName,
      message: wish.message,
      scheduleDate: wish.scheduleDate,
      status: wish.status,
      card: wish.selectedCardId
        ? {
            title: wish.selectedCardId.title,
            imageUrl: wish.selectedCardId.imageUrl,
            category: wish.selectedCardId.category?.name,
          }
        : null,
    },
  });
});

// @route  GET /api/wishes/my
// @access Private/User
const getMyWishes = asyncHandler(async (req, res) => {
  const wishes = await ScheduledWish.find({ createdBy: req.user._id })
    .populate('selectedCardId', 'title imageUrl')
    .sort({ scheduleDate: 1 });

  res.status(200).json({ success: true, wishes });
});

// @route  GET /api/admin/wishes
// @access Private/Admin
const getAllWishesAdmin = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const [wishes, total] = await Promise.all([
    ScheduledWish.find()
      .populate('selectedCardId', 'title imageUrl')
      .populate('createdBy', 'name email')
      .sort({ scheduleDate: 1 })
      .skip(skip)
      .limit(limit),
    ScheduledWish.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    wishes,
    pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit },
  });
});

module.exports = { createWish, getWishById, getMyWishes, getAllWishesAdmin };
