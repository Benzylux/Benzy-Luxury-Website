require('../../../loadEnv');

const DEFAULT_USD_TO_NGN_RATE = Number(process.env.BENZY_MANUAL_USD_TO_NGN || 1600);

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundCurrency(value) {
  return Number(toNumber(value).toFixed(2));
}

function ngnToUsd(value) {
  const divisor = toNumber(DEFAULT_USD_TO_NGN_RATE, 1600) || 1600;
  return roundCurrency(toNumber(value) / divisor);
}

function usdToNgn(value) {
  const multiplier = toNumber(DEFAULT_USD_TO_NGN_RATE, 1600) || 1600;
  return roundCurrency(toNumber(value) * multiplier);
}

module.exports = {
  DEFAULT_USD_TO_NGN_RATE,
  ngnToUsd,
  usdToNgn,
  roundCurrency,
  toNumber
};
