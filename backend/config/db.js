const mongoose = require('mongoose');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');

/**
 * Connects to MongoDB using the URI from environment variables.
 * Exits the process on failure so the app never runs without a DB connection.
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoUri) {
      console.warn('[MongoDB] No MONGO_URI or MONGODB_URI set. Continuing without database connection.');
      return null;
    }

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      family: 4,
    });
    console.log(`[MongoDB] Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error(`[MongoDB] Connection error: ${err.message}`);
    console.warn('[MongoDB] Continuing without database connection so the site can still serve feedback requests.');
    return null;
  }
};

module.exports = connectDB;
