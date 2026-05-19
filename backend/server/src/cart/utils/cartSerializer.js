const { ngnToUsd, roundCurrency } = require('./money');

function serializeCartItem(item) {
  const quantity = Math.max(1, parseInt(String(item?.quantity || 1), 10));
  const price = roundCurrency(item?.price || 0);
  const name = String(item?.name || '').trim();

  return {
    id: String(item?._id || item?.id || item?.lineKey || ''),
    lineKey: String(item?.lineKey || '').trim(),
    productId: String(item?.productId || '').trim(),
    name,
    title: name,
    price,
    priceNgn: price,
    priceUsd: ngnToUsd(price),
    image: String(item?.image || '').trim(),
    quantity,
    qty: quantity,
    size: String(item?.size || '').trim(),
    color: String(item?.color || '').trim(),
    variantId: String(item?.variantId || '').trim(),
    categoryId: String(item?.categoryId || '').trim()
  };
}

function serializeCart(cart, options = {}) {
  const summary = cart?.summary || {};
  const appliedCoupon = summary?.appliedCoupon
    ? {
        code: String(summary.appliedCoupon.code || '').trim().toUpperCase(),
        discountType: String(summary.appliedCoupon.discountType || '').trim().toLowerCase(),
        discountValue: roundCurrency(summary.appliedCoupon.discountValue || 0),
        freeShipping: Boolean(summary.appliedCoupon.freeShipping),
        minimumOrderAmount: roundCurrency(summary.appliedCoupon.minimumOrderAmount || 0),
        maximumDiscountAmount: summary.appliedCoupon.maximumDiscountAmount == null
          ? null
          : roundCurrency(summary.appliedCoupon.maximumDiscountAmount || 0),
        applicableProductIds: Array.isArray(summary.appliedCoupon.applicableProductIds)
          ? summary.appliedCoupon.applicableProductIds
          : [],
        applicableCategoryIds: Array.isArray(summary.appliedCoupon.applicableCategoryIds)
          ? summary.appliedCoupon.applicableCategoryIds
          : [],
        excludedProductIds: Array.isArray(summary.appliedCoupon.excludedProductIds)
          ? summary.appliedCoupon.excludedProductIds
          : []
      }
    : null;

  return {
    id: String(cart?._id || ''),
    mode: options.mode === 'guest' ? 'guest' : 'authenticated',
    userId: String(cart?.userId || '').trim() || null,
    email: String(cart?.email || '').trim() || null,
    items: Array.isArray(cart?.items) ? cart.items.map((item) => serializeCartItem(item)) : [],
    summary: {
      subtotal: roundCurrency(summary?.subtotal || 0),
      discount: roundCurrency(summary?.discount || 0),
      shippingFee: roundCurrency(summary?.shippingFee || 0),
      total: roundCurrency(summary?.total || 0),
      appliedCoupon,
      couponMessage: String(summary?.couponMessage || '').trim()
    },
    requiresLoginAtCheckout: options.mode === 'guest',
    updatedAt: cart?.updatedAt || new Date().toISOString()
  };
}

module.exports = {
  serializeCart,
  serializeCartItem
};
