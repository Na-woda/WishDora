// js/api.js — WishDora API client

const API_BASE = 'http://localhost:5000/api';

// ── Token helpers ──────────────────────────────────────────
const Auth = {
  getToken: () => localStorage.getItem('wd_token'),
  getUser: () => JSON.parse(localStorage.getItem('wd_user') || 'null'),
  setSession: (token, user) => {
    localStorage.setItem('wd_token', token);
    localStorage.setItem('wd_user', JSON.stringify(user));
  },
  clearSession: () => {
    localStorage.removeItem('wd_token');
    localStorage.removeItem('wd_user');
  },
  isLoggedIn: () => !!localStorage.getItem('wd_token'),
  requireAuth: () => {
    if (!localStorage.getItem('wd_token')) {
      window.location.href = 'signin.html';
      return false;
    }
    return true;
  },
};

// ── Fetch wrapper ─────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const token = Auth.getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (networkErr) {
    throw new Error('Cannot reach server. Make sure backend is running on port 5000 (run: node server.js)');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ── Auth API ───────────────────────────────────────────────
const AuthAPI = {
  register: (data) => apiFetch('/auth/register', { method: 'POST', body: data }),
  login: (data) => apiFetch('/auth/login', { method: 'POST', body: data }),
  forgotPassword: (data) => apiFetch('/auth/forgot-password', { method: 'POST', body: data }),
  verifyOtp: (data) => apiFetch('/auth/verify-otp', { method: 'POST', body: data }),
  resetPassword: (data) => apiFetch('/auth/reset-password', { method: 'POST', body: data }),
  me: () => apiFetch('/auth/me'),
  updateProfile: (data) => apiFetch('/auth/profile', { method: 'PUT', body: data }),
};

// ── Wishes API ─────────────────────────────────────────────
const WishesAPI = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/wishes${q ? '?' + q : ''}`);
  },
  getUpcoming: () => apiFetch('/wishes/upcoming'),
  create: (data) => apiFetch('/wishes', { method: 'POST', body: data }),
  update: (id, data) => apiFetch(`/wishes/${id}`, { method: 'PUT', body: data }),
  delete: (id) => apiFetch(`/wishes/${id}`, { method: 'DELETE' }),
  resend: (id) => apiFetch(`/wishes/${id}/resend`, { method: 'POST' }),
};

// ── Dark mode ──────────────────────────────────────────────
const DarkMode = {
  init() {
    // Default: dark ON (unless user explicitly turned it off)
    const dark = localStorage.getItem('wd_dark') !== '0';
    document.body.classList.toggle('dark', dark);
    document.body.classList.toggle('light-mode', !dark);
    this.updateIcon();
  },
  toggle() {
    const isDark = !document.body.classList.contains('dark');
    document.body.classList.toggle('dark', isDark);
    document.body.classList.toggle('light-mode', !isDark);
    localStorage.setItem('wd_dark', isDark ? '1' : '0');
    this.updateIcon();
  },
  updateIcon() {
    const btn = document.getElementById('modeBtn') || document.getElementById('modechange');
    if (btn) btn.textContent = document.body.classList.contains('dark') ? '🌙' : '☀️';
  },
};

function toggleDark() {
  DarkMode.toggle();
}

// ── Toast notifications ────────────────────────────────────
function showToast(message, type = 'success') {
  const existing = document.querySelector('.wd-toast');
  if (existing) existing.remove();

  const colors = {
    success: 'linear-gradient(135deg,#2e7d4f,#4ade80)',
    error: 'linear-gradient(135deg,#cc2222,#f87171)',
    info: 'linear-gradient(135deg,#c25c0c,#e8782a)',
  };

  const toast = document.createElement('div');
  toast.className = 'wd-toast';
  toast.innerHTML = message;
  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    padding:14px 22px;border-radius:12px;color:#fff;font-size:14px;font-weight:500;
    background:${colors[type] || colors.info};
    box-shadow:0 6px 20px rgba(0,0,0,0.2);
    animation:slideInToast 0.3s ease;
    max-width:320px;line-height:1.4;
  `;

  if (!document.querySelector('#wd-toast-style')) {
    const style = document.createElement('style');
    style.id = 'wd-toast-style';
    style.textContent = '@keyframes slideInToast{from{transform:translateX(120px);opacity:0}to{transform:translateX(0);opacity:1}}';
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ── Navbar updater ─────────────────────────────────────────
function updateNavbar() {
  const user = Auth.getUser();
  const accountBtn = document.querySelector('.nav-account-btn');
  if (accountBtn) {
    if (user) {
      accountBtn.textContent = '👤';
      accountBtn.title = user.name;
      accountBtn.href = 'dashboard.html';
    } else {
      accountBtn.textContent = '👤';
      accountBtn.href = 'signin.html';
    }
  }
}


// ---------------------------------------------------------------------------
// Thin wrapper around fetch() that attaches the admin JWT and handles
// 401/403 uniformly across every admin module.
// ---------------------------------------------------------------------------

async function adminFetch(path, options = {}) {
  const token = getAdminToken();
  const baseUrl = (window.API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
  const headers = { ...(options.headers || {}) };

  // Only set JSON content-type when we're not sending FormData (file uploads).
  if (!(options.body instanceof FormData) && options.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearAdminSession();
    window.location.href = 'login.html';
    throw new Error('Session expired');
  }
  if (res.status === 403) {
    showToast('You do not have permission to do that', 'error');
    throw new Error('Forbidden');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

function showToast(message, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
