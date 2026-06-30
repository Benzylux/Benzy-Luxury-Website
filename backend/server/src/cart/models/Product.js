const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  variantId: { type: String, required: true, trim: true },
  sku: { type: String, trim: true, default: '' },
  color: { type: String, trim: true, default: '' },
  size: { type: String, trim: true, default: '' },
  stockQuantity: { type: Number, min: 0, default: 0 },
  price: { type: Number, min: 0, required: true },
  image: { type: String, trim: true, default: '' },
  isDefault: { type: Boolean, default: false }
}, { _id: false });

const productSchema = new mongoose.Schema({
  productId: { type: String, required: true, trim: true, unique: true, index: true },
  normalizedName: { type: String, required: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, trim: true, default: '' },
  categoryId: { type: String, trim: true, default: 'all' },
  categoryIds: { type: [String], default: [] },
  categoryName: { type: String, trim: true, default: 'All' },
  price: { type: Number, min: 0, required: true },
  currency: { type: String, trim: true, default: 'NGN' },
  image: { type: String, trim: true, default: '' },
  images: { type: [String], default: [] },
  stockQuantity: { type: Number, min: 0, default: 0 },
  isActive: { type: Boolean, default: true },
  variants: { type: [variantSchema], default: [] },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  collection: 'products',
  timestamps: true
});

module.exports = mongoose.models.BlxProduct || mongoose.model('BlxProduct', productSchema);
