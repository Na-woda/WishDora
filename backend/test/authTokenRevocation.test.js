const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const test = require('node:test');

process.env.JWT_SECRET = 'test-only-jwt-secret';

const User = require('../models/User');
const authRoutes = require('../routes/auth');
const { protect, optionalAuth } = require('../middleware/auth');

const originalFindOne = User.findOne;
const originalFindOneAndUpdate = User.findOneAndUpdate;
const originalFindById = User.findById;
const users = new Map();

function queryFor(value) {
  return {
    select: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
}

function createUser({ id, email, password, tokenVersion = 0, resetOtp = null }) {
  return {
    _id: id,
    name: `User ${id}`,
    email,
    password,
    isActive: true,
    tokenVersion,
    resetOtp,
    resetOtpExpire: resetOtp ? new Date(Date.now() + 60_000) : null,
    comparePassword(candidate) {
      return bcrypt.compare(candidate, this.password);
    },
  };
}

User.findOne = (filter) => queryFor([...users.values()].find((user) => user.email === filter.email) || null);
User.findById = (id) => queryFor(users.get(String(id)) || null);
User.findOneAndUpdate = async (filter, update) => {
  const user = users.get(String(filter._id));
  if (!user
    || user.resetOtp !== filter.resetOtp
    || !user.resetOtpExpire
    || user.resetOtpExpire <= filter.resetOtpExpire.$gt) {
    return null;
  }

  Object.assign(user, update.$set);
  user.tokenVersion = (user.tokenVersion ?? 0) + update.$inc.tokenVersion;
  return user;
};

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.get('/protected', protect, (req, res) => res.json({ success: true, userId: req.user._id }));
app.get('/optional', optionalAuth, (req, res) => res.json({ success: true, userType: req.userType }));

let server;
let baseUrl;

test.before(async () => {
  users.set('user-1', createUser({
    id: 'user-1',
    email: 'person@example.test',
    password: await bcrypt.hash('old-password', 4),
    resetOtp: '654321',
  }));
  users.set('user-2', createUser({
    id: 'user-2',
    email: 'another@example.test',
    password: await bcrypt.hash('another-password', 4),
  }));
  delete users.get('user-1').tokenVersion;
  delete users.get('user-2').tokenVersion;

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  User.findOne = originalFindOne;
  User.findOneAndUpdate = originalFindOneAndUpdate;
  User.findById = originalFindById;
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

async function request(path, { token, ...options } = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  return { status: response.status, body: await response.json() };
}

test('password reset revokes only that user session and newly issued token works', async () => {
  assert.equal(new User({ name: 'Legacy', email: 'legacy@example.test', password: 'hashed' }).tokenVersion, 0);
  const oldToken = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const otherUserToken = jwt.sign({ id: 'user-2' }, process.env.JWT_SECRET, { expiresIn: '10m' });

  const beforeReset = await request('/protected', { token: oldToken });
  assert.equal(beforeReset.status, 200);
  assert.equal(beforeReset.body.userId, 'user-1');

  const reset = await request('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'person@example.test',
      otp: '654321',
      newPassword: 'new-password',
    }),
  });
  assert.equal(reset.status, 200);
  assert.equal(users.get('user-1').tokenVersion, 1);

  const oldTokenAfterReset = await request('/protected', { token: oldToken });
  assert.equal(oldTokenAfterReset.status, 401);

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'person@example.test', password: 'new-password' }),
  });
  assert.equal(login.status, 200);
  const newTokenAfterReset = await request('/protected', { token: login.body.token });
  assert.equal(newTokenAfterReset.status, 200);
  assert.equal(newTokenAfterReset.body.userId, 'user-1');

  const otherUserStillValid = await request('/protected', { token: otherUserToken });
  assert.equal(otherUserStillValid.status, 200);
  assert.equal(otherUserStillValid.body.userId, 'user-2');
});

test('optional authentication fails closed when account revocation state cannot be loaded', async () => {
  User.findById = () => ({
    select: async () => {
      throw new Error('database unavailable');
    },
  });
  const token = jwt.sign({ id: 'user-2', tokenVersion: 0 }, process.env.JWT_SECRET, { expiresIn: '10m' });

  const response = await request('/optional', { token });
  assert.equal(response.status, 503);
  assert.equal(response.body.userType, undefined);
});
