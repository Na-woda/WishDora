const Category = require('../models/Category');
const GreetingCard = require('../models/GreetingCard');
const { asyncHandler } = require('../middleware/errorHandler');
const { uploadBufferToCloudinary, deleteFromCloudinary } = require('../services/cloudinaryService');

// @route  GET /api/categories
// @access Public
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ name: 1 }).lean();
  const categoriesWithCounts = await Promise.all(
    categories.map(async (cat) => {
      const cardCount = await GreetingCard.countDocuments({ category: cat._id });
      return { ...cat, cardCount };
    })
  );
  res.status(200).json({ success: true, categories: categoriesWithCounts });
});

// @route  POST /api/admin/categories
// @access Private/Admin
const createCategory = asyncHandler(async (req, res) => {
  const { name, description, icon, color } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Category name is required' });
  }

  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const existing = await Category.findOne({ slug });
  if (existing) {
    return res.status(409).json({ success: false, message: 'This category already exists' });
  }

  const image = req.file
    ? await uploadBufferToCloudinary(req.file.buffer, 'wishdora/categories', req.file.mimetype)
    : null;
  const category = await Category.create({
    name: name.trim(),
    description: typeof description === 'string' ? description.trim() : undefined,
    icon: typeof icon === 'string' ? icon.trim() : undefined,
    color: typeof color === 'string' ? color.trim() : undefined,
    imageUrl: image?.secure_url || '',
    imagePublicId: image?.public_id || '',
    createdBy: req.admin._id,
  });
  res.status(201).json({ success: true, category });
});

// @route  PUT /api/admin/categories/:id
// @access Private/Admin
const updateCategory = asyncHandler(async (req, res) => {
  const { name, description, icon, color, removeImage } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Category name is required' });
  }

  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const duplicate = await Category.findOne({ slug, _id: { $ne: category._id } });
  if (duplicate) {
    return res.status(409).json({ success: false, message: 'Another category already uses this name' });
  }

  category.name = name.trim();
   category.slug = slug;
  if (typeof description === 'string') category.description = description.trim();
  if (typeof icon === 'string') category.icon = icon.trim();
  if (typeof color === 'string') category.color = color.trim();
  if (req.file) {
    const image = await uploadBufferToCloudinary(req.file.buffer, 'wishdora/categories', req.file.mimetype);
    const oldImagePublicId = category.imagePublicId;
    category.imageUrl = image.secure_url;
    category.imagePublicId = image.public_id || '';
    await deleteFromCloudinary(oldImagePublicId);
  } else if (removeImage === 'true') {
    const oldImagePublicId = category.imagePublicId;
    category.imageUrl = '';
    category.imagePublicId = '';
    await deleteFromCloudinary(oldImagePublicId);
  }
  await category.save();
  res.status(200).json({ success: true, category });
});

// @route  DELETE /api/admin/categories/:id
// @access Private/Admin
const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  const cardCount = await GreetingCard.countDocuments({ category: category._id });
  if (cardCount > 0) {
    return res.status(409).json({
      success: false,
      message: `Cannot delete — ${cardCount} card(s) still use this category`,
    });
  }

  await deleteFromCloudinary(category.imagePublicId);
  await category.deleteOne();
  res.status(200).json({ success: true, message: 'Category deleted' });
});

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
