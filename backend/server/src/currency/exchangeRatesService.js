const fs = require('fs');
const path = require('path');
const https = require('https');
const { roundCurrency, toNumber } = require('../cart/utils/money');

const DEFAULT_DISPLAY_CURRENCIES = Object.freeze(['NGN', 'USD']);
const DEFAULT_CHECKOUT_CURRENCIES = Object.freeze(['NGN']);
const DEFAULT_PAYSTACK_SUPPORTED_CURRENCIES = Object.freeze(['NGN']);
const CACHE_TTL_HOURS = Math.min(24, Math.max(1, parseInt(String(process.env.BENZY_EXCHANGE_RATE_CACHE_HOURS || '6'), 10) || 6));
const CACHE_TTL_MS = CACHE_TTL_HOURS * 60 * 60 * 1000;
const CACHE_FILE = path.join(__dirname, '..', '..', 'exchange-rates-cache.json');
const FRANKFURTER_OPTIONS = Object.freeze({
  hostname: 'api.frankfurter.dev',
  path: '/v1/latest?base=NGN&symbols=USD',
  method: 'GET',
  headers: {
    Accept: 'application/json'
  }
});
const DEFAULT_RATES = Object.freeze({
  NGN: 1,
  USD: 1 / 1376.86
});
const CURRENCY_SUBUNIT_FACTORS = Object.freeze({
  NGN: 100,
  USD: 100
});

let memoryCache = null;
let inFlightPromise = null;

function normalizeCurrencyList(list, fallbackList = DEFAULT_DISPLAY_CURRENCIES) {
  const source = Array.isArray(list) ? list : fallbackList;
  const normalized = source
    .map((entry) => String(entry || '').trim().toUpperCase())
    .filter((entry) => DEFAULT_DISPLAY_CURRENCIES.includes(entry));
  const unique = Array.from(new Set(normalized.length ? normalized : fallbackList));
  if (!unique.includes('NGN')) {
    unique.unshift('NGN');
  }
  return unique;
}

function getSupportedDisplayCurrencies() {
  const raw = String(process.env.SUPPORTED_DISPLAY_CURRENCIES || '').trim();
  const values = raw
    ? raw.split(',').map((entry) => entry.trim()).filter(Boolean)
    : DEFAULT_DISPLAY_CURRENCIES;
  return normalizeCurrencyList(values, DEFAULT_DISPLAY_CURRENCIES);
}

function getSupportedCheckoutCurrencies() {
  const raw = String(process.env.SUPPORTED_CHECKOUT_CURRENCIES || '').trim();
  const values = raw
    ? raw.split(',').map((entry) => entry.trim()).filter(Boolean)
    : DEFAULT_CHECKOUT_CURRENCIES;
  const supportedDisplay = getSupportedDisplayCurrencies();
  const normalized = normalizeCurrencyList(values, DEFAULT_CHECKOUT_CURRENCIES)
    .filter((currency) => supportedDisplay.includes(currency));
  return normalized.length ? normalized : ['NGN'];
}

const SUPPORTED_CURRENCIES = Object.freeze(getSupportedDisplayCurrencies());

function normalizeCurrencyCode(value, fallback = 'NGN', allowedCurrencies = SUPPORTED_CURRENCIES) {
  const allowed = Array.isArray(allowedCurrencies) && allowedCurrencies.length
    ? allowedCurrencies.map((entry) => String(entry || '').trim().toUpperCase())
    : SUPPORTED_CURRENCIES;
  const normalized = String(value || '').trim().toUpperCase();
  if (allowed.includes(normalized)) return normalized;

  const fallbackCode = String(fallback || '').trim().toUpperCase();
  return allowed.includes(fallbackCode) ? fallbackCode : '';
}

function getDefaultCheckoutCurrency() {
  return normalizeCurrencyCode(getSupportedCheckoutCurrencies()[0] || 'NGN', 'NGN', getSupportedCheckoutCurrencies()) || 'NGN';
}

