// ---------------------------------------------------------------------------
// Lightweight session helper for regular (non-admin) users on wishform.html
// ---------------------------------------------------------------------------

const USER_TOKEN_KEY = 'wishdora_user_token';
const USER_INFO_KEY = 'wishdora_user_info';

function saveUserSession(token, user) {
  localStorage.setItem(USER_TOKEN_KEY, token);
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
}
function getUserToken() {
  return localStorage.getItem(USER_TOKEN_KEY);
}
function getUserInfo() {
  try {
    return JSON.parse(localStorage.getItem(USER_INFO_KEY));
  } catch {
    return null;
  }
}
function clearUserSession() {
  localStorage.removeItem(USER_TOKEN_KEY);
  localStorage.removeItem(USER_INFO_KEY);
}

// Authenticated fetch for the user side — attaches token if present but
// does NOT force-redirect on 401 (browsing the gallery is allowed logged-out).
async function userFetch(path, options = {}) {
  const token = getUserToken();
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(data.message || 'Request failed');
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}




import { animate, scrambleText } from 'animejs';

const [ $p ] = utils.$('p');
const [ $button ] = utils.$('button');

const texts = ['Transition between different text.', 'Hello World!', 'Anime.js 4.4 scrambleText()'];
let i = 0;

function play() {
  i = (i + 1) % texts.length;
  animate($p, {
    innerHTML: scrambleText({ text: texts[i] }),
  });
}

play();

$button.addEventListener('click', play);