const { runDueWishes } = require('../services/schedulerService');

async function runScheduler(req, res) {
  try {
    const result = await runDueWishes();

    return res.json({
      success: true,
      message: 'Scheduler executed successfully',
      ...result,
    });
  } catch (err) {
    console.error('[Scheduler] Execution failed:', err);
    return res.status(500).json({
      success: false,
      message: 'Scheduler execution failed',
    });
  }
}

module.exports = { runScheduler };
