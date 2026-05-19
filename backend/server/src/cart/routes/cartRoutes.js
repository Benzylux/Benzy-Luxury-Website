const express = require('express');
const {
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
} = require('../controllers/cartController');
const { attachOptionalCartUser, requireCartAuth } = require('../middleware/cartAuth');

function createCartRouter() {
  const router = express.Router();

  router.get('/cart', requireCartAuth, getCart);
  router.post('/cart/sync', requireCartAuth, syncCart);
  router.post('/cart/merge', requireCartAuth, mergeCart);
  router.post('/cart/add', requireCartAuth, addItem);
  router.patch('/cart/item/:id', requireCartAuth, updateItem);
  router.delete('/cart/item/:id', requireCartAuth, removeItem);
  router.delete('/cart/clear', requireCartAuth, clearCart);
  router.post('/cart/apply-coupon', attachOptionalCartUser, applyCoupon);
  router.delete('/cart/remove-coupon', requireCartAuth, removeCoupon);
  router.get('/coupons/:code/validate', attachOptionalCartUser, validateCoupon);
  router.post('/cart/checkout/validate', requireCartAuth, validateCheckout);

  router.use(cartErrorHandler);

  return router;
}

module.exports = createCartRouter;
