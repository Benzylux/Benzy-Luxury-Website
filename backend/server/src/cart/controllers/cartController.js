const AppError = require('../utils/appError');
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
} = require('../services/cartService');
const { normalizeCouponCode, validateCouponForCart } = require('../services/couponService');

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function normalizeApplyPayload(req) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  return {
    code: normalizeCouponCode(body.code || body.couponCode),
    guestCart: body.guestCart && typeof body.guestCart === 'object' ? body.guestCart : {
      items: body.items,
      couponCode: body.code || body.couponCode
    },
    guestId: body.guestId
  };
}

const getCart = asyncHandler(async (req, res) => {
  const cart = await getFreshUserCart(req.cartUser);
  res.json({
    success: true,
    cart: serializeUserCart(cart)
  });
});

const syncCart = asyncHandler(async (req, res) => {
  const cart = await syncUserCart(req.cartUser, req.body || {});
  res.json({
    success: true,
    message: 'Cart synced successfully.',
    cart: serializeUserCart(cart)
  });
});

const mergeCart = asyncHandler(async (req, res) => {
  const cart = await mergeGuestCartIntoUserCart(req.cartUser, req.body || {});
  res.json({
    success: true,
    message: cart?.summary?.couponMessage || 'Guest cart merged successfully.',
    cart: serializeUserCart(cart)
  });
});

const addItem = asyncHandler(async (req, res) => {
  const cart = await addItemToUserCart(req.cartUser, req.body || {});
  res.status(201).json({
    success: true,
    message: 'Item added to cart.',
    cart: serializeUserCart(cart)
  });
});

const updateItem = asyncHandler(async (req, res) => {
  const cart = await updateUserCartItem(req.cartUser, req.params.id, req.body?.quantity);
  res.json({
    success: true,
    message: 'Cart item updated.',
    cart: serializeUserCart(cart)
  });
});

const removeItem = asyncHandler(async (req, res) => {
  const cart = await removeUserCartItem(req.cartUser, req.params.id);
  res.json({
    success: true,
    message: 'Item removed from cart.',
    cart: serializeUserCart(cart)
  });
});

const clearCart = asyncHandler(async (req, res) => {
  const cart = await clearUserCart(req.cartUser);
  res.json({
    success: true,
    message: 'Cart cleared.',
    cart: serializeUserCart(cart)
  });
});

const applyCoupon = asyncHandler(async (req, res) => {
  const payload = normalizeApplyPayload(req);
  if (!payload.code) {
    throw new AppError(400, 'Coupon code is required.');
  }

  if (req.cartUser) {
    const cart = await applyCouponToUserCart(req.cartUser, payload.code);
    return res.json({
      success: true,
      message: cart?.summary?.couponMessage || 'Coupon applied successfully.',
      cart: serializeUserCart(cart)
    });
  }

  const guestCart = await previewGuestCart({
    guestCart: {
      items: Array.isArray(payload.guestCart?.items) ? payload.guestCart.items : [],
      couponCode: payload.code
    },
    guestId: payload.guestId,
    couponCode: payload.code
  });

  return res.json({
    success: true,
    message: guestCart?.summary?.couponMessage || 'Coupon applied successfully.',
    cart: serializeGuestCart(guestCart)
  });
});

const removeCoupon = asyncHandler(async (req, res) => {
  const cart = await removeCouponFromUserCart(req.cartUser);
  res.json({
    success: true,
    message: 'Coupon removed from cart.',
    cart: serializeUserCart(cart)
  });
});

const validateCoupon = asyncHandler(async (req, res) => {
  const code = normalizeCouponCode(req.params.code);
  const guestId = String(req.query.guestId || '').trim();

  try {
    const result = await validateCouponForCart({
      code,
      items: [],
      userId: req.cartUser?.id || '',
      email: req.cartUser?.email || '',
      guestId,
      shippingFee: 0
    });

    return res.json({
      success: true,
      valid: true,
      coupon: result.appliedCoupon,
      message: result.message
    });
  } catch (error) {
    if (error.message === 'Add item(s) to your cart before applying a coupon.') {
      return res.json({
        success: true,
        valid: true,
        coupon: {
          code,
          message: 'Coupon exists. Full validation happens when cart items are provided.'
        }
      });
    }

    throw error;
  }
});

const validateCheckout = asyncHandler(async (req, res) => {
  const cart = await validateCheckoutCartForUser(req.cartUser);
  res.json({
    success: true,
    message: cart?.summary?.couponMessage || 'Checkout cart validated successfully.',
    cart: serializeUserCart(cart)
  });
});

function cartErrorHandler(error, req, res, next) {
  if (!(error instanceof AppError)) {
    return next(error);
  }

  return res.status(error.statusCode).json({
    success: false,
    message: error.message,
    details: error.details || null
  });
}

module.exports = {
  addItem,
  applyCoupon,
  cartErrorHandler,
  clearCart,
  getCart,
  mergeCart,
  removeCoupon,
  removeItem,
  syncCart,
  updateItem,
  validateCheckout,
  validateCoupon
};
