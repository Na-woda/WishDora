const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      unique: true, // prevents duplicate categories at the DB level
      minlength: 2,
      maxlength: 50,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    // --- New optional fields for the redesigned card-picker UI ---
    description: {
      type: String,
      trim: true,
      maxlength: 140,
      default: '',
    },
     icon: {
      // Emoji kept as plain text — no Cloudinary upload needed for this
      type: String,
      trim: true,
      maxlength: 8,
      default: '🎉',
    },
    color: {
      // CSS gradient string, e.g. "linear-gradient(135deg,#e8782a,#c25c0c)"
      type: String,
      trim: true,
      default: '',
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    imagePublicId: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

// Auto-generate a URL-safe slug from the name, also used for case-insensitive dedupe
categorySchema.pre('validate', function generateSlug(next) {
  if (this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);
