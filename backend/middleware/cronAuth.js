const crypto = require('crypto');

function unauthorized(res) {
  return res.status(403).json({
    success: false,
    message: 'Unauthorized scheduler request',
  });
}

function cronAuth(req, res, next) {
  const expectedSecret = (process.env.CRON_SECRET || '').trim();

  if (!expectedSecret) {
    console.error('[Scheduler] CRON_SECRET is not configured in environment variables');
    return unauthorized(res);
  }

  // Extract secret from Authorization header, x-cron-secret header, or query param
  let suppliedSecret = '';
  const authorization = req.get('authorization');
  const customHeader = req.get('x-cron-secret');
  const querySecret = req.query.key || req.query.secret;

  if (authorization && authorization.startsWith('Bearer ')) {
    suppliedSecret = authorization.slice('Bearer '.length).trim();
  } else if (customHeader) {
    suppliedSecret = customHeader.trim();
  } else if (querySecret) {
    suppliedSecret = String(querySecret).trim();
  }

  if (!suppliedSecret) {
    return unauthorized(res);
  }

  const expectedBuffer = Buffer.from(expectedSecret, 'utf8');
  const suppliedBuffer = Buffer.from(suppliedSecret, 'utf8');

  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return unauthorized(res);
  }

  return next();
}

module.exports = { cronAuth };
