const createApp = require('../backend/app');
const app = createApp({ serveStatic: false });
module.exports = app;
