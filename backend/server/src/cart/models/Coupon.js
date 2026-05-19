const mongoose = require('mongoose');

const usageBySubjectSchema = new mongoose.Schema({
  subjectType: { type: String, enum: ['user', 'email', 'guest'], required: true },
  subjectId: { type: String, required: true, trim: true },
  email: { type: String, trim: true, default: '' },
  count: { type: Number, min: 0, default: 0 },
  lastUsedAt: { type: Date, default: null }
}, { _id: false });

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true },
  discountType: { type: String, enum: ['fixed', 'percent'], required: true },
  discountValue: { type: Number, required: true, min: 0 },
  minimumOrderAmount: { type: Number, min: 0, default: 0 },
  maximumDiscountAmount: { type: Number, min: 0, default: null },
  expiresAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  usageLimit: { type: Number, min: 0, default: null },
  usedCount: { type: Number, min: 0, default: 0 },
  perUserLimit: { type: Number, min: 0, default: null },
  applicableProductIds: { type: [String], default: [] },
  applicableCategoryIds: { type: [String], default: [] },
  excludedProductIds: { type: [String], default: [] },
  freeShipping: { type: Boolean, default: false },
  usageBySubject: { type: [usageBySubjectSchema], default: [] }
}, {
  collection: 'coupons',
  timestamps: true
});

module.exports = mongoose.models.BlxCoupon || mongoose.model('BlxCoupon', couponSchema);
