// models/Wish.js
const mongoose = require('mongoose');

const wishSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Sender info
  senderName: { type: String, required: true },
  senderEmail: { type: String, required: true },

  // Receiver info
  receiverName: { type: String, required: true },
  receiverEmail: { type: String },
  receiverWhatsapp: { type: String }, // E.164 format e.g. +94771234567

  // Wish content
  greeting: { type: String, required: true, default: 'Happy Birthday' },
  message: { type: String, required: true },
  selectedCardId: { type: mongoose.Schema.Types.ObjectId, ref: 'GreetingCard', default: null },
  cardImage: { type: String, default: '' }, // Public Cloudinary URL for the selected greeting card

  // Scheduling
  scheduleDate: { type: Date, required: true },
  scheduleTime: { type: String }, // HH:MM stored for display
  repeat: { type: String, enum: ['none', 'daily', 'yearly'], default: 'none' },

  // Delivery
  deliveryMethod: { type: String, enum: ['email', 'whatsapp', 'both'], default: 'email' },

  // Status
  // Processing is an atomic scheduler lock. A wish must be claimed before email is sent.
  status: { type: String, enum: ['Pending', 'Processing', 'Sent', 'Failed', 'Draft'], default: 'Pending' },
  sentAt: { type: Date },
  failReason: { type: String },

  // For yearly repeat: next send date
  nextSendDate: { type: Date },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

wishSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Index for cron job queries (find pending wishes due now)
wishSchema.index({ status: 1, scheduleDate: 1 });
wishSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Wish', wishSchema);
