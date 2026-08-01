(function () {
  const store = window.BenzyCartStore;
  const api = window.BenzyCartApi;
  const CURRENCY_KEY = "benzy_currency";
  const COUPON_KEY = "benzy_discount_coupon";
  const STATUS_TIMEOUT_MS = 2600;
  const fallbackCurrencyConfig = {
    USD: { rateFromNgn: 1 / 1376.86, locale: "en-US", currency: "USD" },
    NGN: { rateFromNgn: 1, locale: "en-NG", currency: "NGN" }
  };

  const cartItemsWrap = document.getElementById("cart-items");
  const emptyEl = document.getElementById("cart-empty");
  const subtotalEl = document.getElementById("cart-subtotal");
  const taxEl = document.getElementById("cart-tax");
  const totalEl = document.getElementById("cart-total");
  const checkoutBtn = document.getElementById("checkout-btn");
  const clearCartBtn = document.getElementById("clear-cart-btn");
  const currencySelect = document.getElementById("currency-select");
  const notesToggle = document.getElementById("notes-toggle");
  const notesWrap = document.getElementById("notes-wrap");
  const statusEl = document.getElementById("cart-status");
  const currencyNoticeEl = document.getElementById("cart-currency-notice");
  const shippingThresholdEl = document.getElementById("cart-shipping-threshold");
  const couponInput = document.getElementById("coupon-code");
  const applyCouponBtn = document.getElementById("apply-coupon");
  const couponMessageEl = document.getElementById("coupon-message");
  const FREE_SHIPPING_THRESHOLD_USD = 200;

  if (!cartItemsWrap || !subtotalEl || !taxEl || !totalEl || !store) return;

  let activeCurrency = window.BenzyCurrency?.getSelectedCurrency?.() || localStorage.getItem(CURRENCY_KEY) || "NGN";
  let qtyInputTimers = new Map();
  let statusTimer = 0;

  if (!fallbackCurrencyConfig[activeCurrency]) activeCurrency = "NGN";

  function getCurrencyConfig(code) {
    const normalized = String(code || activeCurrency || "NGN").trim().toUpperCase();
    if (window.BenzyCurrency?.getCurrencyConfig) {
      return window.BenzyCurrency.getCurrencyConfig(normalized);
    }
    return fallbackCurrencyConfig[normalized] || fallbackCurrencyConfig.NGN;
  }

  function convertPriceFromNgn(amountInNgn, targetCurrency) {
    if (window.BenzyCurrency?.convertPrice) {
      return window.BenzyCurrency.convertPrice(amountInNgn, targetCurrency);
    }

    const cfg = getCurrencyConfig(targetCurrency);
    return roundMoney(Number(amountInNgn || 0) * Number(cfg.rateFromNgn || 1));
  }

  function convertAmount(amount, fromCurrency, toCurrency) {
    if (window.BenzyCurrency?.convertAmount) {
      return roundMoney(window.BenzyCurrency.convertAmount(amount, fromCurrency, toCurrency));
    }

    const sourceCode = String(fromCurrency || "NGN").trim().toUpperCase();
    const targetCode = String(toCurrency || "NGN").trim().toUpperCase();
    const numericAmount = Number(amount || 0);
    if (!Number.isFinite(numericAmount)) return 0;
    if (sourceCode === targetCode) return roundMoney(numericAmount);

    const sourceCfg = getCurrencyConfig(sourceCode);
    const targetCfg = getCurrencyConfig(targetCode);
    const amountInNgn = sourceCode === "NGN"
      ? numericAmount
      : numericAmount / Number(sourceCfg.rateFromNgn || 1);

    if (targetCode === "NGN") return roundMoney(amountInNgn);
    return roundMoney(amountInNgn * Number(targetCfg.rateFromNgn || 1));
  }

  function getItemPriceNgn(item) {
    const explicitPriceNgn = Number(item?.priceNgn);
    if (Number.isFinite(explicitPriceNgn) && explicitPriceNgn >= 0) {
      return roundMoney(explicitPriceNgn);
    }

    const directPrice = Number(item?.price);
    if (Number.isFinite(directPrice) && directPrice >= 0) {
      return roundMoney(directPrice);
    }

    const priceUsd = Number(item?.priceUsd ?? 0);
    if (window.BenzyCurrency?.convertAmount) {
      return roundMoney(window.BenzyCurrency.convertAmount(priceUsd, "USD", "NGN"));
    }

    return roundMoney(priceUsd * 1600);
  }

  function getItemStock(item) {
    const stock = Number.parseInt(String(item?.availableStock ?? item?.stockQuantity ?? 0), 10);
    return Number.isFinite(stock) && stock > 0 ? stock : 0;
  }

  function getStockLimitMessage(item) {
    const stock = getItemStock(item);
    const name = String(item?.name || item?.title || "This item").trim();
    if (stock <= 0) return `${name} is currently out of stock. Please remove it or choose another product.`;
    return `${name} has only ${stock} ${stock === 1 ? "piece" : "pieces"} left in stock. Please proceed with ${stock} or choose another product.`;
  }

  function clampQuantityForStock(item, quantity) {
    const stock = getItemStock(item);
    const safeQuantity = Math.max(1, parseInt(String(quantity || 1), 10) || 1);
    return stock > 0 ? Math.min(safeQuantity, stock) : safeQuantity;
  }

  function roundMoney(value) {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return 0;
    return Number(amount.toFixed(2));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatMoney(amountInNgn) {
    if (window.BenzyCurrency?.formatPriceFromNgn) {
      return window.BenzyCurrency.formatPriceFromNgn(amountInNgn, activeCurrency);
    }

    const config = getCurrencyConfig(activeCurrency);
    return new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: config.currency,
      maximumFractionDigits: 2
    }).format(convertPriceFromNgn(amountInNgn, activeCurrency));
  }

  function normalizeOptionLabel(value, prefix, fallback) {
    const raw = String(value || "").trim();
    const cleanPrefix = String(prefix || "").trim();
    const pattern = cleanPrefix ? new RegExp(`^${cleanPrefix}\\s*:\\s*`, "i") : null;
    const cleaned = pattern ? raw.replace(pattern, "").trim() : raw;
    return cleaned || fallback;
  }

  function formatOptionLabel(item, labelKey, displayKey, prefix, fallback) {
    return `${prefix}: ${normalizeOptionLabel(item?.[labelKey] || item?.[displayKey], prefix, fallback)}`;
  }

  function formatCurrencyAmount(amount, currencyCode, options = {}) {
    const code = String(currencyCode || activeCurrency || "NGN").trim().toUpperCase();
    if (window.BenzyCurrency?.formatCurrency) {
      return window.BenzyCurrency.formatCurrency(amount, code, options);
    }

    const config = getCurrencyConfig(code);
    return new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: config.currency,
      minimumFractionDigits: options.minimumFractionDigits,
      maximumFractionDigits: options.maximumFractionDigits ?? 2
    }).format(Number(amount || 0));
  }

  function setStatus(message, state) {
    if (!statusEl) return;

    window.clearTimeout(statusTimer);
    statusEl.textContent = message || "";

    if (state) {
      statusEl.dataset.state = state;
    } else {
      delete statusEl.dataset.state;
    }

    if (!message) return;

    statusTimer = window.setTimeout(() => {
      statusEl.textContent = "";
      delete statusEl.dataset.state;
    }, STATUS_TIMEOUT_MS);
  }

  function readCouponState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(COUPON_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function writeCouponState(state) {
    if (!state || typeof state !== "object") {
      localStorage.removeItem(COUPON_KEY);
      return;
    }

    localStorage.setItem(COUPON_KEY, JSON.stringify(state));
  }

  function clearCouponState() {
    localStorage.removeItem(COUPON_KEY);
  }

  function setCouponMessage(message, state) {
    if (!couponMessageEl) return;

    couponMessageEl.textContent = message || "";
    if (state) {
      couponMessageEl.dataset.state = state;
    } else {
      delete couponMessageEl.dataset.state;
    }
  }

  function setCurrencyNotice(message, state) {
    if (!currencyNoticeEl) return;

    currencyNoticeEl.textContent = message || "";
    if (state) {
      currencyNoticeEl.dataset.state = state;
    } else {
      delete currencyNoticeEl.dataset.state;
    }
  }

  function normalizeCouponCode(value) {
    return String(value || "").trim().toUpperCase();
  }

  function getValidatedCouponForEmail(email) {
    const state = readCouponState();
    const safeEmail = String(email || "").trim().toLowerCase();
    if (!state?.code || state.status !== "validated") return null;
    if (String(state.email || "").trim().toLowerCase() !== safeEmail) return null;
    return state;
  }

  function getCheckoutCurrencySelection() {
    if (window.BenzyCurrency?.getCheckoutCurrencySelection) {
      return window.BenzyCurrency.getCheckoutCurrencySelection(activeCurrency, {
        paymentMethodCode: "paystack"
      });
    }

    return {
      displayCurrency: activeCurrency,
      requestedCheckoutCurrency: activeCurrency,
      chargeCurrency: activeCurrency,
      chargeCurrencyForced: false,
      chargeCurrencyMessage: ""
    };
  }

  function syncCurrencyNotice() {
    const selection = getCheckoutCurrencySelection();
    if (selection?.chargeCurrencyMessage) {
      setCurrencyNotice(selection.chargeCurrencyMessage, "info");
      return;
    }

    if (activeCurrency === "NGN") {
      setCurrencyNotice("Prices and checkout totals are shown in NGN.", "info");
      return;
    }

    setCurrencyNotice(`Prices are shown in ${activeCurrency}. Checkout totals stay in NGN.`, "info");
  }

  function syncShippingThreshold() {
    if (!shippingThresholdEl) return;

    const threshold = convertAmount(FREE_SHIPPING_THRESHOLD_USD, "USD", activeCurrency);
    shippingThresholdEl.textContent = `Free shipping on orders over ${formatCurrencyAmount(threshold, activeCurrency, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;
  }

  async function validateCoupon(code, email) {
    const safeCode = normalizeCouponCode(code);
    const safeEmail = String(email || "").trim().toLowerCase();

    if (!safeCode) {
      throw new Error("Enter your coupon code.");
    }

    if (!safeEmail) {
      throw new Error("Log in to apply your saved coupon.");
    }

    const payload = await api.request("/api/coupons/validate", {
      method: "POST",
      body: {
        email: safeEmail,
        couponCode: safeCode
      }
    });

    if (!payload?.valid) {
      throw new Error(String(payload?.message || "Unable to apply coupon."));
    }

    const state = {
      code: safeCode,
      email: safeEmail,
      status: "validated",
      source: String(payload?.source || "cart"),
      discountPercent: Number(payload?.discountPercent || 10),
      validatedAt: new Date().toISOString()
    };
    writeCouponState(state);
    return state;
  }

  function getDisplayTotals(state) {
    const items = Array.isArray(state?.items) ? state.items : [];
    const subtotalNgn = roundMoney(
      items.reduce((sum, item) => {
        const qty = Math.max(1, parseInt(String(item?.quantity || item?.qty || 1), 10));
        return sum + (getItemPriceNgn(item) * qty);
      }, 0)
    );
    const authUser = store.getAuthUser();
    const coupon = getValidatedCouponForEmail(authUser?.email || "");

    if (!coupon) {
      return {
        subtotal: subtotalNgn,
        tax: roundMoney(subtotalNgn * 0.075),
        total: roundMoney(subtotalNgn * 1.075),
        discount: 0
      };
    }

    const discount = roundMoney(subtotalNgn * (Number(coupon.discountPercent || 10) / 100));
    const discountedSubtotal = roundMoney(Math.max(0, subtotalNgn - discount));
    const tax = roundMoney(discountedSubtotal * 0.075);
    const total = roundMoney(discountedSubtotal + tax);

    return {
      subtotal: subtotalNgn,
      tax,
      total,
      discount,
      coupon
    };
  }

  function createCartItemElement(item) {
    const quantity = Math.max(1, parseInt(String(item.quantity || item.qty || 1), 10));
    const unitPriceNgn = getItemPriceNgn(item);
    const stock = getItemStock(item);
    const visibleQuantity = stock > 0 ? Math.min(quantity, stock) : quantity;
    const lineTotal = roundMoney(unitPriceNgn * visibleQuantity);
    const maxAttr = stock > 0 ? ` max="${stock}"` : "";
    const article = document.createElement("article");

    article.className = "cart-ref-item row";
    article.dataset.itemId = String(item.id || "");
    article.innerHTML = `
      <div class="product-col">
        <img src="${escapeHtml(item.image || "OFF BACK/BENZY LOGO.png")}" alt="${escapeHtml(item.alt || item.name || item.title || "Product")}">
        <div class="product-meta">
          <h3>${escapeHtml(item.name || item.title || "Product")}</h3>
          <p>${escapeHtml(formatOptionLabel(item, "colorLabel", "color", "Color", "Standard"))}</p>
          <p>${escapeHtml(formatOptionLabel(item, "sizeLabel", "size", "Size", "M"))}</p>
        </div>
      </div>

      <div class="price-col">
        <strong>${formatMoney(unitPriceNgn)}</strong>
      </div>

      <div class="qty-col">
        <div class="qty-box">
          <button class="qty-btn qty-minus" type="button" aria-label="Decrease quantity">-</button>
          <input class="qty-input" type="number" min="1"${maxAttr} value="${visibleQuantity}" aria-label="Quantity" />
          <button class="qty-btn qty-plus" type="button" aria-label="Increase quantity"${stock > 0 && visibleQuantity >= stock ? " disabled" : ""}>+</button>
        </div>
        <button class="remove-link cart-remove" type="button" aria-label="Remove item">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"></path>
          </svg>
        </button>
      </div>

      <div class="total-col">
        <strong>${formatMoney(lineTotal)}</strong>
      </div>
    `;

    return article;
  }

  function renderCart(state) {
    const items = Array.isArray(state?.items) ? state.items : [];
    const totals = getDisplayTotals(state);

    cartItemsWrap.innerHTML = "";
    items.forEach((item) => {
      cartItemsWrap.appendChild(createCartItemElement(item));
    });

    if (emptyEl) {
      emptyEl.hidden = items.length !== 0;
    }

    subtotalEl.textContent = formatMoney(totals.subtotal);
    taxEl.textContent = formatMoney(totals.tax);
    totalEl.textContent = formatMoney(totals.total);

    if (checkoutBtn instanceof HTMLButtonElement) {
      checkoutBtn.disabled = items.length === 0;
    }
    if (clearCartBtn instanceof HTMLButtonElement) {
      clearCartBtn.disabled = items.length === 0;
    }

    syncShippingThreshold();
    syncCurrencyNotice();
  }

  async function refreshCart(options = {}) {
    if (options.showLoading) {
      setStatus("Loading your cart...", "pending");
    }

    try {
      const state = await store.loadCart({ forceServer: Boolean(options.forceServer), silent: true });
      renderCart(state);
      if (options.showLoading) setStatus("");
      return state;
    } catch (error) {
      renderCart(store.getCachedState());
      setStatus(String(error?.message || "Unable to load your cart right now."), "error");
      return store.getCachedState();
    }
  }

  async function syncCouponUi() {
    const state = readCouponState();
    const authUser = store.getAuthUser();
    const email = authUser?.email || "";

    if (couponInput instanceof HTMLInputElement && state?.code && !couponInput.value.trim()) {
      couponInput.value = String(state.code);
    }

    if (!state?.code) {
      setCouponMessage("", "");
      renderCart(store.getCachedState());
      return;
    }

    if (!email) {
      setCouponMessage("Code saved. Log in at checkout to apply it.", "info");
      renderCart(store.getCachedState());
      return;
    }

    if (getValidatedCouponForEmail(email)) {
      setCouponMessage("Coupon applied to your cart total.", "success");
      renderCart(store.getCachedState());
      return;
    }

    try {
      const coupon = await validateCoupon(state.code, email);
      setCouponMessage(`Coupon applied. ${Number(coupon.discountPercent || 10)}% off is ready for checkout.`, "success");
    } catch (error) {
      clearCouponState();
      setCouponMessage(String(error?.message || "Unable to apply coupon."), "error");
    }

    renderCart(store.getCachedState());
  }

  cartItemsWrap.addEventListener("click", async function (event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const itemEl = target.closest("[data-item-id]");
    if (!(itemEl instanceof HTMLElement)) return;

    const itemId = String(itemEl.dataset.itemId || "").trim();
    if (!itemId) return;

    const currentItem = store.getCachedCart().find((item) => String(item.id || "") === itemId);
    if (!currentItem) return;

    try {
      if (target.closest(".qty-plus")) {
        const nextQuantity = Math.max(1, parseInt(String(currentItem.quantity || currentItem.qty || 1), 10) + 1);
        const cappedQuantity = clampQuantityForStock(currentItem, nextQuantity);
        if (cappedQuantity < nextQuantity) {
          setStatus(getStockLimitMessage(currentItem), "error");
          renderCart(store.getCachedState());
          return;
        }
        setStatus("Updating quantity...", "pending");
        const state = await store.updateItem(itemId, { quantity: cappedQuantity });
        renderCart(state);
        setStatus("Cart updated.", "success");
        return;
      }

      if (target.closest(".qty-minus")) {
        setStatus("Updating quantity...", "pending");
        const nextQuantity = Math.max(1, parseInt(String(currentItem.quantity || currentItem.qty || 1), 10) - 1);
        const state = await store.updateItem(itemId, { quantity: nextQuantity });
        renderCart(state);
        setStatus("Cart updated.", "success");
        return;
      }

      if (target.closest(".cart-remove")) {
        setStatus("Removing item...", "pending");
        const state = await store.removeItem(itemId);
        renderCart(state);
        setStatus("Item removed.", "success");
      }
    } catch (error) {
      setStatus(String(error?.message || "Unable to update your cart."), "error");
    }
  });

  cartItemsWrap.addEventListener("input", function (event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains("qty-input")) return;

    const itemEl = target.closest("[data-item-id]");
    if (!(itemEl instanceof HTMLElement)) return;

    const itemId = String(itemEl.dataset.itemId || "").trim();
    const currentItem = store.getCachedCart().find((item) => String(item.id || "") === itemId);
    const requestedQuantity = Math.max(1, parseInt(String(target.value || 1), 10) || 1);
    const quantity = currentItem ? clampQuantityForStock(currentItem, requestedQuantity) : requestedQuantity;
    target.value = String(quantity);
    if (currentItem && quantity < requestedQuantity) {
      setStatus(getStockLimitMessage(currentItem), "error");
    }

    const existingTimer = qtyInputTimers.get(itemId);
    if (existingTimer) window.clearTimeout(existingTimer);

    qtyInputTimers.set(
      itemId,
      window.setTimeout(async function () {
        try {
          setStatus("Updating quantity...", "pending");
          const state = await store.updateItem(itemId, { quantity });
          renderCart(state);
          setStatus("Cart updated.", "success");
        } catch (error) {
          setStatus(String(error?.message || "Unable to update your cart."), "error");
          renderCart(store.getCachedState());
        } finally {
          qtyInputTimers.delete(itemId);
        }
      }, 260)
    );
  });

  if (clearCartBtn instanceof HTMLButtonElement) {
    clearCartBtn.addEventListener("click", async function () {
      try {
        setStatus("Clearing your cart...", "pending");
        const state = await store.clearCart({ showToast: false });
        renderCart(state);
        setStatus("Your cart is now empty.", "success");
      } catch (error) {
        setStatus(String(error?.message || "Unable to clear your cart."), "error");
      }
    });
  }

  if (currencySelect instanceof HTMLSelectElement) {
    currencySelect.value = activeCurrency;
    currencySelect.addEventListener("change", function () {
      activeCurrency = window.BenzyCurrency?.setSelectedCurrency?.(currencySelect.value) || currencySelect.value;
      localStorage.setItem(CURRENCY_KEY, activeCurrency);
      renderCart(store.getCachedState());
    });
  }

  if (notesToggle && notesWrap) {
    notesToggle.addEventListener("click", function () {
      const isHidden = notesWrap.hasAttribute("hidden");
      if (isHidden) {
        notesWrap.removeAttribute("hidden");
        return;
      }
      notesWrap.setAttribute("hidden", "");
    });
  }

  if (applyCouponBtn instanceof HTMLButtonElement && couponInput instanceof HTMLInputElement) {
    applyCouponBtn.addEventListener("click", async function () {
      const code = normalizeCouponCode(couponInput.value);
      const authUser = store.getAuthUser();

      if (!code) {
        clearCouponState();
        setCouponMessage("Enter your coupon code.", "error");
        renderCart(store.getCachedState());
        return;
      }

      couponInput.value = code;

      if (!authUser?.email) {
        writeCouponState({
          code,
          email: "",
          status: "saved",
          source: "cart",
          discountPercent: 10,
          savedAt: new Date().toISOString()
        });
        setCouponMessage("Code saved. Log in at checkout to apply it.", "info");
        renderCart(store.getCachedState());
        return;
      }

      applyCouponBtn.disabled = true;
      setCouponMessage("Checking coupon...", "pending");

      try {
        const coupon = await validateCoupon(code, authUser.email);
        setCouponMessage(`Coupon applied. ${Number(coupon.discountPercent || 10)}% off is ready for checkout.`, "success");
      } catch (error) {
        clearCouponState();
        setCouponMessage(String(error?.message || "Unable to apply coupon."), "error");
      } finally {
        applyCouponBtn.disabled = false;
        renderCart(store.getCachedState());
      }
    });
  }

  if (checkoutBtn instanceof HTMLButtonElement) {
    checkoutBtn.addEventListener("click", function () {
      const state = store.getCachedState();
      if (!state.items.length) {
        setStatus("Your cart is empty.", "error");
        return;
      }

      if (!store.isAuthenticated()) {
        store.setPostLoginRedirect("Checkout.html");
        store.showToast("Log in to continue checkout.", "info");
        window.location.href = "Profile.html";
        return;
      }

      window.location.href = "Checkout.html";
    });
  }

  window.addEventListener("storage", function (event) {
    if (event.key === CURRENCY_KEY) {
      activeCurrency = window.BenzyCurrency?.getSelectedCurrency?.() || localStorage.getItem(CURRENCY_KEY) || "NGN";
      if (currencySelect instanceof HTMLSelectElement) {
        currencySelect.value = activeCurrency;
      }
      renderCart(store.getCachedState());
      return;
    }

    if ([COUPON_KEY, store.ACTIVE_CART_KEY, store.GUEST_CART_KEY].includes(event.key || "")) {
      renderCart(store.getCachedState());
      void syncCouponUi();
    }
  });

  window.addEventListener("benzy:cart-updated", function (event) {
    const state = event.detail && typeof event.detail === "object" ? event.detail : store.getCachedState();
    renderCart(state);
  });

  window.addEventListener("benzy:currency-updated", function () {
    activeCurrency = window.BenzyCurrency?.getSelectedCurrency?.() || localStorage.getItem(CURRENCY_KEY) || "NGN";
    if (currencySelect instanceof HTMLSelectElement) {
      currencySelect.value = activeCurrency;
    }
    renderCart(store.getCachedState());
  });

  void refreshCart({ showLoading: true, forceServer: store.isAuthenticated() }).then(() => {
    void syncCouponUi();
  });
})();
