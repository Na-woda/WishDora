const GreetingCard = require('../models/GreetingCard');
const Category = require('../models/Category');
const { asyncHandler } = require('../middleware/errorHandler');
const { uploadBufferToCloudinary, deleteFromCloudinary } = require('../services/cloudinaryService');

// @route  POST /api/admin/cards
// @access Private/Admin
const createCard = asyncHandler(async (req, res) => {
  const { title, category, isPremium } = req.body;

  if (!title || !category) {
    return res.status(400).json({ success: false, message: 'Title and category are required' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'A card image is required' });
  }

  const categoryDoc = await Category.findById(category);
  if (!categoryDoc) {
    return res.status(400).json({ success: false, message: 'Invalid category' });
  }

  const result = await uploadBufferToCloudinary(req.file.buffer, 'wishdora/cards', req.file.mimetype);

  const card = await GreetingCard.create({
    title,
    category,
    imageUrl: result.secure_url,
    imagePublicId: result.public_id || '',
    isPremium: isPremium === 'true' || isPremium === true,
    createdBy: req.admin._id,
  });

  res.status(201).json({ success: true, card });
});

// @route  PUT /api/admin/cards/:id
// @access Private/Admin
const updateCard = asyncHandler(async (req, res) => {
  const card = await GreetingCard.findById(req.params.id);
  if (!card) {
    return res.status(404).json({ success: false, message: 'Card not found' });
  }

  const { title, category, isPremium } = req.body;

  if (category) {
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      return res.status(400).json({ success: false, message: 'Invalid category' });
    }
    card.category = category;
  }
  if (title) card.title = title;
  if (isPremium !== undefined) card.isPremium = isPremium === 'true' || isPremium === true;

  // Replace image only if a new file was uploaded
  if (req.file) {
    const oldPublicId = card.imagePublicId;
    const result = await uploadBufferToCloudinary(req.file.buffer, 'wishdora/cards', req.file.mimetype);
    card.imageUrl = result.secure_url;
    card.imagePublicId = result.public_id || '';
    await deleteFromCloudinary(oldPublicId);
  }

  await card.save();
  res.status(200).json({ success: true, card });
});

// @route  DELETE /api/admin/cards/:id
// @access Private/Admin
const deleteCard = asyncHandler(async (req, res) => {
  const card = await GreetingCard.findById(req.params.id);
  if (!card) {
    return res.status(404).json({ success: false, message: 'Card not found' });
  }

  await deleteFromCloudinary(card.imagePublicId);
  await card.deleteOne();

  res.status(200).json({ success: true, message: 'Card deleted' });
});

// @route  GET /api/cards
// @access Public (optionalAuth — premium visibility depends on caller)
// Query: page, limit, search, category, isPremium, sort
const getCards = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (req.query.search) {
    filter.title = { $regex: req.query.search, $options: 'i' };
  }
  if (req.query.category) {
    filter.category = req.query.category;
  }
  if (req.query.isPremium !== undefined) {
    filter.isPremium = req.query.isPremium === 'true';
  }

  const [cards, total] = await Promise.all([
    GreetingCard.find(filter)
      .populate('category', 'name slug')
      .sort({ createdAt: -1 }) // newest first
      .skip(skip)
      .limit(limit),
    GreetingCard.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    cards,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      limit,
    },
  });
});

// @route  GET /api/cards/:id
// @access Public (optionalAuth)
// Free users get metadata but the API flags locked status; the frontend
// enforces the "premium only" message using the `locked` field.
const getCardById = asyncHandler(async (req, res) => {
  const card = await GreetingCard.findById(req.params.id).populate('category', 'name slug');
  if (!card) {
    return res.status(404).json({ success: false, message: 'Card not found' });
  }

  const isPremiumUser = req.user?.isPremium || req.userType === 'admin';
  const locked = card.isPremium && !isPremiumUser;

  res.status(200).json({ success: true, card, locked });
});

module.exports = { createCard, updateCard, deleteCard, getCards, getCardById };
