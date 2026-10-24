const assert = require('node:assert/strict');
const express = require('express');
const test = require('node:test');
const User = require('../models/User');
const emailService = require('../services/emailService');

let deliverOtp = async () => {};
const originalFindOne = User.findOne;
const originalSendOtpEmail = emailService.sendOtpEmail;
User.findOne = async () => ({
  email: 'person@example.test',
  name: 'Test User',
  save: async () => {},
});
emailService.sendOtpEmail = (...args) => deliverOtp(...args);
const authRoutes = require('../routes/auth');

async function requestPasswordReset(delivery) {
  deliverOtp = delivery;
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  const server = app.listen(0, '127.0.0.1');
  const output = [];
  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
  for (const method of Object.keys(originalConsole)) {
    console[method] = (...args) => {
      output.push(args.map((value) => (
        typeof value === 'string' ? value : '[non-string log value]'
      )).join(' '));
    };
  }

  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'person@example.test' }),
    });
    return { status: response.status, body: await response.text(), output };
  } finally {
    for (const method of Object.keys(originalConsole)) {
      console[method] = originalConsole[method];
    }
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('password-reset request does not emit the OTP in logs or response', async () => {
  let generatedOtp;
  const { status, body, output } = await requestPasswordReset(async (_email, _name, otp) => {
    generatedOtp = otp;
  });

  assert.equal(status, 200);
  assert.equal(/^\d{6}$/.test(generatedOtp), true, 'the reset flow should generate an OTP');
  assert.equal(output.some((line) => line.includes(generatedOtp)), false, 'reset logs must not contain the OTP');
  assert.equal(body.includes(generatedOtp), false, 'the reset response must not contain the OTP');
  assert.equal(body.includes('devOtp'), false, 'the reset response must not expose a development OTP field');
});

test('failed OTP delivery logs only a safe error category', async () => {
  let generatedOtp;
  const { status, body, output } = await requestPasswordReset(async (_email, _name, otp) => {
    generatedOtp = otp;
    throw new Error('SMTP delivery failed');
  });

  assert.equal(status, 503);
  assert.equal(output.some((line) => line.includes(generatedOtp)), false, 'delivery-failure logs must not contain the OTP');
  assert.equal(output.some((line) => line.includes('SMTP delivery failed')), false, 'delivery logs must not expose error details');
  assert.equal(body.includes(generatedOtp), false, 'the reset response must not contain the OTP');
  assert.match(body, /Unable to send a verification code/);
});

test.after(() => {
  User.findOne = originalFindOne;
  emailService.sendOtpEmail = originalSendOtpEmail;
});