function getPaystackSupportedCurrencies() {
  const raw = String(process.env.PAYSTACK_SUPPORTED_CURRENCIES || '').trim();
  const values = raw
    ? raw.split(',').map((entry) => entry.trim()).filter(Boolean)
    : getSupportedCheckoutCurrencies();
  const normalized = normalizeCurrencyList(values, DEFAULT_PAYSTACK_SUPPORTED_CURRENCIES)
    .filter((currency) => getSupportedCheckoutCurrencies().includes(currency));
  return normalized.length ? normalized : ['NGN'];
}

function isCheckoutCurrencyAllowed(currency) {
  return getSupportedCheckoutCurrencies().includes(normalizeCurrencyCode(currency, '', getSupportedCheckoutCurrencies()));
}

function isPaystackCurrencySupported(currency) {
  return getPaystackSupportedCurrencies().includes(normalizeCurrencyCode(currency, '', getPaystackSupportedCurrencies()));
}

function resolveCheckoutCurrency(requestedCurrency, fallbackCurrency = '') {
  const supportedCheckoutCurrencies = getSupportedCheckoutCurrencies();
  const requested = normalizeCurrencyCode(requestedCurrency, '', supportedCheckoutCurrencies);
  if (requested) return requested;
  return normalizeCurrencyCode(fallbackCurrency, getDefaultCheckoutCurrency(), supportedCheckoutCurrencies) || getDefaultCheckoutCurrency();
}

function getCurrencyConfigSnapshot() {
  const supportedDisplayCurrencies = getSupportedDisplayCurrencies();
  const supportedCheckoutCurrencies = getSupportedCheckoutCurrencies();
  const defaultCheckoutCurrency = getDefaultCheckoutCurrency();

  return {
    supportedCurrencies: [...supportedDisplayCurrencies],
    supportedDisplayCurrencies: [...supportedDisplayCurrencies],
    supportedCheckoutCurrencies: [...supportedCheckoutCurrencies],
    defaultCheckoutCurrency,
    paystackSupportedCurrencies: getPaystackSupportedCurrencies()
  };
}

function buildCheckoutCurrencyMessage(displayCurrency, chargeCurrency) {
  return `This payment currency is not available for checkout yet. You can still browse prices in ${displayCurrency}, but payment will be completed in ${chargeCurrency}.`;
}

function resolveCheckoutCurrencySelection(options = {}) {
  const paymentMethodCode = String(options.paymentMethodCode || options.paymentMethod || '').trim().toLowerCase();
  const currencyConfig = getCurrencyConfigSnapshot();
  const displayCurrency = normalizeCurrencyCode(
    options.displayCurrency
      || options.selectedDisplayCurrency
      || options.requestedDisplayCurrency
      || options.currency
      || currencyConfig.defaultCheckoutCurrency,
    currencyConfig.defaultCheckoutCurrency,
    currencyConfig.supportedDisplayCurrencies
  ) || 'NGN';
  const requestedValue = options.checkoutCurrency
    || options.settlementCurrency
    || options.requestedCheckoutCurrency
    || options.currency
    || displayCurrency;
  const requestedCheckoutCurrency = normalizeCurrencyCode(
    requestedValue,
    '',
    currencyConfig.supportedCheckoutCurrencies
  );
  const fallbackChargeCurrency = normalizeCurrencyCode(
    options.fallbackCurrency || options.detectedCheckoutCurrency || currencyConfig.defaultCheckoutCurrency,
    currencyConfig.defaultCheckoutCurrency,
    currencyConfig.supportedCheckoutCurrencies
  ) || currencyConfig.defaultCheckoutCurrency;

  let chargeCurrency = requestedCheckoutCurrency || fallbackChargeCurrency;
  let chargeCurrencyForced = chargeCurrency !== (requestedCheckoutCurrency || displayCurrency);
  let chargeCurrencyMessage = chargeCurrencyForced
    ? buildCheckoutCurrencyMessage(displayCurrency, chargeCurrency)
    : '';

  if ((paymentMethodCode === 'card' || paymentMethodCode === 'paystack')
    && !isPaystackCurrencySupported(chargeCurrency)) {
    const paystackFallbackCurrency = normalizeCurrencyCode(
      fallbackChargeCurrency,
      '',
      currencyConfig.paystackSupportedCurrencies
    ) || currencyConfig.paystackSupportedCurrencies[0] || '';

    if (!paystackFallbackCurrency) {
      throw new Error(
        `Paystack checkout is currently available only in ${currencyConfig.paystackSupportedCurrencies.join(', ')}.`
      );
    }

    if (chargeCurrency !== paystackFallbackCurrency) {
      chargeCurrency = paystackFallbackCurrency;
      chargeCurrencyForced = chargeCurrency !== (requestedCheckoutCurrency || displayCurrency);
      chargeCurrencyMessage = chargeCurrencyForced
        ? buildCheckoutCurrencyMessage(displayCurrency, chargeCurrency)
        : '';
    }
  }

  return {
    ...currencyConfig,
    displayCurrency,
    requestedCheckoutCurrency: requestedCheckoutCurrency || displayCurrency,
    chargeCurrency,
    chargeCurrencyForced,
    chargeCurrencyMessage
  };
}

