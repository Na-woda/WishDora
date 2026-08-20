const express = require('express');
const { cronAuth } = require('../middleware/cronAuth');
const { runScheduler } = require('../controllers/schedulerController');

const router = express.Router();

// Allow GET, POST, etc., and both /run and root /
router.all('/run', cronAuth, runScheduler);
router.all('/', cronAuth, runScheduler);

module.exports = router;
