const AppError = require('./src/cart/utils/appError');
const {
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
} = require('./src/cart/services/cartService');

function normalizeUser(user) {
  return {
    id: user?.id || user?.userId,
    userId: user?.userId || user?.id,
    email: user?.email
  };
}

function toLegacyCart(serializedCart) {
  return {
    userId: serializedCart?.userId || null,
    email: serializedCart?.email || null,
    items: Array.isArray(serializedCart?.items) ? serializedCart.items : [],
    totals: {
      currency: 'NGN',
      itemCount: Array.isArray(serializedCart?.items) ? serializedCart.items.length : 0,
      quantityCount: Array.isArray(serializedCart?.items)
        ? serializedCart.items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0)
        : 0,
      subtotal: Number(serializedCart?.summary?.subtotal || 0),
      discount: Number(serializedCart?.summary?.discount || 0),
      shippingFee: Number(serializedCart?.summary?.shippingFee || 0),
      total: Number(serializedCart?.summary?.total || 0)
    },
    summary: serializedCart?.summary || {},
    updatedAt: serializedCart?.updatedAt || new Date().toISOString()
  };
}

function wrapError(error) {
  if (error instanceof AppError) {
    const wrapped = new Error(error.message);
    wrapped.status = error.statusCode;
    wrapped.details = error.details;
    return wrapped;
  }
  return error;
}

async function getCartForUser(user) {
  try {
    const cart = await getFreshUserCart(normalizeUser(user));
    return toLegacyCart(serializeUserCart(cart));
  } catch (error) {
    throw wrapError(error);
  }
}

async function addItemToCart(user, payload) {
  try {
    const cart = await addItemToUserCart(normalizeUser(user), payload || {});
    return toLegacyCart(serializeUserCart(cart));
  } catch (error) {
    throw wrapError(error);
  }
}

async function updateCartItem(user, itemId, payload) {
  try {
    const cart = await updateUserCartItem(normalizeUser(user), itemId, payload?.quantity ?? payload?.qty);
    return toLegacyCart(serializeUserCart(cart));
  } catch (error) {
    throw wrapError(error);
  }
}

async function removeCartItem(user, itemId) {
  try {
    const cart = await removeUserCartItem(normalizeUser(user), itemId);
    return toLegacyCart(serializeUserCart(cart));
  } catch (error) {
    throw wrapError(error);
  }
}

async function clearCartForUser(user) {
  try {
    const cart = await clearUserCart(normalizeUser(user));
    return toLegacyCart(serializeUserCart(cart));
  } catch (error) {
    throw wrapError(error);
  }
}

async function syncCartForUser(user, payload) {
  try {
    const cart = await syncUserCart(normalizeUser(user), payload || {});
    return toLegacyCart(serializeUserCart(cart));
  } catch (error) {
    throw wrapError(error);
  }
}

async function mergeCartForUser(user, payload) {
  try {
    const cart = await mergeGuestCartIntoUserCart(normalizeUser(user), payload || {});
    return toLegacyCart(serializeUserCart(cart));
  } catch (error) {
    throw wrapError(error);
  }
}

async function applyCouponForUser(user, code) {
  try {
    const cart = await applyCouponToUserCart(normalizeUser(user), code);
    return toLegacyCart(serializeUserCart(cart));
  } catch (error) {
    throw wrapError(error);
  }
}

async function removeCouponForUser(user) {
  try {
    const cart = await removeCouponFromUserCart(normalizeUser(user));
    return toLegacyCart(serializeUserCart(cart));
  } catch (error) {
    throw wrapError(error);
  }
}

async function previewGuestCartState(payload) {
  try {
    const cart = await previewGuestCart(payload || {});
    return serializeGuestCart(cart);
  } catch (error) {
    throw wrapError(error);
  }
}

async function validateCheckoutCart(user) {
  try {
    const cart = await validateCheckoutCartForUser(normalizeUser(user));
    return serializeUserCart(cart);
  } catch (error) {
    throw wrapError(error);
  }
}

module.exports = {
  addItemToCart,
  applyCouponForUser,
  clearCartForUser,
  getCartForUser,
  mergeCartForUser,
  previewGuestCartState,
  removeCartItem,
  removeCouponForUser,
  syncCartForUser,
  updateCartItem,
  validateCheckoutCart
};
