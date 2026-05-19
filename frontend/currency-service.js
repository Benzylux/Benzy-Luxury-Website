(function () {
  const SELECTED_CURRENCY_KEY = "benzy_currency";
  const SWR_CACHE_KEY = "benzy_currency_state";
  const API_BASE_STORAGE_KEY = "benzy_api_base";
  const FALLBACK_API_BASE = "http://localhost:3001";
  const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?base=NGN&symbols=USD";
  const CACHE_STALE_MS = 6 * 60 * 60 * 1000;
  const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const DEFAULT_SUPPORTED_CURRENCIES = Object.freeze(["NGN", "USD"]);
  const DEFAULT_SUPPORTED_CHECKOUT_CURRENCIES = Object.freeze(["NGN"]);
  const DEFAULT_PAYSTACK_SUPPORTED = Object.freeze(["NGN"]);
  const DEFAULT_RATES = Object.freeze({
    NGN: 1,
    USD: 1 / 1376.86
  });
  const CURRENCY_LOCALES = Object.freeze({
    NGN: "en-NG",
    USD: "en-US"
  });

  let inFlightRefreshPromise = null;
  let refreshTimer = 0;
  let state = buildState({
    rates: DEFAULT_RATES,
    source: "fallback",
    fetchedAt: "",
    checkoutContextFetchedAt: "",
    selectedCurrency: readSelectedCurrency(),
    supportedCurrencies: DEFAULT_SUPPORTED_CURRENCIES,
    supportedDisplayCurrencies: DEFAULT_SUPPORTED_CURRENCIES,
    supportedCheckoutCurrencies: DEFAULT_SUPPORTED_CHECKOUT_CURRENCIES,
    defaultCheckoutCurrency: "NGN",
    paystackSupportedCurrencies: DEFAULT_PAYSTACK_SUPPORTED,
    countryCode: "",
    checkoutCurrency: "NGN",
    httpsRequired: true,
    httpsDetected: window.location.protocol === "https:" && Boolean(window.isSecureContext),
    paystackConfigured: false,
    paystackPublicKeyConfigured: false
  });

  function roundMoney(value) {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return 0;
    return Number(amount.toFixed(2));
  }

  function normalizeCurrencyCode(value, fallback = "NGN", allowedCurrencies = DEFAULT_SUPPORTED_CURRENCIES) {
    const allowed = Array.isArray(allowedCurrencies) && allowedCurrencies.length
      ? allowedCurrencies.map((entry) => String(entry || "").trim().toUpperCase())
      : [...DEFAULT_SUPPORTED_CURRENCIES];
    const normalized = String(value || "").trim().toUpperCase();
    if (allowed.includes(normalized)) return normalized;

    const fallbackCode = String(fallback || "").trim().toUpperCase();
    return allowed.includes(fallbackCode) ? fallbackCode : "";
  }

  function normalizeCurrencyList(list, fallbackList, allowedCurrencies = DEFAULT_SUPPORTED_CURRENCIES) {
    const allowed = Array.isArray(allowedCurrencies) && allowedCurrencies.length
      ? allowedCurrencies.map((entry) => String(entry || "").trim().toUpperCase())
      : [...DEFAULT_SUPPORTED_CURRENCIES];
    const source = Array.isArray(list) ? list : fallbackList;
    const normalized = source
      .map((entry) => normalizeCurrencyCode(entry, "", allowed))
      .filter(Boolean);
    const unique = Array.from(new Set(normalized.length ? normalized : fallbackList));

    if (allowed.includes("NGN") && !unique.includes("NGN")) {
      unique.unshift("NGN");
    }

    return unique.filter((entry) => allowed.includes(entry));
  }

  function normalizeRates(source) {
    const raw = source && typeof source === "object" ? source : {};
    const next = {
      NGN: 1,
      USD: DEFAULT_RATES.USD
    };

    ["USD"].forEach((code) => {
      const parsed = Number(raw[code]);
      if (Number.isFinite(parsed) && parsed > 0) {
        next[code] = parsed;
      }
    });

    return next;
  }

  function readSelectedCurrency() {
    return normalizeCurrencyCode(localStorage.getItem(SELECTED_CURRENCY_KEY) || "NGN");
  }

  function writeSelectedCurrency(currency) {
    localStorage.setItem(SELECTED_CURRENCY_KEY, normalizeCurrencyCode(currency));
  }

  function buildCheckoutCurrencyMessage(displayCurrency, chargeCurrency) {
    return `This payment currency is not available for checkout yet. You can still browse prices in ${displayCurrency}, but payment will be completed in ${chargeCurrency}.`;
  }

  function buildState(source) {
    const safe = source && typeof source === "object" ? source : {};
    const supportedDisplayCurrencies = normalizeCurrencyList(
      safe.supportedDisplayCurrencies || safe.supportedCurrencies,
      DEFAULT_SUPPORTED_CURRENCIES,
      DEFAULT_SUPPORTED_CURRENCIES
    );
    const supportedCheckoutCurrencies = normalizeCurrencyList(
      safe.supportedCheckoutCurrencies,
      DEFAULT_SUPPORTED_CHECKOUT_CURRENCIES,
      supportedDisplayCurrencies
    ).filter((currency) => supportedDisplayCurrencies.includes(currency));
    const checkoutCurrencies = supportedCheckoutCurrencies.length
      ? supportedCheckoutCurrencies
      : ["NGN"];
    const defaultCheckoutCurrency = normalizeCurrencyCode(
      safe.defaultCheckoutCurrency || safe.checkoutCurrency || checkoutCurrencies[0] || "NGN",
      "NGN",
      checkoutCurrencies
    ) || "NGN";
    const paystackSupportedCurrencies = normalizeCurrencyList(
      safe.paystackSupportedCurrencies,
      DEFAULT_PAYSTACK_SUPPORTED,
      checkoutCurrencies
    ).filter((currency) => checkoutCurrencies.includes(currency));
    const selectedCurrency = normalizeCurrencyCode(
      safe.selectedCurrency || readSelectedCurrency(),
      supportedDisplayCurrencies[0] || "NGN",
      supportedDisplayCurrencies
    ) || "NGN";

    return {
      base: "NGN",
      rates: normalizeRates(safe.rates || safe),
      fetchedAt: String(safe.fetchedAt || safe.ratesFetchedAt || "").trim(),
      source: String(safe.source || safe.ratesSource || "fallback").trim() || "fallback",
      selectedCurrency,
      supportedCurrencies: [...supportedDisplayCurrencies],
      supportedDisplayCurrencies: [...supportedDisplayCurrencies],
      supportedCheckoutCurrencies: [...checkoutCurrencies],
      defaultCheckoutCurrency,
      paystackSupportedCurrencies: paystackSupportedCurrencies.length
        ? [...paystackSupportedCurrencies]
        : [defaultCheckoutCurrency],
      countryCode: String(safe.countryCode || "").trim().toUpperCase(),
      checkoutCurrency: normalizeCurrencyCode(
        safe.checkoutCurrency || safe.currency || defaultCheckoutCurrency,
        defaultCheckoutCurrency,
        checkoutCurrencies
      ) || defaultCheckoutCurrency,
      httpsRequired: safe.httpsRequired !== false,
      httpsDetected: typeof safe.httpsDetected === "boolean"
        ? safe.httpsDetected
        : (window.location.protocol === "https:" && Boolean(window.isSecureContext)),
      paystackConfigured: Boolean(safe.paystackConfigured),
      paystackPublicKeyConfigured: Boolean(safe.paystackPublicKeyConfigured),
      checkoutContextFetchedAt: String(
        safe.checkoutContextFetchedAt
          || safe.ratesFetchedAt
          || safe.fetchedAt
          || ""
      ).trim()
    };
  }

  function readStoredState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SWR_CACHE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return null;
      return buildState(parsed);
    } catch {
      return null;
    }
  }

  function writeStoredState(nextState) {
    const safe = buildState(nextState);
    localStorage.setItem(
      SWR_CACHE_KEY,
      JSON.stringify({
        base: safe.base,
        rates: safe.rates,
        fetchedAt: safe.fetchedAt,
        source: safe.source,
        supportedCurrencies: safe.supportedCurrencies,
        supportedDisplayCurrencies: safe.supportedDisplayCurrencies,
        supportedCheckoutCurrencies: safe.supportedCheckoutCurrencies,
        defaultCheckoutCurrency: safe.defaultCheckoutCurrency,
        paystackSupportedCurrencies: safe.paystackSupportedCurrencies,
        countryCode: safe.countryCode,
        checkoutCurrency: safe.checkoutCurrency,
        httpsRequired: safe.httpsRequired,
        httpsDetected: safe.httpsDetected,
        paystackConfigured: safe.paystackConfigured,
        paystackPublicKeyConfigured: safe.paystackPublicKeyConfigured,
        checkoutContextFetchedAt: safe.checkoutContextFetchedAt
      })
    );
  }

  function parseTimestamp(value) {
    const parsed = Date.parse(String(value || ""));
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  function isTimestampFresh(value) {
    const timestamp = parseTimestamp(value);
    if (!Number.isFinite(timestamp)) return false;
    return (Date.now() - timestamp) < CACHE_STALE_MS;
  }

  function isTimestampUsable(value) {
    const timestamp = parseTimestamp(value);
    if (!Number.isFinite(timestamp)) return false;
    return (Date.now() - timestamp) < CACHE_MAX_AGE_MS;
  }

  function isTimestampStale(value) {
    return !isTimestampFresh(value);
  }

  function getApiBases() {
    const bases = [];
    const storedBase = localStorage.getItem(API_BASE_STORAGE_KEY);
    const origin = window.location.origin;

    if (storedBase) bases.push(storedBase);
    if (origin && origin !== "null") bases.push(origin);
    bases.push(FALLBACK_API_BASE);

    return Array.from(new Set(bases.filter(Boolean)));
  }

  async function readJsonSafe(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  function dispatchCurrencyUpdate(reason) {
    window.dispatchEvent(new CustomEvent("benzy:currency-updated", {
      detail: {
        reason: String(reason || "updated"),
        ...getCurrentState()
      }
    }));
  }

  function scheduleRefresh() {
    if (refreshTimer) {
      window.clearTimeout(refreshTimer);
      refreshTimer = 0;
    }

    const timestamp = parseTimestamp(state.fetchedAt);
    if (!Number.isFinite(timestamp)) return;

    const delay = Math.max(10 * 1000, CACHE_STALE_MS - (Date.now() - timestamp));
    refreshTimer = window.setTimeout(function () {
      void refreshState({ forceRefresh: true, dispatchReason: "rates-refreshed" });
    }, delay);
  }

  function setState(nextState, reason) {
    state = buildState({
      ...state,
      ...(nextState && typeof nextState === "object" ? nextState : {})
    });
    scheduleRefresh();
    if (reason) {
      dispatchCurrencyUpdate(reason);
    }
    return getCurrentState();
  }

  function createFetchOptions() {
    return {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin"
    };
  }

  async function fetchBackendSnapshot(base) {
    const requestOptions = createFetchOptions();

    try {
      const contextResponse = await fetch(`${base}/api/checkout/context`, requestOptions);
      const contextPayload = await readJsonSafe(contextResponse);
      if (contextResponse.ok && contextPayload?.rates) {
        return buildState({
          ...contextPayload,
          fetchedAt: contextPayload.ratesFetchedAt || contextPayload.fetchedAt || new Date().toISOString(),
          source: contextPayload.ratesSource || contextPayload.source || "backend",
          checkoutContextFetchedAt: new Date().toISOString(),
          selectedCurrency: state.selectedCurrency
        });
      }
    } catch {
      // Fall through to the rates endpoint for this API base.
    }

    const ratesResponse = await fetch(`${base}/api/currency/rates`, requestOptions);
    const ratesPayload = await readJsonSafe(ratesResponse);
    if (!ratesResponse.ok || !ratesPayload?.rates) {
      throw new Error("Backend currency endpoint unavailable.");
    }

    return buildState({
      ...state,
      ...ratesPayload,
      fetchedAt: ratesPayload.fetchedAt || new Date().toISOString(),
      source: ratesPayload.source || "backend",
      checkoutContextFetchedAt: state.checkoutContextFetchedAt,
      selectedCurrency: state.selectedCurrency
    });
  }

  async function fetchStateFromBackend() {
    for (const base of getApiBases()) {
      try {
        const nextState = await fetchBackendSnapshot(base);
        localStorage.setItem(API_BASE_STORAGE_KEY, base);
        return nextState;
      } catch {
        // Try the next configured backend.
      }
    }

    throw new Error("Backend currency endpoint unavailable.");
  }

  async function fetchRatesFromFrankfurter() {
    const response = await fetch(FRANKFURTER_URL, createFetchOptions());
    if (!response.ok) {
      throw new Error("Frankfurter exchange rate request failed.");
    }

    const payload = await readJsonSafe(response);
    if (!payload?.rates || typeof payload.rates !== "object") {
      throw new Error("Frankfurter payload was missing rates.");
    }

    return buildState({
      ...state,
      rates: {
        NGN: 1,
        USD: payload.rates.USD
      },
      fetchedAt: new Date().toISOString(),
      source: "frankfurter",
      selectedCurrency: state.selectedCurrency
    });
  }

  async function refreshState(options = {}) {
    const forceRefresh = Boolean(options.forceRefresh);
    const cached = readStoredState();

    if (!forceRefresh && inFlightRefreshPromise) {
      return inFlightRefreshPromise;
    }

    inFlightRefreshPromise = (async function () {
      try {
        const backendState = await fetchStateFromBackend();
        writeStoredState(backendState);
        return setState(backendState, options.dispatchReason || "rates-refreshed");
      } catch {
        try {
          const frankfurterState = await fetchRatesFromFrankfurter();
          writeStoredState(frankfurterState);
          return setState(frankfurterState, options.dispatchReason || "rates-refreshed");
        } catch {
          if (cached && isTimestampUsable(cached.fetchedAt || cached.checkoutContextFetchedAt)) {
            return setState({
              ...cached,
              source: cached.source === "frankfurter" ? "cache" : cached.source
            }, options.dispatchReason || "rates-fallback");
          }

          return setState({
            rates: DEFAULT_RATES,
            fetchedAt: "",
            source: "fallback"
          }, options.dispatchReason || "rates-fallback");
        }
      } finally {
        inFlightRefreshPromise = null;
      }
    })();

    return inFlightRefreshPromise;
  }

  async function getExchangeRates(options = {}) {
    const forceRefresh = Boolean(options.forceRefresh);
    const shouldRevalidate = options.revalidate !== false;
    const currentTimestamp = state.fetchedAt || state.checkoutContextFetchedAt;
    const cached = readStoredState();
    const cachedTimestamp = cached?.fetchedAt || cached?.checkoutContextFetchedAt;

    if (!forceRefresh && currentTimestamp && isTimestampUsable(currentTimestamp)) {
      if (shouldRevalidate && isTimestampStale(currentTimestamp)) {
        void refreshState({ dispatchReason: "rates-refreshed" });
      }
      return getCurrentState();
    }

    if (!forceRefresh && cached && isTimestampUsable(cachedTimestamp)) {
      const snapshot = setState(cached, "");
      if (shouldRevalidate && isTimestampStale(cachedTimestamp)) {
        void refreshState({ dispatchReason: "rates-refreshed" });
      }
      return snapshot;
    }

    if (!forceRefresh && inFlightRefreshPromise) {
      return inFlightRefreshPromise;
    }

    return refreshState({
      forceRefresh,
      dispatchReason: forceRefresh ? "rates-refreshed" : "rates-loaded"
    });
  }

  function getRates() {
    return { ...state.rates };
  }

  function getCurrentState() {
    return {
      base: state.base,
      rates: getRates(),
      fetchedAt: state.fetchedAt,
      source: state.source,
      selectedCurrency: state.selectedCurrency,
      supportedCurrencies: [...state.supportedCurrencies],
      supportedDisplayCurrencies: [...state.supportedDisplayCurrencies],
      supportedCheckoutCurrencies: [...state.supportedCheckoutCurrencies],
      defaultCheckoutCurrency: state.defaultCheckoutCurrency,
      paystackSupportedCurrencies: [...state.paystackSupportedCurrencies],
      countryCode: state.countryCode,
      checkoutCurrency: state.checkoutCurrency,
      httpsRequired: state.httpsRequired,
      httpsDetected: state.httpsDetected,
      paystackConfigured: state.paystackConfigured,
      paystackPublicKeyConfigured: state.paystackPublicKeyConfigured,
      checkoutContextFetchedAt: state.checkoutContextFetchedAt
    };
  }

  function getCheckoutContextSnapshot() {
    return {
      countryCode: state.countryCode,
      currency: state.checkoutCurrency,
      checkoutCurrency: state.checkoutCurrency,
      baseCurrency: state.base,
      supportedCurrencies: [...state.supportedCurrencies],
      supportedDisplayCurrencies: [...state.supportedDisplayCurrencies],
      supportedCheckoutCurrencies: [...state.supportedCheckoutCurrencies],
      defaultCheckoutCurrency: state.defaultCheckoutCurrency,
      paystackSupportedCurrencies: [...state.paystackSupportedCurrencies],
      rates: getRates(),
      ratesFetchedAt: state.fetchedAt,
      ratesSource: state.source,
      httpsRequired: state.httpsRequired,
      httpsDetected: state.httpsDetected,
      paystackConfigured: state.paystackConfigured,
      paystackPublicKeyConfigured: state.paystackPublicKeyConfigured
    };
  }

  async function getCheckoutContext(options = {}) {
    await getExchangeRates(options);
    return getCheckoutContextSnapshot();
  }

  function convertAmount(amount, fromCurrency, toCurrency, customRates) {
    const sourceCode = normalizeCurrencyCode(fromCurrency, "NGN");
    const targetCode = normalizeCurrencyCode(toCurrency, "NGN");
    const rates = normalizeRates(customRates || state.rates);
    const numericAmount = Number(amount || 0);
    if (!Number.isFinite(numericAmount)) return 0;
    if (sourceCode === targetCode) return roundMoney(numericAmount);

    const amountInNgn = sourceCode === "NGN"
      ? numericAmount
      : numericAmount / rates[sourceCode];

    if (targetCode === "NGN") return roundMoney(amountInNgn);
    return roundMoney(amountInNgn * rates[targetCode]);
  }

  function convertPrice(amountInNgn, targetCurrency) {
    return convertAmount(amountInNgn, "NGN", targetCurrency);
  }

  function formatCurrency(amount, currencyCode, options = {}) {
    const code = normalizeCurrencyCode(currencyCode, "NGN");
    const formatter = new Intl.NumberFormat(CURRENCY_LOCALES[code] || "en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: options.minimumFractionDigits,
      maximumFractionDigits: options.maximumFractionDigits ?? 2
    });
    return formatter.format(Number(amount || 0));
  }

  function formatPriceFromNgn(amountInNgn, currencyCode) {
    const code = normalizeCurrencyCode(currencyCode, state.selectedCurrency, state.supportedDisplayCurrencies);
    return formatCurrency(convertPrice(amountInNgn, code), code);
  }

  function getCurrencySymbol(currencyCode) {
    const code = normalizeCurrencyCode(currencyCode, "NGN");
    const parts = new Intl.NumberFormat(CURRENCY_LOCALES[code] || "en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol"
    }).formatToParts(0);

    const currencyPart = parts.find((part) => part.type === "currency");
    return currencyPart?.value || code;
  }

  function getCurrencyConfig(currencyCode) {
    const code = normalizeCurrencyCode(currencyCode, state.selectedCurrency, state.supportedDisplayCurrencies);
    return {
      locale: CURRENCY_LOCALES[code] || "en-US",
      currency: code,
      rateFromNgn: state.rates[code] || DEFAULT_RATES[code] || 1
    };
  }

  function getSelectedCurrency() {
    return state.selectedCurrency;
  }

  function setSelectedCurrency(currencyCode) {
    const nextCurrency = normalizeCurrencyCode(
      currencyCode,
      state.selectedCurrency || "NGN",
      state.supportedDisplayCurrencies
    ) || "NGN";
    writeSelectedCurrency(nextCurrency);
    if (state.selectedCurrency === nextCurrency) {
      return nextCurrency;
    }

    setState({ selectedCurrency: nextCurrency }, "currency-changed");
    return nextCurrency;
  }

  function getSupportedCurrencies() {
    return [...state.supportedCurrencies];
  }

  function getSupportedCheckoutCurrencies() {
    return [...state.supportedCheckoutCurrencies];
  }

  function getDefaultCheckoutCurrency() {
    return state.defaultCheckoutCurrency;
  }

  function getDetectedCheckoutCurrency() {
    return state.checkoutCurrency;
  }

  function getPaystackSupportedCurrencies() {
    return [...state.paystackSupportedCurrencies];
  }

  function isCheckoutCurrencySupported(currencyCode) {
    return state.supportedCheckoutCurrencies.includes(
      normalizeCurrencyCode(currencyCode, "", state.supportedCheckoutCurrencies)
    );
  }

  function buildPaystackUnavailableSelection(displayCurrency, requestedCheckoutCurrency, fallbackCurrency) {
    return {
      displayCurrency,
      requestedCheckoutCurrency: requestedCheckoutCurrency || displayCurrency,
      chargeCurrency: "",
      chargeCurrencyForced: true,
      chargeCurrencyMessage: "Paystack checkout is not configured for any supported currency right now.",
      fallbackCurrency,
      supportedCheckoutCurrencies: [...state.supportedCheckoutCurrencies],
      paystackSupportedCurrencies: [...state.paystackSupportedCurrencies],
      defaultCheckoutCurrency: state.defaultCheckoutCurrency
    };
  }

  function getCheckoutCurrencySelection(preferredCurrency, options = {}) {
    const displayCurrency = normalizeCurrencyCode(
      options.displayCurrency || preferredCurrency || state.selectedCurrency,
      state.selectedCurrency || "NGN",
      state.supportedDisplayCurrencies
    ) || "NGN";
    const requestedValue = options.checkoutCurrency
      || options.settlementCurrency
      || options.requestedCheckoutCurrency
      || preferredCurrency
      || displayCurrency;
    const requestedCheckoutCurrency = normalizeCurrencyCode(
      requestedValue,
      "",
      state.supportedCheckoutCurrencies
    );
    const fallbackCurrency = normalizeCurrencyCode(
      options.fallbackCurrency || state.checkoutCurrency || state.defaultCheckoutCurrency,
      state.defaultCheckoutCurrency,
      state.supportedCheckoutCurrencies
    ) || state.defaultCheckoutCurrency || "NGN";
    const paymentMethodCode = String(options.paymentMethodCode || options.paymentMethod || "").trim().toLowerCase();

    let chargeCurrency = requestedCheckoutCurrency || fallbackCurrency;
    let chargeCurrencyForced = chargeCurrency !== (requestedCheckoutCurrency || displayCurrency);
    let chargeCurrencyMessage = chargeCurrencyForced
      ? buildCheckoutCurrencyMessage(displayCurrency, chargeCurrency)
      : "";

    if (paymentMethodCode === "card" || paymentMethodCode === "paystack") {
      if (!state.paystackSupportedCurrencies.length) {
        return buildPaystackUnavailableSelection(displayCurrency, requestedCheckoutCurrency, fallbackCurrency);
      }

      const normalizedPaystackCurrency = normalizeCurrencyCode(
        chargeCurrency,
        "",
        state.paystackSupportedCurrencies
      );

      if (!normalizedPaystackCurrency) {
        const paystackFallbackCurrency = normalizeCurrencyCode(
          fallbackCurrency,
          "",
          state.paystackSupportedCurrencies
        ) || state.paystackSupportedCurrencies[0] || "";

        if (!paystackFallbackCurrency) {
          return buildPaystackUnavailableSelection(displayCurrency, requestedCheckoutCurrency, fallbackCurrency);
        }

        chargeCurrency = paystackFallbackCurrency;
        chargeCurrencyForced = chargeCurrency !== (requestedCheckoutCurrency || displayCurrency);
        chargeCurrencyMessage = chargeCurrencyForced
          ? buildCheckoutCurrencyMessage(displayCurrency, chargeCurrency)
          : "";
      }
    }

    return {
      displayCurrency,
      requestedCheckoutCurrency: requestedCheckoutCurrency || displayCurrency,
      chargeCurrency,
      chargeCurrencyForced,
      chargeCurrencyMessage,
      fallbackCurrency,
      supportedCheckoutCurrencies: [...state.supportedCheckoutCurrencies],
      paystackSupportedCurrencies: [...state.paystackSupportedCurrencies],
      defaultCheckoutCurrency: state.defaultCheckoutCurrency
    };
  }

  const storedState = readStoredState();
  if (storedState && isTimestampUsable(storedState.fetchedAt || storedState.checkoutContextFetchedAt)) {
    state = buildState({
      ...storedState,
      selectedCurrency: readSelectedCurrency()
    });
  }
  scheduleRefresh();

  window.addEventListener("storage", function (event) {
    if (event.key === SELECTED_CURRENCY_KEY) {
      const nextCurrency = readSelectedCurrency();
      if (state.selectedCurrency !== nextCurrency) {
        setState({ selectedCurrency: nextCurrency }, "currency-storage-sync");
      }
      return;
    }

    if (event.key === SWR_CACHE_KEY) {
      const nextState = readStoredState();
      if (nextState && isTimestampUsable(nextState.fetchedAt || nextState.checkoutContextFetchedAt)) {
        setState(nextState, "rates-storage-sync");
      }
    }
  });

  window.BenzyCurrency = {
    CACHE_MAX_AGE_MS,
    CACHE_STALE_MS,
    CACHE_TTL_MS: CACHE_STALE_MS,
    FRANKFURTER_URL,
    SUPPORTED_CURRENCIES: [...DEFAULT_SUPPORTED_CURRENCIES],
    convertAmount,
    convertPrice,
    formatCurrency,
    formatPriceFromNgn,
    getCheckoutContext,
    getCheckoutCurrencySelection,
    getCurrentState,
    getCurrencyConfig,
    getCurrencySymbol,
    getDefaultCheckoutCurrency,
    getDetectedCheckoutCurrency,
    getExchangeRates,
    getPaystackSupportedCurrencies,
    getRates,
    getSelectedCurrency,
    getSupportedCheckoutCurrencies,
    getSupportedCurrencies,
    isCheckoutCurrencySupported,
    normalizeCurrencyCode,
    setSelectedCurrency
  };

  void getExchangeRates();
})();