function normalizeRates(source) {
  const safeSource = source && typeof source === 'object' ? source : {};
  const nextRates = {
    NGN: 1,
    USD: DEFAULT_RATES.USD
  };

  ['USD'].forEach((code) => {
    const parsed = Number(safeSource[code]);
    if (Number.isFinite(parsed) && parsed > 0) {
      nextRates[code] = parsed;
    }
  });

  return nextRates;
}

function buildState(source) {
  const safeSource = source && typeof source === 'object' ? source : {};
  const currencyConfig = getCurrencyConfigSnapshot();
  const defaultCheckoutCurrency = normalizeCurrencyCode(
    safeSource.defaultCheckoutCurrency,
    currencyConfig.defaultCheckoutCurrency,
    currencyConfig.supportedCheckoutCurrencies
  ) || currencyConfig.defaultCheckoutCurrency;

  return {
    base: 'NGN',
    rates: normalizeRates(safeSource.rates || safeSource),
    fetchedAt: String(safeSource.fetchedAt || '').trim(),
    source: String(safeSource.source || 'fallback').trim() || 'fallback',
    supportedCurrencies: [...currencyConfig.supportedCurrencies],
    supportedDisplayCurrencies: [...currencyConfig.supportedDisplayCurrencies],
    supportedCheckoutCurrencies: [...currencyConfig.supportedCheckoutCurrencies],
    defaultCheckoutCurrency,
    paystackSupportedCurrencies: [...currencyConfig.paystackSupportedCurrencies]
  };
}

function isFresh(state) {
  const timestamp = Date.parse(String(state?.fetchedAt || ''));
  if (!Number.isFinite(timestamp)) return false;
  return (Date.now() - timestamp) < CACHE_TTL_MS;
}

function readCacheFile() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    return buildState(parsed);
  } catch {
    return null;
  }
}

function writeCacheFile(state) {
  try {
    const safeState = buildState(state);
    fs.writeFileSync(CACHE_FILE, JSON.stringify({
      base: safeState.base,
      rates: safeState.rates,
      fetchedAt: safeState.fetchedAt,
      source: safeState.source
    }, null, 2));
  } catch {
    // Keep the in-memory snapshot even if the file write fails.
  }
}

function sendHttpsJsonRequest(options) {
  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      let responseBody = '';
      response.on('data', (chunk) => {
        responseBody += chunk;
      });
      response.on('end', () => {
        try {
          const parsed = responseBody ? JSON.parse(responseBody) : {};
          resolve({
            statusCode: response.statusCode || 500,
            data: parsed
          });
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
    request.end();
  });
}

async function fetchFrankfurterRates() {
  const response = await sendHttpsJsonRequest(FRANKFURTER_OPTIONS);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error('Frankfurter exchange rate request failed.');
  }

  const rates = response.data?.rates;
  if (!rates || typeof rates !== 'object') {
    throw new Error('Frankfurter exchange rate payload was missing rates.');
  }

  return buildState({
    rates: {
      NGN: 1,
      USD: rates.USD
    },
    fetchedAt: new Date().toISOString(),
    source: 'frankfurter'
  });
}

