// netlify/functions/api.js — exposes the existing Express backend (backend/app.js)
// as a single Netlify Function, so the routes/controllers/models don't need to be
// rewritten. netlify.toml redirects /api/* here.
const serverless = require('serverless-http');
const createApp = require('../../backend/app');

const app = createApp();
const handler = serverless(app);

exports.handler = async (event, context) => {
  // The /api/* redirect forwards requests to /.netlify/functions/api/*, but the
  // Express app's routes are mounted at /api/*. Restore that prefix so the
  // existing route mounts (app.use('/api/auth', ...) etc.) still match.
  event.path = event.path.replace('/.netlify/functions/api', '/api');

  // Netlify doesn't reliably populate X-Forwarded-For the way a typical reverse
  // proxy does; x-nf-client-connection-ip is the documented, reliable source for
  // the real client IP on standard Functions. Surface it the way serverless-http
  // (and in turn express-rate-limit's per-IP keying) expects to find it.
  const clientIp = event.headers?.['x-nf-client-connection-ip']
    || (event.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  if (clientIp) {
    event.requestContext = {
      ...(event.requestContext || {}),
      identity: { ...(event.requestContext?.identity || {}), sourceIp: clientIp },
    };
  }

  return handler(event, context);
};
