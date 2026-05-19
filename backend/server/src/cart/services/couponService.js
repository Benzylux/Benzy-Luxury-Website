const Coupon = require('../models/Coupon');
const couponSeed = require('../data/couponSeed');
const AppError = require('../utils/appError');
const { roundCurrency } = require('../utils/money');

function normalizeCouponCode(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function seedCoupons() {
  const existing = await Coupon.estimatedDocumentCount();
  if (existing > 0) return;
  await Coupon.insertMany(couponSeed, { ordered: true });
}

function getUsageCount(coupon, context = {}) {
  const usageRows = Array.isArray(coupon?.usageBySubject) ? coupon.usageBySubject : [];
  const userId = String(context.userId || '').trim();
  const email = normalizeEmail(context.email);
  const guestId = String(context.guestId || '').trim();

  return usageRows.reduce((highest, row) => {
    const matches =
      (userId && row.subjectType === 'user' && String(row.subjectId || '').trim() === userId) ||
      (email && row.subjectType === 'email' && normalizeEmail(row.subjectId) === email) ||
      (guestId && row.subjectType === 'guest' && String(row.subjectId || '').trim() === guestId) ||
      (email && normalizeEmail(row.email) === email);

    return matches ? Math.max(highest, Number(row.count || 0)) : highest;
  }, 0);
}

function isExpired(coupon) {
  if (!coupon?.expiresAt) return false;
  const stamp = new Date(coupon.expiresAt).getTime();
  return Number.isFinite(stamp) && stamp < Date.now();
}

function itemMatchesCoupon(item, coupon) {
  const productId = String(item?.productId || '').trim();
  const categoryId = String(item?.categoryId || '').trim().toLowerCase();
  const applicableProducts = Array.isArray(coupon?.applicableProductIds) ? coupon.applicableProductIds : [];
  const applicableCategories = Array.isArray(coupon?.applicableCategoryIds) ? coupon.applicableCategoryIds : [];
  const excludedProducts = Array.isArray(coupon?.excludedProductIds) ? coupon.excludedProductIds : [];

  if (excludedProducts.includes(productId)) return false;
  if (applicableProducts.length && applicableProducts.includes(productId)) return true;
  if (applicableCategories.length && applicableCategories.includes(categoryId)) return true;
  if (!applicableProducts.length && !applicableCategories.length) return true;
  return false;
}

async function validateCouponForCart({ code, items, userId, email, guestId, shippingFee }) {
  const couponCode = normalizeCouponCode(code);
  if (!couponCode) {
    throw new AppError(400, 'Coupon code is required.');
  }

  const coupon = await Coupon.findOne({ code: couponCode }).lean();
  if (!coupon) {
    throw new AppError(404, 'Coupon code not found.');
  }

  if (!coupon.isActive) {
    throw new AppError(409, 'This coupon is currently inactive.');
  }

  if (isExpired(coupon)) {
    throw new AppError(409, 'This coupon has expired.');
  }

  if (coupon.usageLimit != null && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit)) {
    throw new AppError(409, 'This coupon has reached its total usage limit.');
  }

  const perUserUsage = getUsageCount(coupon, { userId, email, guestId });
  if (coupon.perUserLimit != null && perUserUsage >= Number(coupon.perUserLimit)) {
    throw new AppError(409, 'You have already used this coupon the maximum number of times.');
  }

  const safeItems = Array.isArray(items) ? items : [];
  const subtotal = roundCurrency(
    safeItems.reduce((sum, item) => sum + (Number(item?.price || 0) * Number(item?.quantity || 0)), 0)
  );

  if (!safeItems.length) {
    throw new AppError(400, 'Add item(s) to your cart before applying a coupon.');
  }

  if (subtotal < Number(coupon.minimumOrderAmount || 0)) {
    throw new AppError(422, `This coupon requires a minimum order of NGN ${Number(coupon.minimumOrderAmount || 0).toLocaleString()}.`);
  }

  const eligibleItems = safeItems.filter((item) => itemMatchesCoupon(item, coupon));
  const eligibleSubtotal = roundCurrency(
    eligibleItems.reduce((sum, item) => sum + (Number(item?.price || 0) * Number(item?.quantity || 0)), 0)
  );

  if (!eligibleItems.length && !coupon.freeShipping) {
    throw new AppError(422, 'This coupon does not apply to the products currently in your cart.');
  }

  let discount = 0;
  if (coupon.discountType === 'fixed') {
    discount = roundCurrency(Math.min(Number(coupon.discountValue || 0), eligibleSubtotal));
  } else {
    discount = roundCurrency(eligibleSubtotal * (Number(coupon.discountValue || 0) / 100));
    if (coupon.maximumDiscountAmount != null) {
      discount = roundCurrency(Math.min(discount, Number(coupon.maximumDiscountAmount || 0)));
    }
  }

  const adjustedShippingFee = coupon.freeShipping ? 0 : roundCurrency(shippingFee || 0);
  const message = coupon.freeShipping && discount > 0
    ? `Coupon ${couponCode} applied successfully. Discount and free shipping are active.`
    : coupon.freeShipping
      ? `Coupon ${couponCode} applied successfully. Free shipping is active.`
      : `Coupon ${couponCode} applied successfully.`;

  return {
    coupon,
    discount,
    eligibleSubtotal,
    shippingFee: adjustedShippingFee,
    message,
    appliedCoupon: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: roundCurrency(coupon.discountValue || 0),
      minimumOrderAmount: roundCurrency(coupon.minimumOrderAmount || 0),
      maximumDiscountAmount: coupon.maximumDiscountAmount == null
        ? null
        : roundCurrency(coupon.maximumDiscountAmount || 0),
      freeShipping: Boolean(coupon.freeShipping),
      applicableProductIds: Array.isArray(coupon.applicableProductIds) ? coupon.applicableProductIds : [],
      applicableCategoryIds: Array.isArray(coupon.applicableCategoryIds) ? coupon.applicableCategoryIds : [],
      excludedProductIds: Array.isArray(coupon.excludedProductIds) ? coupon.excludedProductIds : []
    }
  };
}

