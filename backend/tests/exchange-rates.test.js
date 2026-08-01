const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const servicePath = path.join(__dirname, '..', 'server', 'src', 'currency', 'exchangeRatesService.js');

function loadServiceWithEnv(envOverrides) {
  const previousValues = new Map();

  Object.entries(envOverrides).forEach(([key, value]) => {
    previousValues.set(key, process.env[key]);
    if (value == null) {
      delete process.env[key];
      return;
    }

    process.env[key] = String(value);
  });

  delete require.cache[require.resolve(servicePath)];
  const service = require(servicePath);

  return {
    service,
    restore() {
      previousValues.forEach((value, key) => {
        if (value == null) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      });

      delete require.cache[require.resolve(servicePath)];
    }
  };
}

test('currency config snapshot normalizes env-driven display and checkout lists', () => {
  const loaded = loadServiceWithEnv({
    SUPPORTED_DISPLAY_CURRENCIES: 'USD,ABC,GBP',
    SUPPORTED_CHECKOUT_CURRENCIES: 'USD,EUR',
    PAYSTACK_SUPPORTED_CURRENCIES: 'USD'
  });

  try {
    const snapshot = loaded.service.getCurrencyConfigSnapshot();
    assert.deepEqual(snapshot.supportedDisplayCurrencies, ['NGN', 'USD']);
    assert.deepEqual(snapshot.supportedCheckoutCurrencies, ['NGN', 'USD']);
    assert.equal(snapshot.defaultCheckoutCurrency, 'NGN');
    assert.deepEqual(snapshot.paystackSupportedCurrencies, ['NGN', 'USD']);
  } finally {
    loaded.restore();
  }
});

test('checkout currency selection keeps display currency but falls back charge currency for Paystack', () => {
  const loaded = loadServiceWithEnv({
    SUPPORTED_DISPLAY_CURRENCIES: 'NGN,USD',
    SUPPORTED_CHECKOUT_CURRENCIES: 'NGN',
    PAYSTACK_SUPPORTED_CURRENCIES: 'NGN'
  });

  try {
    const selection = loaded.service.resolveCheckoutCurrencySelection({
      displayCurrency: 'USD',
      checkoutCurrency: 'USD',
      paymentMethodCode: 'paystack',
      fallbackCurrency: 'NGN'
    });

    assert.equal(selection.displayCurrency, 'USD');
    assert.equal(selection.requestedCheckoutCurrency, 'USD');
    assert.equal(selection.chargeCurrency, 'NGN');
    assert.equal(selection.chargeCurrencyForced, true);
    assert.match(selection.chargeCurrencyMessage, /payment will be completed in NGN/i);
  } finally {
    loaded.restore();
  }
});

test('checkout pricing utilities convert canonical NGN totals into charge currency totals', () => {
  const loaded = loadServiceWithEnv({
    SUPPORTED_DISPLAY_CURRENCIES: 'NGN,USD',
    SUPPORTED_CHECKOUT_CURRENCIES: 'NGN,USD',
    PAYSTACK_SUPPORTED_CURRENCIES: 'USD'
  });

  try {
    const pricing = loaded.service.buildCheckoutPricingFromNgn({
      subtotalNgn: 20000,
      discountNgn: 2000,
      discountedSubtotalNgn: 18000,
      taxNgn: 1350,
      shippingNgn: 3000,
      totalNgn: 22350
    }, {
      exchangeRates: {
        rates: {
          NGN: 1,
          USD: 1 / 2000
        }
      },
      displayCurrency: 'USD',
      checkoutCurrency: 'USD',
      paymentMethodCode: 'paystack'
    });

    assert.equal(pricing.chargeCurrency, 'USD');
    assert.equal(pricing.chargeCurrencyForced, false);
    assert.equal(pricing.chargeSubtotal, 10);
    assert.equal(pricing.chargeDiscount, 1);
    assert.equal(pricing.chargeDiscountedSubtotal, 9);
    assert.equal(pricing.chargeTax, 0.68);
    assert.equal(pricing.chargeShipping, 1.5);
    assert.equal(pricing.chargeTotal, 11.18);
    assert.equal(pricing.chargeTotalSubunit, 1118);
  } finally {
    loaded.restore();
  }
});

test('paystack verification accepts gateway overages but rejects underpayments', () => {
  const loaded = loadServiceWithEnv({
    SUPPORTED_DISPLAY_CURRENCIES: 'NGN,USD'
  });

  try {
    const matched = loaded.service.buildPaystackVerificationResult({
      expectedAmountMajor: 11.18,
      expectedCurrency: 'USD',
      verifiedAmountSubunit: 1118,
      verifiedCurrency: 'USD'
    });
    const overpaid = loaded.service.buildPaystackVerificationResult({
      expectedAmountMajor: 11.18,
      expectedCurrency: 'USD',
      verifiedAmountSubunit: 1119,
      verifiedCurrency: 'USD'
    });
    const underpaid = loaded.service.buildPaystackVerificationResult({
      expectedAmountMajor: 11.18,
      expectedCurrency: 'USD',
      verifiedAmountSubunit: 1117,
      verifiedCurrency: 'USD'
    });

    assert.equal(matched.matchesCurrency, true);
    assert.equal(matched.matchesAmount, true);
    assert.equal(matched.expectedAmountSubunit, 1118);
    assert.equal(matched.verifiedAmountMajor, 11.18);

    assert.equal(overpaid.matchesCurrency, true);
    assert.equal(overpaid.matchesAmount, true);
    assert.equal(overpaid.verifiedAmountSubunit, 1119);
    assert.equal(overpaid.overageSubunit, 1);
    assert.equal(overpaid.overageMajor, 0.01);

    assert.equal(underpaid.matchesCurrency, true);
    assert.equal(underpaid.matchesAmount, false);
    assert.equal(underpaid.verifiedAmountSubunit, 1117);
    assert.equal(underpaid.shortfallSubunit, 1);
    assert.equal(underpaid.shortfallMajor, 0.01);
  } finally {
    loaded.restore();
  }
});
