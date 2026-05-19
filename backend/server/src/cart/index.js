const createCartRouter = require('./routes/cartRoutes');
const { closeCartDatabase, connectCartDatabase } = require('./config/mongoose');
const { seedCoupons, recordCouponRedemption } = require('./services/couponService');
const { seedProductCatalog } = require('./services/productCatalogService');
const { validateCheckoutCartForUser } = require('./services/cartService');

async function initializeCartSystem() {
  await connectCartDatabase();
  await seedProductCatalog();
  await seedCoupons();
}

module.exports = {
  closeCartSystem: closeCartDatabase,
  createCartRouter,
  initializeCartSystem,
  recordCouponRedemption,
  validateCheckoutCartForUser
};
