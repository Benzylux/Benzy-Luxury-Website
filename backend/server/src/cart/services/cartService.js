const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const AppError = require('../utils/appError');
const { roundCurrency } = require('../utils/money');
const { serializeCart } = require('../utils/cartSerializer');
const { hydrateAndMergeCartItems } = require('./productCatalogService');
const { getShippingFeeNgn } = require('./shippingSettingsService');
const { normalizeCouponCode, validateCouponForCart } = require('./couponService');

function toPlainItems(items) {
  return Array.isArray(items)
    ? items.map((item) => (typeof item?.toObject === 'function' ? item.toObject() : { ...item }))
    : [];
}

function emptySummary(message = '') {
  return {
    subtotal: 0,
    discount: 0,
    shippingFee: 0,
    total: 0,
    appliedCoupon: null,
    couponMessage: String(message || '').trim()
  };
}

function normalizeUser(user) {
  const userId = String(user?.id || user?.userId || '').trim();
  const email = String(user?.email || '').trim().toLowerCase();
  if (!userId || !email) {
    throw new AppError(401, 'An authenticated user is required for this action.');
  }
  return { userId, email };
}

function normalizeSubdocumentId(value) {
  if (value && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(String(value));
  }
  return new mongoose.Types.ObjectId();
}

function hasValidObjectId(value) {
  if (!value) return false;
  if (value instanceof mongoose.Types.ObjectId) return true;
  return mongoose.Types.ObjectId.isValid(String(value));
}

async function migrateLegacyCartDocument(cart, normalizedUser) {
  const legacyCart = typeof cart?.toObject === 'function' ? cart.toObject() : { ...cart };
  const nextState = await calculateCartState({
    items: Array.isArray(legacyCart?.items) ? legacyCart.items : [],
    couponCode: legacyCart?.couponCode,
    userId: normalizedUser.userId,
    email: normalizedUser.email
  }, {
    strictCoupon: false
  });

  await Cart.collection.deleteOne({ userId: normalizedUser.userId });

  const recreatedCart = await Cart.create({
    userId: normalizedUser.userId,
    email: normalizedUser.email,
    items: [],
    couponCode: null,
    summary: emptySummary(),
    lastValidatedAt: legacyCart?.lastValidatedAt ? new Date(legacyCart.lastValidatedAt) : new Date()
  });

  return persistCalculatedCart(recreatedCart, nextState);
}

async function calculateCartState({ items, couponCode, userId, email, guestId }, options = {}) {
  const mergedItems = await hydrateAndMergeCartItems(items);
  const subtotal = roundCurrency(
    mergedItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0)
  );

  if (!mergedItems.length) {
    return {
      items: [],
      couponCode: null,
      summary: emptySummary()
    };
  }

  const baseShippingFee = await getShippingFeeNgn();
  let summary = emptySummary();
  summary.subtotal = subtotal;
  summary.shippingFee = baseShippingFee;
  summary.total = roundCurrency(subtotal + baseShippingFee);

  const normalizedCode = normalizeCouponCode(couponCode);
  if (!normalizedCode) {
    return {
      items: mergedItems,
      couponCode: null,
      summary
    };
  }

  try {
    const couponResult = await validateCouponForCart({
      code: normalizedCode,
      items: mergedItems,
      userId,
      email,
      guestId,
      shippingFee: baseShippingFee
    });

    summary = {
      subtotal,
      discount: roundCurrency(couponResult.discount || 0),
      shippingFee: roundCurrency(couponResult.shippingFee || 0),
      total: roundCurrency(Math.max(0, subtotal - Number(couponResult.discount || 0) + Number(couponResult.shippingFee || 0))),
      appliedCoupon: couponResult.appliedCoupon,
      couponMessage: couponResult.message
    };

    return {
      items: mergedItems,
      couponCode: normalizedCode,
      summary
    };
  } catch (error) {
    if (options.strictCoupon) {
      throw error;
    }

    return {
      items: mergedItems,
      couponCode: null,
      summary: {
        ...summary,
        couponMessage: error.message
      }
    };
  }
}

