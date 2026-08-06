const mongoose = require('mongoose');

const greetingCardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Card title is required'],
      trim: true,
      maxlength: 150,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Card category is required'],
    },
    imageUrl: {
      type: String,
      required: [true, 'Image URL is required'],
    },
    imagePublicId: {
      // Cloudinary public_id, needed to delete/replace the image later
      type: String,
      required: true,
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
  },
  { timestamps: true }
);

greetingCardSchema.index({ title: 'text' });
greetingCardSchema.index({ category: 1 });
greetingCardSchema.index({ isPremium: 1 });
greetingCardSchema.index({ createdAt: -1 });

module.exports = mongoose.model('GreetingCard', greetingCardSchema);
