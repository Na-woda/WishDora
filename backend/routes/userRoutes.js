const express = require('express');
const { getUsers, getAllWishesAdmin, getDashboardStats } = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminAuth');

const router = express.Router();
router.use('/', protect, adminOnly);

router.get('/users', getUsers);
router.get('/wishes', getAllWishesAdmin);
router.get('/dashboard/stats', getDashboardStats);

module.exports = router;
