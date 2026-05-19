(function () {
  const ACTIVE_CART_KEY = "benzy_cart_items";
  const GUEST_CART_KEY = "benzy_guest_cart_items";
  const CART_META_KEY = "benzy_cart_meta";
  const POST_LOGIN_REDIRECT_KEY = "benzy_post_login_redirect";
  const TOKEN_KEY = "benzy_auth_token";
  const CART_EVENT_NAME = "benzy:cart-updated";
  const CART_TAX_RATE = 0.075;
  const EMPTY_TOTALS = {
    currency: "NGN",
    itemCount: 0,
    quantityCount: 0,
    subtotal: 0,
    tax: 0,
    total: 0
  };

  let currentState = null;

  const storageHelper = {
    read(key, fallback) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "null");
        return parsed === null ? fallback : parsed;
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
    clear(key) {
      localStorage.removeItem(key);
    }
  };

  function roundMoney(value) {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return 0;
    return Number(amount.toFixed(2));
  }

  function getCurrencyService() {
    return window.BenzyCurrency && typeof window.BenzyCurrency === "object"
      ? window.BenzyCurrency
      : null;
  }

  function coercePriceNgn(raw) {
    const explicitPriceNgn = Number(raw?.priceNgn ?? raw?.unitPriceNgn ?? raw?.unitPriceNGN ?? raw?.basePriceNgn);
    if (Number.isFinite(explicitPriceNgn) && explicitPriceNgn >= 0) {
      return roundMoney(explicitPriceNgn);
    }

    const directPrice = Number(raw?.price);
    if (Number.isFinite(directPrice) && directPrice >= 0) {
      const declaredCurrency = String(raw?.currency || "").trim().toUpperCase();
      if (!declaredCurrency || declaredCurrency === "NGN") {
        return roundMoney(directPrice);
      }
    }

    const priceUsd = Number(raw?.priceUsd);
    if (Number.isFinite(priceUsd) && priceUsd >= 0) {
      return convertToNgn(priceUsd, "USD");
    }

    return 0;
  }

  function convertToNgn(amount, sourceCurrency) {
    const service = getCurrencyService();
    if (service?.convertAmount) {
      return roundMoney(service.convertAmount(amount, sourceCurrency, "NGN"));
    }

    const fallbackUsdRate = 1600;
    if (String(sourceCurrency || "").trim().toUpperCase() === "USD") {
      return roundMoney(Number(amount || 0) * fallbackUsdRate);
    }
    return roundMoney(Number(amount || 0));
  }

  function normalizeText(value, fallback = "") {
    return String(value || fallback).trim();
  }

  function normalizeQuantity(value) {
    const parsed = Number.parseInt(String(value ?? 1), 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return parsed;
  }

  function slugify(value, fallback = "default") {
    const normalized = normalizeText(value, fallback)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized || fallback;
  }

  function normalizeOptionLabel(value, prefix, fallback) {
    const raw = normalizeText(value);
    const cleanPrefix = normalizeText(prefix);
    const pattern = cleanPrefix ? new RegExp(`^${cleanPrefix}\\s*:\\s*`, "i") : null;
    const cleaned = pattern ? raw.replace(pattern, "").trim() : raw;
    return cleaned || fallback;
  }

  function formatOptionLabel(value, prefix, fallback) {
    return `${prefix}: ${normalizeOptionLabel(value, prefix, fallback)}`;
  }

  function decodeToken(token) {
    const rawToken = String(token || "").trim();
    if (!rawToken) return null;

    try {
      const payloadPart = rawToken.split(".")[1] || "";
      if (!payloadPart) return null;
      const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function getAuthUser() {
    const payload = decodeToken(getToken());
    if (!payload || typeof payload !== "object") return null;

    const id = normalizeText(payload.id || payload.userId || payload.sub || "");
    const email = normalizeText(payload.email || "").toLowerCase();
    const name = normalizeText(payload.name || "");

    if (!id || !email) return null;
    return { id, email, name };
  }

  function isAuthenticated() {
    return Boolean(getAuthUser());
  }

  function buildVariantId(item) {
    const explicit = normalizeText(item?.variantId);
    if (explicit) return explicit;

    return [
      slugify(item?.productId || item?.name || item?.title || "product"),
      slugify(item?.sizeLabel || normalizeOptionLabel(item?.size, "Size", "M")),
      slugify(item?.colorLabel || normalizeOptionLabel(item?.color, "Color", "Standard"))
    ].join("__");
  }

  function buildCartItemId(item) {
    return [
      slugify(item?.productId || item?.name || item?.title || "product"),
      slugify(buildVariantId(item), "variant")
    ].join("__");
  }

  function normalizeCartItem(raw) {
    const quantity = normalizeQuantity(raw?.quantity ?? raw?.qty ?? 1);
    const name = normalizeText(raw?.name || raw?.title || "Product", "Product");
    const safePriceNgn = coercePriceNgn(raw);
    const productId = normalizeText(raw?.productId || raw?.id || "");
    const sizeLabel = normalizeOptionLabel(raw?.sizeLabel || raw?.size, "Size", "M");
    const colorLabel = normalizeOptionLabel(raw?.colorLabel || raw?.color, "Color", "Standard");
    const size = formatOptionLabel(sizeLabel, "Size", "M");
    const color = formatOptionLabel(colorLabel, "Color", "Standard");
    const variantId = buildVariantId({ ...raw, productId, size, color, sizeLabel, colorLabel, name });
    const id = buildCartItemId({ ...raw, productId, variantId, name });

    return {
      id,
      productId,
      name,
      title: name,
      price: safePriceNgn,
      priceNgn: safePriceNgn,
      image: normalizeText(raw?.image || ""),
      quantity,
      qty: quantity,
      size,
      sizeLabel,
      color,
      colorLabel,
      variantId,
      alt: normalizeText(raw?.alt || name, name),
      category: normalizeText(raw?.category || "all", "all")
    };
  }

  function normalizeItems(items) {
    return (Array.isArray(items) ? items : []).map(normalizeCartItem);
  }

  function buildTotals(items) {
    const safeItems = normalizeItems(items);
    const subtotal = roundMoney(
      safeItems.reduce((sum, item) => sum + Number(item.priceNgn ?? item.price ?? 0) * Number(item.quantity || item.qty || 1), 0)
    );
    const tax = roundMoney(subtotal * CART_TAX_RATE);
    const total = roundMoney(subtotal + tax);
    const quantityCount = safeItems.reduce((sum, item) => sum + Number(item.quantity || item.qty || 1), 0);

    return {
      currency: "NGN",
      itemCount: safeItems.length,
      quantityCount,
      subtotal,
      tax,
      total
    };
  }

  function normalizeTotals(totals) {
    const safe = totals && typeof totals === "object" ? totals : EMPTY_TOTALS;
    return {
      currency: "NGN",
      itemCount: Math.max(0, Number.parseInt(String(safe.itemCount ?? 0), 10) || 0),
      quantityCount: Math.max(0, Number.parseInt(String(safe.quantityCount ?? 0), 10) || 0),
      subtotal: roundMoney(safe.subtotal),
      tax: roundMoney(safe.tax),
      total: roundMoney(safe.total)
    };
  }

  function normalizeServerCart(cart) {
    const safeCart = cart && typeof cart === "object" ? cart : {};
    const items = normalizeItems(safeCart.items);

    return {
      items,
      totals: normalizeTotals(safeCart.totals || buildTotals(items)),
      updatedAt: normalizeText(safeCart.updatedAt || new Date().toISOString()),
      userId: normalizeText(safeCart.userId || ""),
      email: normalizeText(safeCart.email || "").toLowerCase()
    };
  }

  function getCacheMeta() {
    const meta = storageHelper.read(CART_META_KEY, {});
    return meta && typeof meta === "object" ? meta : {};
  }

  function setCacheMeta(meta) {
    const currentMeta = getCacheMeta();
    storageHelper.write(CART_META_KEY, {
      ...currentMeta,
      ...(meta && typeof meta === "object" ? meta : {})
    });
  }

  function readItemsFromKey(key) {
    return normalizeItems(storageHelper.read(key, []));
  }

  function getGuestCart() {
    return readItemsFromKey(GUEST_CART_KEY);
  }

  function getCachedCart() {
    return readItemsFromKey(ACTIVE_CART_KEY);
  }

  function getCachedState() {
    const items = getCachedCart();
    const meta = getCacheMeta();
    const totals = meta.mode === "server" ? normalizeTotals(meta.totals || buildTotals(items)) : buildTotals(items);

    return {
      mode: meta.mode === "server" ? "server" : "guest",
      items,
      totals,
      updatedAt: normalizeText(meta.updatedAt || new Date().toISOString()),
      isAuthenticated: isAuthenticated()
    };
  }

  function emitCartUpdated(state) {
    const detail = state || getCachedState();
    currentState = detail;
    window.dispatchEvent(new CustomEvent(CART_EVENT_NAME, { detail }));
  }

  function persistGuestCart(items, options = {}) {
    const normalized = normalizeItems(items);
    const state = {
      mode: "guest",
      items: normalized,
      totals: buildTotals(normalized),
      updatedAt: new Date().toISOString(),
      isAuthenticated: false
    };

    storageHelper.write(GUEST_CART_KEY, normalized);
    storageHelper.write(ACTIVE_CART_KEY, normalized);
    setCacheMeta({
      mode: "guest",
      totals: state.totals,
      updatedAt: state.updatedAt
    });
    currentState = state;

    if (!options.silent) emitCartUpdated(state);
    return state;
  }

  function persistServerCart(cart, options = {}) {
    const normalizedCart = normalizeServerCart(cart);
    const state = {
      mode: "server",
      items: normalizedCart.items,
      totals: normalizedCart.totals,
      updatedAt: normalizedCart.updatedAt,
      userId: normalizedCart.userId,
      email: normalizedCart.email,
      isAuthenticated: isAuthenticated()
    };

    storageHelper.write(ACTIVE_CART_KEY, normalizedCart.items);
    setCacheMeta({
      mode: "server",
      totals: normalizedCart.totals,
      updatedAt: normalizedCart.updatedAt
    });
    currentState = state;

    if (!options.silent) emitCartUpdated(state);
    return state;
  }

  function setGuestCart(items, options = {}) {
    return persistGuestCart(items, options);
  }

  function clearGuestCart(options = {}) {
    storageHelper.clear(GUEST_CART_KEY);

    if (options.keepActive) {
      return currentState || getCachedState();
    }

    return persistGuestCart([], options);
  }

  function findMatchingItem(items, incoming) {
    const safeItems = Array.isArray(items) ? items : [];
    const normalizedIncoming = normalizeCartItem(incoming);

    return safeItems.find((item) => {
      if (String(item.id || "") === String(normalizedIncoming.id || "")) return true;
      if (String(item.productId || "") !== String(normalizedIncoming.productId || "")) return false;
      return String(item.variantId || "") === String(normalizedIncoming.variantId || "");
    }) || null;
  }

  function mergeItems(baseItems, incomingItems) {
    const nextItems = normalizeItems(baseItems);

    normalizeItems(incomingItems).forEach((incoming) => {
      const existing = findMatchingItem(nextItems, incoming);
      if (existing) {
        const nextQuantity = Number(existing.quantity || existing.qty || 1) + Number(incoming.quantity || incoming.qty || 1);
        existing.quantity = nextQuantity;
        existing.qty = nextQuantity;
        return;
      }

      nextItems.push(incoming);
    });

    return normalizeItems(nextItems);
  }

  function ensureApi() {
    if (!window.BenzyCartApi) {
      throw new Error("Cart API is not available on this page.");
    }

    return window.BenzyCartApi;
  }

  async function syncServerCart(options = {}) {
    if (!isAuthenticated()) {
      return persistGuestCart(getGuestCart(), options);
    }

    const payload = await ensureApi().getCart();
    return persistServerCart(payload?.cart || payload, options);
  }

  async function loadCart(options = {}) {
    migrateLegacyGuestCart();

    if (!isAuthenticated()) {
      return persistGuestCart(getGuestCart(), options);
    }

    const meta = getCacheMeta();
    if (!options.forceServer && meta.mode === "server") {
      const cached = getCachedState();
      currentState = cached;
      return cached;
    }

    try {
      return await syncServerCart(options);
    } catch (error) {
      const cached = getCachedState();
      if (cached.mode === "server" || cached.items.length) {
        return cached;
      }
      throw error;
    }
  }

  async function addItem(rawItem, options = {}) {
    const item = normalizeCartItem(rawItem);
    const itemLabel = item.name || item.title || "Item";

    if (isAuthenticated()) {
      const payload = await ensureApi().addItem(item);
      const state = persistServerCart(payload?.cart || payload, { silent: true });
      if (options.showToast !== false) showToast(`${itemLabel} added to cart.`, "success");
      emitCartUpdated(state);
      return state;
    }

    const nextItems = mergeItems(getGuestCart(), [item]);
    const state = persistGuestCart(nextItems, { silent: true });
    if (options.showToast !== false) showToast(`${itemLabel} added to cart.`, "success");
    emitCartUpdated(state);
    return state;
  }

  async function updateItem(itemId, payload = {}) {
    const rawQuantity = payload.quantity ?? payload.qty;
    const quantity = Number.parseInt(String(rawQuantity ?? 1), 10);

    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new Error("Quantity must be at least 1.");
    }

    if (isAuthenticated()) {
      const apiPayload = await ensureApi().updateItem(itemId, { quantity });
      const state = persistServerCart(apiPayload?.cart || apiPayload, { silent: true });
      emitCartUpdated(state);
      return state;
    }

    let found = false;
    const nextItems = getGuestCart().map((item) => {
      if (String(item.id || "") !== String(itemId || "")) return item;
      found = true;
      return normalizeCartItem({ ...item, quantity, qty: quantity });
    });

    if (!found) {
      throw new Error("Cart item not found.");
    }

    const state = persistGuestCart(nextItems, { silent: true });
    emitCartUpdated(state);
    return state;
  }

  async function removeItem(itemId) {
    if (isAuthenticated()) {
      const payload = await ensureApi().removeItem(itemId);
      const state = persistServerCart(payload?.cart || payload, { silent: true });
      emitCartUpdated(state);
      return state;
    }

    const currentItems = getGuestCart();
    const nextItems = currentItems.filter((item) => String(item.id || "") !== String(itemId || ""));
    if (nextItems.length === currentItems.length) {
      throw new Error("Cart item not found.");
    }

    const state = persistGuestCart(nextItems, { silent: true });
    emitCartUpdated(state);
    return state;
  }

  async function clearCart(options = {}) {
    if (isAuthenticated()) {
      const payload = await ensureApi().clearCart();
      const state = persistServerCart(payload?.cart || payload, { silent: true });
      if (options.showToast) showToast("Your cart has been cleared.", "success");
      emitCartUpdated(state);
      return state;
    }

    const state = persistGuestCart([], { silent: true });
    if (options.showToast) showToast("Your cart has been cleared.", "success");
    emitCartUpdated(state);
    return state;
  }

  async function mergeGuestCartIntoServer(options = {}) {
    if (!isAuthenticated()) {
      return persistGuestCart(getGuestCart(), options);
    }

    const guestItems = getGuestCart();
    if (!guestItems.length) {
      return syncServerCart(options);
    }

    const api = ensureApi();
    let remainingItems = guestItems.slice();
    for (const item of guestItems) {
      await api.addItem(item);
      remainingItems = remainingItems.filter((pendingItem) => String(pendingItem.id || "") !== String(item.id || ""));
      if (remainingItems.length) {
        storageHelper.write(GUEST_CART_KEY, remainingItems);
      } else {
        storageHelper.clear(GUEST_CART_KEY);
      }
    }

    storageHelper.clear(GUEST_CART_KEY);
    const state = await syncServerCart({ silent: true });

    if (!options.silent) {
      showToast("We restored your cart after login.", "success");
      emitCartUpdated(state);
    } else {
      currentState = state;
    }

    return state;
  }

  async function handleAuthenticatedSessionStart(options = {}) {
    if (!isAuthenticated()) {
      return persistGuestCart(getGuestCart(), options);
    }

    if (getGuestCart().length) {
      return mergeGuestCartIntoServer(options);
    }

    return syncServerCart(options);
  }

  function handleLogout(options = {}) {
    storageHelper.clear(GUEST_CART_KEY);
    const state = persistGuestCart([], { silent: true });

    if (!options.silent) emitCartUpdated(state);
    return state;
  }

  function setPostLoginRedirect(path) {
    const safePath = normalizeText(path);
    if (!safePath) return;
    localStorage.setItem(POST_LOGIN_REDIRECT_KEY, safePath);
  }

  function consumePostLoginRedirect() {
    const value = normalizeText(localStorage.getItem(POST_LOGIN_REDIRECT_KEY) || "");
    if (value) localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    return value;
  }

  function migrateLegacyGuestCart() {
    const meta = getCacheMeta();
    if (meta.mode === "server") return;
    if (getGuestCart().length) return;

    const legacyItems = readItemsFromKey(ACTIVE_CART_KEY);
    if (!legacyItems.length) return;

    persistGuestCart(legacyItems, { silent: true });
  }

  function ensureToastStyles() {
    if (document.getElementById("benzy-cart-toast-style")) return;

    const style = document.createElement("style");
    style.id = "benzy-cart-toast-style";
    style.textContent = `
      .benzy-cart-toast-stack {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: grid;
        gap: 10px;
        max-width: min(360px, calc(100vw - 32px));
      }
      .benzy-cart-toast {
        padding: 14px 16px;
        border-radius: 14px;
        color: #ffffff;
        background: #111111;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);
        font: 500 14px/1.45 Inter, sans-serif;
        opacity: 0;
        transform: translateY(-6px);
        transition: opacity 180ms ease, transform 180ms ease;
      }
      .benzy-cart-toast.is-visible {
        opacity: 1;
        transform: translateY(0);
      }
      .benzy-cart-toast[data-state="success"] { background: #173d2a; }
      .benzy-cart-toast[data-state="error"] { background: #6b1f1f; }
      .benzy-cart-toast[data-state="info"] { background: #123b5d; }
      .benzy-cart-toast[data-state="pending"] { background: #59451d; }
    `;
    document.head.appendChild(style);
  }

  function ensureToastElement() {
    ensureToastStyles();

    let host = document.getElementById("benzy-cart-toast-stack");
    if (host) return host;

    host = document.createElement("div");
    host.id = "benzy-cart-toast-stack";
    host.className = "benzy-cart-toast-stack";
    document.body.appendChild(host);
    return host;
  }

  function showToast(message, state = "success") {
    if (!message) return;

    const host = ensureToastElement();
    const toast = document.createElement("div");
    toast.className = "benzy-cart-toast";
    toast.dataset.state = state;
    toast.textContent = String(message);
    host.appendChild(toast);

    window.requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => {
        toast.remove();
      }, 220);
    }, 2600);
  }

  window.addEventListener("storage", function (event) {
    if (!event.key || ![ACTIVE_CART_KEY, GUEST_CART_KEY, CART_META_KEY, TOKEN_KEY].includes(event.key)) return;
    currentState = getCachedState();
  });

  migrateLegacyGuestCart();
  if (!isAuthenticated()) {
    currentState = persistGuestCart(getGuestCart(), { silent: true });
  } else {
    currentState = getCachedState();
    window.setTimeout(() => {
      void handleAuthenticatedSessionStart({ silent: true })
        .then(function (state) {
          emitCartUpdated(state);
        })
        .catch(() => {});
    }, 0);
  }

  window.BenzyCartLocalStorage = storageHelper;
  window.BenzyCartStore = {
    ACTIVE_CART_KEY,
    GUEST_CART_KEY,
    POST_LOGIN_REDIRECT_KEY,
    addItem,
    buildVariantId,
    calculateTotals: buildTotals,
    clearCart,
    clearGuestCart,
    consumePostLoginRedirect,
    getAuthUser,
    getCachedCart,
    getCachedState,
    getGuestCart,
    handleAuthenticatedSessionStart,
    handleLogout,
    isAuthenticated,
    loadCart,
    mergeGuestCartIntoServer,
    normalizeCartItem,
    removeItem,
    setGuestCart,
    setPostLoginRedirect,
    showToast,
    syncServerCart,
    updateItem
  };
})();