async function getOrCreateUserCart(user) {
  const normalizedUser = normalizeUser(user);
  let cart = await Cart.findOne({ userId: normalizedUser.userId });

  if (!cart) {
    cart = await Cart.create({
      userId: normalizedUser.userId,
      email: normalizedUser.email,
      items: [],
      couponCode: null,
      summary: emptySummary(),
      lastValidatedAt: new Date()
    });
  } else if (!hasValidObjectId(cart._id)) {
    cart = await migrateLegacyCartDocument(cart, normalizedUser);
  } else if (cart.email !== normalizedUser.email) {
    cart.email = normalizedUser.email;
    await cart.save();
  }

  return cart;
}

async function persistCalculatedCart(cart, nextState) {
  cart.email = String(cart.email || '').trim().toLowerCase();
  cart.items = (Array.isArray(nextState.items) ? nextState.items : []).map((item) => ({
    _id: normalizeSubdocumentId(item._id),
    lineKey: item.lineKey,
    productId: item.productId,
    name: item.name,
    price: roundCurrency(item.price || 0),
    image: item.image || '',
    quantity: Math.max(1, parseInt(String(item.quantity || 1), 10)),
    size: item.size || '',
    color: item.color || '',
    variantId: item.variantId || '',
    categoryId: item.categoryId || 'all'
  }));
  cart.couponCode = nextState.couponCode || null;
  cart.summary = nextState.summary || emptySummary();
  cart.lastValidatedAt = new Date();
  await cart.save();
  return cart;
}

async function getFreshUserCart(user) {
  const cart = await getOrCreateUserCart(user);
  const normalizedUser = normalizeUser(user);
  const nextState = await calculateCartState({
    items: toPlainItems(cart.items),
    couponCode: cart.couponCode,
    userId: normalizedUser.userId,
    email: normalizedUser.email
  }, {
    strictCoupon: false
  });

  return persistCalculatedCart(cart, nextState);
}

async function syncUserCart(user, payload = {}) {
  const cart = await getOrCreateUserCart(user);
  const normalizedUser = normalizeUser(user);
  const nextState = await calculateCartState({
    items: Array.isArray(payload.items) ? payload.items : [],
    couponCode: payload.couponCode,
    userId: normalizedUser.userId,
    email: normalizedUser.email,
    guestId: payload.guestId
  }, {
    strictCoupon: false
  });

  return persistCalculatedCart(cart, nextState);
}

async function mergeGuestCartIntoUserCart(user, payload = {}) {
  const cart = await getOrCreateUserCart(user);
  const normalizedUser = normalizeUser(user);
  const guestCart = payload?.guestCart && typeof payload.guestCart === 'object' ? payload.guestCart : payload;
  const guestItems = Array.isArray(guestCart?.items) ? guestCart.items : [];
  const guestCouponCode = guestCart?.couponCode || payload?.couponCode;

  const mergedItems = [...toPlainItems(cart.items), ...guestItems];
  const nextState = await calculateCartState({
    items: mergedItems,
    couponCode: guestCouponCode || cart.couponCode,
    userId: normalizedUser.userId,
    email: normalizedUser.email,
    guestId: payload?.guestId
  }, {
    strictCoupon: false
  });

  return persistCalculatedCart(cart, nextState);
}

async function addItemToUserCart(user, item) {
  const cart = await getOrCreateUserCart(user);
  const normalizedUser = normalizeUser(user);
  const nextItems = [...toPlainItems(cart.items), item];
  const nextState = await calculateCartState({
    items: nextItems,
    couponCode: cart.couponCode,
    userId: normalizedUser.userId,
    email: normalizedUser.email
  }, {
    strictCoupon: false
  });

  return persistCalculatedCart(cart, nextState);
}