async function recordCouponRedemption({ code, userId, email, guestId }) {
  const couponCode = normalizeCouponCode(code);
  if (!couponCode) return null;

  const coupon = await Coupon.findOne({ code: couponCode });
  if (!coupon) return null;

  const normalizedEmail = normalizeEmail(email);
  const keyCandidates = [
    userId ? { subjectType: 'user', subjectId: String(userId).trim(), email: normalizedEmail } : null,
    normalizedEmail ? { subjectType: 'email', subjectId: normalizedEmail, email: normalizedEmail } : null,
    guestId ? { subjectType: 'guest', subjectId: String(guestId).trim(), email: normalizedEmail } : null
  ].filter(Boolean);

  const usageBySubject = Array.isArray(coupon.usageBySubject) ? [...coupon.usageBySubject] : [];
  const now = new Date();

  keyCandidates.forEach((candidate) => {
    const index = usageBySubject.findIndex((row) => (
      row.subjectType === candidate.subjectType &&
      String(row.subjectId || '').trim() === candidate.subjectId
    ));

    if (index >= 0) {
      usageBySubject[index] = {
        ...(usageBySubject[index].toObject?.() || usageBySubject[index]),
        subjectType: candidate.subjectType,
        subjectId: candidate.subjectId,
        email: candidate.email,
        count: Number(usageBySubject[index].count || 0) + 1,
        lastUsedAt: now
      };
      return;
    }

    usageBySubject.push({
      subjectType: candidate.subjectType,
      subjectId: candidate.subjectId,
      email: candidate.email,
      count: 1,
      lastUsedAt: now
    });
  });

  coupon.usedCount = Number(coupon.usedCount || 0) + 1;
  coupon.usageBySubject = usageBySubject;
  await coupon.save();
  return coupon;
}

module.exports = {
  normalizeCouponCode,
  recordCouponRedemption,
  seedCoupons,
  validateCouponForCart
};
