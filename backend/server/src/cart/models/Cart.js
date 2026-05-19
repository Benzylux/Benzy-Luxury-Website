const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  lineKey: { type: String, required: true, trim: true },
  productId: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  image: { type: String, trim: true, default: '' },
  quantity: { type: Number, required: true, min: 1 },
  size: { type: String, trim: true, default: '' },
  color: { type: String, trim: true, default: '' },
  variantId: { type: String, trim: true, default: '' },
  categoryId: { type: String, trim: true, default: 'all' }
}, { _id: true });

const appliedCouponSchema = new mongoose.Schema({
  code: { type: String, trim: true, uppercase: true, default: null },
  discountType: { type: String, enum: ['fixed', 'percent'], default: null },
  discountValue: { type: Number, min: 0, default: 0 },
  minimumOrderAmount: { type: Number, min: 0, default: 0 },
  maximumDiscountAmount: { type: Number, min: 0, default: null },
  freeShipping: { type: Boolean, default: false }
}, { _id: false });

const cartSummarySchema = new mongoose.Schema({
  subtotal: { type: Number, min: 0, default: 0 },
  discount: { type: Number, min: 0, default: 0 },
  shippingFee: { type: Number, min: 0, default: 0 },
  total: { type: Number, min: 0, default: 0 },
  appliedCoupon: { type: appliedCouponSchema, default: null },
  couponMessage: { type: String, trim: true, default: '' }
}, { _id: false });

const cartSchema = new mongoose.Schema({
  userId: { type: String, required: true, trim: true, unique: true, index: true },
  email: { type: String, required: true, trim: true, index: true },
  items: { type: [cartItemSchema], default: [] },
  couponCode: { type: String, trim: true, uppercase: true, default: null },
  summary: { type: cartSummarySchema, default: () => ({}) },
  lastValidatedAt: { type: Date, default: null }
}, {
  collection: 'carts',
  timestamps: true
});

module.exports = mongoose.models.BlxCart || mongoose.model('BlxCart', cartSchema);
