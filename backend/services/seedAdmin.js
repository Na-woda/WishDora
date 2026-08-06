/**
 * Creates (or resets the password of) the first admin account, using
 * FIRST_ADMIN_EMAIL / FIRST_ADMIN_PASSWORD from .env.
 *
 * Run once:  node services/seedAdmin.js
 */
require('dotenv').config();

// Previous setup:
// const dns = require('dns');
// const mongoose = require('mongoose');
// dns.setDefaultResultOrder('ipv4first');

// New setup:
const dns = require('dns');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

dns.setDefaultResultOrder('ipv4first');

const getMongoUri = () => process.env.MONGO_URI || process.env.MONGODB_URI;

(async () => {
  try {
    const email = process.env.FIRST_ADMIN_EMAIL;
    const password = process.env.FIRST_ADMIN_PASSWORD;
    const mongoUri = getMongoUri();

    if (!email || !password) {
      throw new Error('Set FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD in your .env file first');
    }

    if (!mongoUri) {
      throw new Error('Set MONGO_URI or MONGODB_URI in your .env file before seeding the admin');
    }

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      family: 4,
    });
    console.log('[Seed] Connected to MongoDB');

    let admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');

    if (admin) {
      admin.password = password; // pre-save hook re-hashes it
      admin.isActive = true;
      await admin.save();
      console.log(`[Seed] Existing admin updated: ${email}`);
    } else {
      admin = await Admin.create({
        name: 'Super Admin',
        email,
        password,
        role: 'superadmin',
      });
      console.log(`[Seed] Admin created: ${email}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('[Seed] Failed:', err.message);
    process.exit(1);
  }
})();
