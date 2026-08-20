// Central place to point the frontend at the backend API.
// Relative path so it resolves against whatever origin is serving the site
// (the /api/* redirect in netlify.toml proxies this to the Netlify Function).
window.API_BASE_URL = '/api';
