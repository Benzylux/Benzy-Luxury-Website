const GUEST_CART_STORAGE_KEY = 'benzy_react_guest_cart';
const DEFAULT_GUEST_SHIPPING_FEE = 3000;

function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function createGuestId() {
  return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function buildLineKey(item) {
  return [
    normalizeText(item?.productId).toLowerCase(),
    normalizeText(item?.variantId).toLowerCase(),
    normalizeText(item?.size).toLowerCase(),
    normalizeText(item?.color).toLowerCase()
  ].join('::');
}

export function normalizeCartItem(item) {
  const quantity = Math.max(1, parseInt(String(item?.quantity || item?.qty || 1), 10));
  return {
    productId: normalizeText(item?.productId || item?.id),
    name: normalizeText(item?.name || item?.title || 'Product'),
    price: Number(item?.price || 0),
    image: normalizeText(item?.image),
    quantity,
    size: normalizeText(item?.size),
    color: normalizeText(item?.color),
    variantId: normalizeText(item?.variantId),
    categoryId: normalizeText(item?.categoryId || item?.category || 'all')
  };
}

function normalizeAppliedCoupon(coupon) {
  if (!coupon || !coupon.code) return null;
  return {
    code: normalizeText(coupon.code).toUpperCase(),
    discountType: normalizeText(coupon.discountType).toLowerCase(),
    discountValue: Number(coupon.discountValue || 0),
    minimumOrderAmount: Number(coupon.minimumOrderAmount || 0),
    maximumDiscountAmount: coupon.maximumDiscountAmount == null ? null : Number(coupon.maximumDiscountAmount || 0),
    freeShipping: Boolean(coupon.freeShipping),
    applicableProductIds: Array.isArray(coupon.applicableProductIds) ? coupon.applicableProductIds : [],
    applicableCategoryIds: Array.isArray(coupon.applicableCategoryIds) ? coupon.applicableCategoryIds : [],
    excludedProductIds: Array.isArray(coupon.excludedProductIds) ? coupon.excludedProductIds : []
  };
}

function itemMatchesCoupon(item, coupon) {
  const productId = normalizeText(item?.productId);
  const categoryId = normalizeText(item?.categoryId).toLowerCase();
  if (coupon.excludedProductIds.includes(productId)) return false;
  if (coupon.applicableProductIds.length && coupon.applicableProductIds.includes(productId)) return true;
  if (coupon.applicableCategoryIds.length && coupon.applicableCategoryIds.includes(categoryId)) return true;
  if (!coupon.applicableProductIds.length && !coupon.applicableCategoryIds.length) return true;
  return false;
}

export function mergeGuestCartItems(currentItems, incomingItems) {
  const merged = new Map();
  [...(Array.isArray(currentItems) ? currentItems : []), ...(Array.isArray(incomingItems) ? incomingItems : [])]
    .map((item) => normalizeCartItem(item))
    .forEach((item) => {
      const lineKey = buildLineKey(item);
      const existing = merged.get(lineKey);
      if (existing) {
        existing.quantity += item.quantity;
        return;
      }
      merged.set(lineKey, item);
    });

  return Array.from(merged.values());
}

export function createGuestCartState(partial = {}) {
  return {
    guestId: normalizeText(partial.guestId) || createGuestId(),
    items: Array.isArray(partial.items) ? partial.items.map((item) => normalizeCartItem(item)) : [],
    couponCode: normalizeText(partial.couponCode || partial.appliedCoupon?.code).toUpperCase(),
    appliedCoupon: normalizeAppliedCoupon(partial.appliedCoupon),
    shippingFee: Number(partial.shippingFee ?? DEFAULT_GUEST_SHIPPING_FEE),
    couponMessage: normalizeText(partial.couponMessage),
    updatedAt: partial.updatedAt || new Date().toISOString()
  };
}

export function readGuestCartState() {
  const stored = safeJsonParse(localStorage.getItem(GUEST_CART_STORAGE_KEY), null);
  return createGuestCartState(stored || {});
}

export function writeGuestCartState(nextState) {
  localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(createGuestCartState(nextState)));
}

export function clearGuestCartState() {
  localStorage.removeItem(GUEST_CART_STORAGE_KEY);
}

export function calculateGuestCartSummary(state) {
  const normalized = createGuestCartState(state);
  const subtotal = normalized.items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
  const coupon = normalizeAppliedCoupon(normalized.appliedCoupon);
  let discount = 0;
  let shippingFee = normalized.items.length ? Number(normalized.shippingFee || DEFAULT_GUEST_SHIPPING_FEE) : 0;

  if (coupon && subtotal >= Number(coupon.minimumOrderAmount || 0)) {
    const eligibleSubtotal = normalized.items
      .filter((item) => itemMatchesCoupon(item, coupon))
      .reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);

    if (coupon.discountType === 'fixed') {
      discount = Math.min(Number(coupon.discountValue || 0), eligibleSubtotal);
    } else if (coupon.discountType === 'percent') {
      discount = eligibleSubtotal * (Number(coupon.discountValue || 0) / 100);
      if (coupon.maximumDiscountAmount != null) {
        discount = Math.min(discount, Number(coupon.maximumDiscountAmount || 0));
      }
    }

    if (coupon.freeShipping) {
      shippingFee = 0;
    }
  }

  return {
    subtotal: Number(subtotal.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    shippingFee: Number(shippingFee.toFixed(2)),
    total: Number(Math.max(0, subtotal - discount + shippingFee).toFixed(2)),
    appliedCoupon: coupon,
    couponMessage: normalizeText(normalized.couponMessage)
  };
}

export function summarizeGuestCart(state) {
  const normalized = createGuestCartState(state);
  return {
    mode: 'guest',
    items: normalized.items,
    summary: calculateGuestCartSummary(normalized),
    requiresLoginAtCheckout: true,
    updatedAt: normalized.updatedAt
  };
}

export function guestPayloadFromState(state) {
  const normalized = createGuestCartState(state);
  return {
    guestId: normalized.guestId,
    guestCart: {
      items: normalized.items,
      couponCode: normalized.couponCode
    }
  };
}

export function writeGuestCartFromServerCart(cart) {
  const nextState = createGuestCartState({
    guestId: readGuestCartState().guestId,
    items: Array.isArray(cart?.items) ? cart.items : [],
    couponCode: cart?.summary?.appliedCoupon?.code || '',
    appliedCoupon: cart?.summary?.appliedCoupon || null,
    shippingFee: Number(cart?.summary?.shippingFee || DEFAULT_GUEST_SHIPPING_FEE),
    couponMessage: cart?.summary?.couponMessage || '',
    updatedAt: cart?.updatedAt
  });
  writeGuestCartState(nextState);
  return summarizeGuestCart(nextState);
}