async function getRates(options = {}) {
  const forceRefresh = Boolean(options.forceRefresh);

  if (!forceRefresh && memoryCache && isFresh(memoryCache)) {
    return memoryCache;
  }

  const diskCache = readCacheFile();
  if (!forceRefresh && diskCache && isFresh(diskCache)) {
    memoryCache = diskCache;
    return memoryCache;
  }

  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const freshRates = await fetchFrankfurterRates();
      memoryCache = freshRates;
      writeCacheFile(freshRates);
      return memoryCache;
    } catch (error) {
      if (diskCache) {
        memoryCache = buildState({
          ...diskCache,
          source: diskCache.source === 'frankfurter' ? 'cache' : diskCache.source
        });
        return memoryCache;
      }

      memoryCache = buildState({
        rates: DEFAULT_RATES,
        fetchedAt: '',
        source: 'fallback'
      });
      return memoryCache;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

async function getExchangeRates(options = {}) {
  return getRates(options);
}

function convertFromNgn(amount, targetCurrency, state) {
  const code = normalizeCurrencyCode(targetCurrency, 'NGN', getSupportedDisplayCurrencies());
  const rates = normalizeRates((state && state.rates) || state || DEFAULT_RATES);
  if (code === 'NGN') return roundCurrency(amount);
  return roundCurrency(toNumber(amount) * toNumber(rates[code], 0));
}

function convertFromNGN(amount, targetCurrency, state) {
  return convertFromNgn(amount, targetCurrency, state);
}

function convertToNgn(amount, sourceCurrency, state) {
  const code = normalizeCurrencyCode(sourceCurrency, 'NGN', getSupportedDisplayCurrencies());
  const rates = normalizeRates((state && state.rates) || state || DEFAULT_RATES);
  if (code === 'NGN') return roundCurrency(amount);

  const rate = toNumber(rates[code], 0);
  if (!rate) return roundCurrency(amount);
  return roundCurrency(toNumber(amount) / rate);
}

function convertBetweenCurrencies(amount, sourceCurrency, targetCurrency, state) {
  const sourceCode = normalizeCurrencyCode(sourceCurrency, 'NGN', getSupportedDisplayCurrencies());
  const targetCode = normalizeCurrencyCode(targetCurrency, 'NGN', getSupportedDisplayCurrencies());
  if (sourceCode === targetCode) return roundCurrency(amount);

  const amountInNgn = convertToNgn(amount, sourceCode, state);
  return convertFromNgn(amountInNgn, targetCode, state);
}

function toSubunit(amountMajor, currency) {
  const code = normalizeCurrencyCode(currency, 'NGN', getSupportedDisplayCurrencies()) || 'NGN';
  const rounded = roundCurrency(amountMajor || 0);
  const multiplier = Number(CURRENCY_SUBUNIT_FACTORS[code] || 100);
  return Math.round(rounded * multiplier);
}

function fromSubunit(amountSubunit, currency) {
  const code = normalizeCurrencyCode(currency, 'NGN', getSupportedDisplayCurrencies()) || 'NGN';
  const divisor = Number(CURRENCY_SUBUNIT_FACTORS[code] || 100);
  return roundCurrency(toNumber(amountSubunit, 0) / divisor);
}

function getChargeSummaryForCurrency(convertedTotals, chargeCurrency) {
  const safeTotals = convertedTotals && typeof convertedTotals === 'object' ? convertedTotals : {};
  const normalizedChargeCurrency = normalizeCurrencyCode(chargeCurrency, 'NGN', getSupportedDisplayCurrencies()) || 'NGN';
  const byCurrency = safeTotals.byCurrency && typeof safeTotals.byCurrency === 'object'
    ? safeTotals.byCurrency
    : {};

  return byCurrency[normalizedChargeCurrency] || byCurrency.NGN || {
    subtotal: roundCurrency(safeTotals.subtotalNgn || 0),
    discount: roundCurrency(safeTotals.discountNgn || 0),
    discountedSubtotal: roundCurrency(safeTotals.discountedSubtotalNgn || 0),
    tax: roundCurrency(safeTotals.taxNgn || 0),
    shipping: roundCurrency(safeTotals.shippingNgn || 0),
    total: roundCurrency(safeTotals.totalNgn || 0)
  };
}

function buildCheckoutPricingFromNgn(amounts, options = {}) {
  const exchangeRates = buildState(options.exchangeRates || options.state);
  const currencySelection = resolveCheckoutCurrencySelection(options);
  const convertedTotals = mapAmountsFromNgn(amounts, exchangeRates);
  const chargeSummary = getChargeSummaryForCurrency(convertedTotals, currencySelection.chargeCurrency);
  const chargeSubtotal = roundCurrency(chargeSummary.subtotal || 0);
  const chargeDiscount = roundCurrency(chargeSummary.discount || 0);
  const chargeDiscountedSubtotal = roundCurrency(chargeSummary.discountedSubtotal || 0);
  const chargeTax = roundCurrency(chargeSummary.tax || 0);
  const chargeShipping = roundCurrency(chargeSummary.shipping || 0);
  const chargeTotal = roundCurrency(chargeSummary.total || 0);

  return {
    ...currencySelection,
    convertedTotals,
    chargeSummary,
    chargeSubtotal,
    chargeDiscount,
    chargeDiscountedSubtotal,
    chargeTax,
    chargeShipping,
    chargeTotal,
    chargeTotalSubunit: toSubunit(chargeTotal, currencySelection.chargeCurrency)
  };
}

function buildPaystackVerificationResult(options = {}) {
  const expectedCurrency = normalizeCurrencyCode(
    options.expectedCurrency,
    'NGN',
    getSupportedDisplayCurrencies()
  ) || 'NGN';
  const verifiedCurrency = normalizeCurrencyCode(
    options.verifiedCurrency,
    expectedCurrency,
    getSupportedDisplayCurrencies()
  ) || expectedCurrency;
  const expectedAmountSubunit = toSubunit(options.expectedAmountMajor || 0, expectedCurrency);
  const verifiedAmountSubunit = Math.max(0, Math.round(toNumber(options.verifiedAmountSubunit, 0)));
  const overageSubunit = Math.max(0, verifiedAmountSubunit - expectedAmountSubunit);
  const shortfallSubunit = Math.max(0, expectedAmountSubunit - verifiedAmountSubunit);

  return {
    expectedCurrency,
    verifiedCurrency,
    expectedAmountMajor: fromSubunit(expectedAmountSubunit, expectedCurrency),
    verifiedAmountMajor: fromSubunit(verifiedAmountSubunit, verifiedCurrency),
    expectedAmountSubunit,
    verifiedAmountSubunit,
    overageSubunit,
    overageMajor: fromSubunit(overageSubunit, verifiedCurrency),
    shortfallSubunit,
    shortfallMajor: fromSubunit(shortfallSubunit, verifiedCurrency),
    matchesCurrency: verifiedCurrency === expectedCurrency,
    matchesAmount: verifiedAmountSubunit >= expectedAmountSubunit
  };
}

function mapAmountsFromNgn(amounts, state) {
  const safeAmounts = amounts && typeof amounts === 'object' ? amounts : {};
  const exchangeRates = buildState(state);
  const currencyConfig = getCurrencyConfigSnapshot();
  const fields = {
    subtotal: roundCurrency(safeAmounts.subtotalNgn || 0),
    discount: roundCurrency(safeAmounts.discountNgn || 0),
    discountedSubtotal: roundCurrency(
      safeAmounts.discountedSubtotalNgn || Math.max(0, Number(safeAmounts.subtotalNgn || 0) - Number(safeAmounts.discountNgn || 0))
    ),
    tax: roundCurrency(safeAmounts.taxNgn || 0),
    shipping: roundCurrency(safeAmounts.shippingNgn || 0),
    total: roundCurrency(
      safeAmounts.totalNgn
      || (
        Number(safeAmounts.discountedSubtotalNgn || Math.max(0, Number(safeAmounts.subtotalNgn || 0) - Number(safeAmounts.discountNgn || 0)))
        + Number(safeAmounts.taxNgn || 0)
        + Number(safeAmounts.shippingNgn || 0)
      )
    )
  };

  const byCurrency = {};
  getSupportedDisplayCurrencies().forEach((currency) => {
    byCurrency[currency] = {
      subtotal: convertFromNgn(fields.subtotal, currency, exchangeRates),
      discount: convertFromNgn(fields.discount, currency, exchangeRates),
      discountedSubtotal: convertFromNgn(fields.discountedSubtotal, currency, exchangeRates),
      tax: convertFromNgn(fields.tax, currency, exchangeRates),
      shipping: convertFromNgn(fields.shipping, currency, exchangeRates),
      total: convertFromNgn(fields.total, currency, exchangeRates)
    };
  });

  return {
    base: 'NGN',
    rates: exchangeRates.rates,
    fetchedAt: exchangeRates.fetchedAt,
    source: exchangeRates.source,
    supportedCurrencies: [...currencyConfig.supportedCurrencies],
    supportedDisplayCurrencies: [...currencyConfig.supportedDisplayCurrencies],
    supportedCheckoutCurrencies: [...currencyConfig.supportedCheckoutCurrencies],
    defaultCheckoutCurrency: currencyConfig.defaultCheckoutCurrency,
    paystackSupportedCurrencies: [...currencyConfig.paystackSupportedCurrencies],
    byCurrency,
    subtotalNgn: byCurrency.NGN?.subtotal || fields.subtotal,
    discountNgn: byCurrency.NGN?.discount || fields.discount,
    discountedSubtotalNgn: byCurrency.NGN?.discountedSubtotal || fields.discountedSubtotal,
    taxNgn: byCurrency.NGN?.tax || fields.tax,
    shippingNgn: byCurrency.NGN?.shipping || fields.shipping,
    totalNgn: byCurrency.NGN?.total || fields.total,
    subtotalUsd: byCurrency.USD?.subtotal || convertFromNgn(fields.subtotal, 'USD', exchangeRates),
    discountUsd: byCurrency.USD?.discount || convertFromNgn(fields.discount, 'USD', exchangeRates),
    discountedSubtotalUsd: byCurrency.USD?.discountedSubtotal || convertFromNgn(fields.discountedSubtotal, 'USD', exchangeRates),
    taxUsd: byCurrency.USD?.tax || convertFromNgn(fields.tax, 'USD', exchangeRates),
    shippingUsd: byCurrency.USD?.shipping || convertFromNgn(fields.shipping, 'USD', exchangeRates),
    totalUsd: byCurrency.USD?.total || convertFromNgn(fields.total, 'USD', exchangeRates)
  };
}

module.exports = {
  CACHE_TTL_HOURS,
  CACHE_TTL_MS,
  DEFAULT_CHECKOUT_CURRENCIES,
  DEFAULT_DISPLAY_CURRENCIES,
  DEFAULT_PAYSTACK_SUPPORTED_CURRENCIES,
  DEFAULT_RATES,
  SUPPORTED_CURRENCIES,
  buildCheckoutPricingFromNgn,
  buildPaystackVerificationResult,
  convertBetweenCurrencies,
  convertFromNGN,
  convertFromNgn,
  convertToNgn,
  fromSubunit,
  getDefaultCheckoutCurrency,
  getCurrencyConfigSnapshot,
  getExchangeRates,
  getPaystackSupportedCurrencies,
  getChargeSummaryForCurrency,
  getRates,
  getSupportedCheckoutCurrencies,
  getSupportedDisplayCurrencies,
  isCheckoutCurrencyAllowed,
  isPaystackCurrencySupported,
  mapAmountsFromNgn,
  normalizeCurrencyCode,
  resolveCheckoutCurrencySelection,
  resolveCheckoutCurrency,
  toSubunit
};
