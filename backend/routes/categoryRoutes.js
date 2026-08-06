const express = require('express');
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminAuth');
const { uploadCardImage } = require('../middleware/upload');

const publicRouter = express.Router();
publicRouter.get('/', getCategories);

const adminRouter = express.Router();
adminRouter.use('/', protect, adminOnly);
adminRouter.post('/', uploadCardImage, createCategory);
adminRouter.put('/:id', uploadCardImage, updateCategory);
adminRouter.delete('/:id', deleteCategory);

module.exports = { publicCategoryRoutes: publicRouter, adminCategoryRoutes: adminRouter };
