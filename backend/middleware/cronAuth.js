const crypto = require('crypto');

function unauthorized(res) {
  return res.status(403).json({
    success: false,
    message: 'Unauthorized scheduler request',
  });
}

function cronAuth(req, res, next) {
  const expectedSecret = (process.env.CRON_SECRET || process.env.JWT_SECRET || '').trim();

  if (!expectedSecret) {
    console.error('[Scheduler] Neither CRON_SECRET nor JWT_SECRET is configured in environment variables');
    return unauthorized(res);
  }

  // Extract secret from Authorization header, custom headers, or query params
  let suppliedSecret = '';
  const authorization = req.get('authorization') || '';
  const customHeader = req.get('x-cron-secret') || req.get('x-api-key') || '';
  const querySecret = req.query.key || req.query.secret || req.query.token || req.query.apiKey;

  if (authorization) {
    suppliedSecret = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : authorization.trim();
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
