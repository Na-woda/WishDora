const express = require('express');
const { cronAuth } = require('../middleware/cronAuth');
const { runScheduler } = require('../controllers/schedulerController');

const router = express.Router();

router.get('/run', cronAuth, runScheduler);

module.exports = router;
