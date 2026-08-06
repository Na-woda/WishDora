const crypto = require('crypto');

function unauthorized(res) {
  return res.status(403).json({
    success: false,
    message: 'Unauthorized scheduler request',
  });
}

function cronAuth(req, res, next) {
  const expectedSecret = process.env.CRON_SECRET;
  const authorization = req.get('authorization');

  if (!expectedSecret || !authorization || !authorization.startsWith('Bearer ')) {
    return unauthorized(res);
  }

  const suppliedSecret = authorization.slice('Bearer '.length);
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
