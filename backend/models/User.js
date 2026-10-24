// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, trim: true },
  avatar: { type: String, default: '' },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },

  isPremium: {type: Boolean,default: false,},
  premiumSince: {type: Date,default: null,},
  isActive: {type: Boolean,default: true,},
  tokenVersion: { type: Number, default: 0, min: 0 },
  resetOtp: { type: String, default: null },
  resetOtpExpire: { type: Date, default: null },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Never send password in JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.tokenVersion;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