async function updateUserCartItem(user, itemId, quantity) {
  const cart = await getOrCreateUserCart(user);
  const normalizedUser = normalizeUser(user);
  const safeItemId = String(itemId || '').trim();
  const safeQuantity = Math.max(1, parseInt(String(quantity || 1), 10));
  const currentItems = toPlainItems(cart.items);
  const target = currentItems.find((item) => String(item?._id || '') === safeItemId);

  if (!target) {
    throw new AppError(404, 'Cart item not found.');
  }

  const nextItems = currentItems.map((item) => (
    String(item?._id || '') === safeItemId
      ? { ...item, quantity: safeQuantity }
      : item
  ));

  const nextState = await calculateCartState({
    items: nextItems,
    couponCode: cart.couponCode,
    userId: normalizedUser.userId,
    email: normalizedUser.email
  }, {
    strictCoupon: false
  });

  return persistCalculatedCart(cart, nextState);
}

async function removeUserCartItem(user, itemId) {
  const cart = await getOrCreateUserCart(user);
  const safeItemId = String(itemId || '').trim();
  const nextItems = toPlainItems(cart.items).filter((item) => String(item?._id || '') !== safeItemId);

  if (nextItems.length === cart.items.length) {
    throw new AppError(404, 'Cart item not found.');
  }

  const normalizedUser = normalizeUser(user);
  const nextState = await calculateCartState({
    items: nextItems,
    couponCode: cart.couponCode,
    userId: normalizedUser.userId,
    email: normalizedUser.email
  }, {
    strictCoupon: false
  });

  return persistCalculatedCart(cart, nextState);
}

async function clearUserCart(user) {
  const cart = await getOrCreateUserCart(user);
  cart.items = [];
  cart.couponCode = null;
  cart.summary = emptySummary();
  cart.lastValidatedAt = new Date();
  await cart.save();
  return cart;
}

async function applyCouponToUserCart(user, code) {
  const cart = await getOrCreateUserCart(user);
  const normalizedUser = normalizeUser(user);
  const nextState = await calculateCartState({
    items: toPlainItems(cart.items),
    couponCode: code,
    userId: normalizedUser.userId,
    email: normalizedUser.email
  }, {
    strictCoupon: true
  });

  return persistCalculatedCart(cart, nextState);
}

async function removeCouponFromUserCart(user) {
  const cart = await getOrCreateUserCart(user);
  const normalizedUser = normalizeUser(user);
  const nextState = await calculateCartState({
    items: toPlainItems(cart.items),
    couponCode: null,
    userId: normalizedUser.userId,
    email: normalizedUser.email
  }, {
    strictCoupon: false
  });

  return persistCalculatedCart(cart, nextState);
}

async function previewGuestCart(payload = {}) {
  const guestCart = payload?.guestCart && typeof payload.guestCart === 'object' ? payload.guestCart : payload;
  const nextState = await calculateCartState({
    items: Array.isArray(guestCart?.items) ? guestCart.items : [],
    couponCode: guestCart?.couponCode || payload?.couponCode,
    guestId: payload?.guestId
  }, {
    strictCoupon: Boolean(payload?.couponCode || guestCart?.couponCode)
  });

  return {
    _id: null,
    userId: null,
    email: null,
    items: nextState.items,
    summary: nextState.summary,
    updatedAt: new Date().toISOString()
  };
}

async function validateCheckoutCartForUser(user) {
  const cart = await getFreshUserCart(user);
  if (!Array.isArray(cart.items) || !cart.items.length) {
    throw new AppError(400, 'Your cart is empty.');
  }

  return cart;
}

function serializeUserCart(cart) {
  return serializeCart(cart, { mode: 'authenticated' });
}

function serializeGuestCart(cart) {
  return serializeCart(cart, { mode: 'guest' });
}

module.exports = {
  addItemToUserCart,
  applyCouponToUserCart,
  clearUserCart,
  getFreshUserCart,
  mergeGuestCartIntoUserCart,
  previewGuestCart,
  removeCouponFromUserCart,
  removeUserCartItem,
  serializeGuestCart,
  serializeUserCart,
  syncUserCart,
  updateUserCartItem,
  validateCheckoutCartForUser
};
