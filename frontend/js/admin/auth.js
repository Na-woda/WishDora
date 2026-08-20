// ---------------------------------------------------------------------------
// Admin authentication: login form (on login.html) + guard (used by dashboard.js)
// ---------------------------------------------------------------------------

const ADMIN_TOKEN_KEY = 'wishdora_admin_token';
const ADMIN_INFO_KEY = 'wishdora_admin_info';
const API_BASE_URL = (window.API_BASE_URL || '/api').replace(/\/$/, '');

function saveAdminSession(token, admin) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_INFO_KEY, JSON.stringify(admin));
}

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function getAdminInfo() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_INFO_KEY));
  } catch {
    return null;
  }
}

function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_INFO_KEY);
}

// Call at the top of any admin-only page. Redirects to login if no token.
function requireAdminAuth() {
  if (!getAdminToken()) {
    window.location.href = 'login.html';
  }
}

// Attach the login form handler only if we're on login.html
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in…';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const res = await fetch(`${API_BASE_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Login failed');
      }

      const token = data.token;
      const admin = data.admin || data.user || null;
      if (!token || !admin) {
        throw new Error('Invalid login response from server');
      }

      saveAdminSession(token, admin);
      window.location.href = 'dashboard.html';
    } catch (err) {
      loginError.textContent = err.message || 'Something went wrong. Please try again.';
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  });
}
