const User = require('../models/User');
const GreetingCard = require('../models/GreetingCard');
const Wish = require('../models/Wish');
const { asyncHandler } = require('../middleware/errorHandler');

// @route  GET /api/admin/users
// @access Private/Admin
// Query: page, limit, search
const getUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    users,
    pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit },
  });
});

// @route  GET /api/admin/wishes
// @access Private/Admin
const getAllWishesAdmin = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const [wishes, total] = await Promise.all([
    Wish.find()
      .populate('userId', 'name email')
      .populate('selectedCardId', 'title imageUrl')
      .sort({ scheduleDate: 1 })
      .skip(skip)
      .limit(limit),
    Wish.countDocuments(),
  ]);

  res.status(200).json({
    success: true,
    wishes,
    pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit },
  });
});

// @route  GET /api/admin/dashboard/stats
// @access Private/Admin
const getDashboardStats = asyncHandler(async (req, res) => {
  const [totalUsers, totalCards, premiumCards, freeCards, scheduledWishes, latestUploads] =
    await Promise.all([
      User.countDocuments(),
      GreetingCard.countDocuments(),
      GreetingCard.countDocuments({ isPremium: true }),
      GreetingCard.countDocuments({ isPremium: false }),
      Wish.countDocuments(),
      GreetingCard.find().populate('category', 'name').sort({ createdAt: -1 }).limit(5),
    ]);

  res.status(200).json({
    success: true,
    stats: {
      totalUsers,
      totalCards,
      premiumCards,
      freeCards,
      scheduledWishes,
    },
    latestUploads,
  });
});

module.exports = { getUsers, getAllWishesAdmin, getDashboardStats };
