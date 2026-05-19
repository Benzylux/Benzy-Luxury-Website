const { getCollection } = require('../../../mongo');
const { roundCurrency } = require('../utils/money');

const DEFAULT_SHIPPING_FEE_NGN = 3000;

async function getShippingFeeNgn() {
  const collection = await getCollection('settings');
  const settings = await collection.findOne({ _id: 'app' }, { projection: { shippingFeeNgn: 1, shipping: 1 } });
  const fee = Number(settings?.shipping?.defaultDomesticFeeNgn ?? settings?.shippingFeeNgn);
  if (!Number.isFinite(fee) || fee < 0) return DEFAULT_SHIPPING_FEE_NGN;
  return roundCurrency(fee);
}

module.exports = {
  DEFAULT_SHIPPING_FEE_NGN,
  getShippingFeeNgn
};
