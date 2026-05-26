(function () {
  const API_BASE_STORAGE_KEY = "benzy_api_base";
  const ADMIN_TOKEN_KEY = "benzy_admin_auth_token";
  const LOGIN_INTENT_KEY = "benzy_login_intent";
  const SECTION_TITLES = {
    dashboard: { kicker: "Overview", title: "Business health at a glance", permission: "dashboard" },
    products: { kicker: "Catalog", title: "Catalog, stock and visibility", permission: "products" },
    orders: { kicker: "Orders", title: "Orders, fulfilment and payment flow", permission: "orders" },
    customers: { kicker: "Customers", title: "Buyer relationships and support actions", permission: "customers" },
    messages: { kicker: "Messages", title: "Contact inbox, follow-up and replies", permission: "messages" },
    payments: { kicker: "Payments", title: "Verified, failed, refunded and wallet records", permission: "payments" },
    coupons: { kicker: "Discounts", title: "Campaigns, thresholds and coupon controls", permission: "coupons" },
    settings: { kicker: "Settings", title: "Shipping fees, security and activity logs", permission: "settings" },
    content: { kicker: "Content", title: "Edit what visitors see across the site", permission: "content" },
    newsletter: { kicker: "Newsletter", title: "Subscribers, exports and announcements", permission: "newsletter" },
    reviews: { kicker: "Reviews", title: "Approve, reject and feature testimonials", permission: "reviews" },
    team: { kicker: "Admin Users", title: "Roles and back office access control", permission: "users" }
  };
  const PERMISSIONS_BY_ROLE = {
    super_admin: ["dashboard", "products", "orders", "customers", "messages", "payments", "coupons", "settings", "content", "newsletter", "reviews", "users", "logs"],
    product_manager: ["dashboard", "products", "coupons", "content"],
    order_manager: ["dashboard", "orders", "payments", "settings"],
    customer_support_admin: ["dashboard", "orders", "customers", "messages", "newsletter", "reviews"]
  };

  const state = {
    user: null,
    permissions: new Set(),
    activeSection: "dashboard",
    overview: null,
    products: [],
    orders: [],
    customers: [],
    messages: { messages: [], summary: {} },
    payments: { payments: [], summary: {} },
    coupons: [],
    settings: null,
    content: null,
    newsletter: null,
    reviews: [],
    users: [],
    logs: [],
    loaded: {},
    sessionTimeoutHandle: null
  };

  const nodes = {
    sidebar: document.getElementById("admin-sidebar"),
    nav: document.getElementById("admin-nav"),
    pageKicker: document.getElementById("admin-page-kicker"),
    pageTitle: document.getElementById("admin-page-title"),
    userName: document.getElementById("admin-user-name"),
    userRole: document.getElementById("admin-user-role"),
    logoutBtn: document.getElementById("admin-logout-btn"),
    mobileNavBtn: document.getElementById("admin-mobile-nav-btn"),
    sessionPill: document.getElementById("admin-session-pill"),
    time: document.getElementById("admin-time"),
    flash: document.getElementById("admin-flash"),
    sections: Array.from(document.querySelectorAll(".admin-section")),
    refreshDashboardBtn: document.getElementById("refresh-dashboard-btn"),
    dashboardMetrics: document.getElementById("dashboard-metrics"),
    dashboardAlerts: document.getElementById("dashboard-alerts"),
    dashboardTransactions: document.getElementById("dashboard-transactions"),
    dashboardDailySales: document.getElementById("dashboard-daily-sales"),
    dashboardBestSellers: document.getElementById("dashboard-best-sellers"),
    dashboardTopCustomers: document.getElementById("dashboard-top-customers"),
    productForm: document.getElementById("product-form"),
    productFormReset: document.getElementById("product-form-reset"),
    productEditorState: document.getElementById("product-editor-state"),
    productSubmitBtn: document.getElementById("product-submit-btn"),
    productSkuGenerateBtn: document.getElementById("product-sku-generate-btn"),
    productImageUpload: document.getElementById("product-image-upload"),
    productsSummary: document.getElementById("products-summary"),
    productsGrid: document.getElementById("products-grid"),
    ordersSummary: document.getElementById("orders-summary"),
    ordersAutomation: document.getElementById("orders-automation"),
    ordersList: document.getElementById("orders-list"),
    customersList: document.getElementById("customers-list"),
    messagesSummary: document.getElementById("messages-summary"),
    messagesAutomation: document.getElementById("messages-automation"),
    messagesList: document.getElementById("messages-list"),
    paymentsSummary: document.getElementById("payments-summary"),
    paymentsList: document.getElementById("payments-list"),
    couponForm: document.getElementById("coupon-form"),
    couponCodeGenerateBtn: document.getElementById("coupon-code-generate-btn"),
    couponsSummary: document.getElementById("coupons-summary"),
    couponsAutomation: document.getElementById("coupons-automation"),
    couponsList: document.getElementById("coupons-list"),
    settingsForm: document.getElementById("settings-form"),
    activityLogs: document.getElementById("activity-logs"),
    logArchiveStatus: document.getElementById("log-archive-status"),
    contentForm: document.getElementById("content-form"),
    newsletterForm: document.getElementById("newsletter-form"),
    exportSubscribersBtn: document.getElementById("export-subscribers-btn"),
    newsletterSummary: document.getElementById("newsletter-summary"),
    subscribersList: document.getElementById("subscribers-list"),
    reviewForm: document.getElementById("review-form"),
    reviewsList: document.getElementById("reviews-list"),
    teamList: document.getElementById("team-list")
  };

  const root = document.documentElement;
  let scrollbarHideTimer = 0;

  function showScrollbars() {
    if (!(root instanceof HTMLElement)) return;
    root.classList.add("bl-scrollbars-visible");
    window.clearTimeout(scrollbarHideTimer);
    scrollbarHideTimer = window.setTimeout(function () {
      root.classList.remove("bl-scrollbars-visible");
    }, 900);
  }

  document.addEventListener("scroll", showScrollbars, { capture: true, passive: true });
  document.addEventListener("wheel", showScrollbars, { passive: true });
  document.addEventListener("touchmove", showScrollbars, { passive: true });
  document.addEventListener("keydown", function (event) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
      showScrollbars();
    }
  });

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeHtmlWithBreaks(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function emptyState(message) {
    return `<div class="admin-empty">${escapeHtml(message)}</div>`;
  }

  function normalizeAssetUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "/OFF BACK/BLX.png";
    if (/^(https?:|data:|blob:|\/)/i.test(raw)) return raw;
    return `/${raw.replace(/^\.?\/*/, "")}`;
  }

  function getToken() {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  }

  function setToken(value) {
    localStorage.setItem(ADMIN_TOKEN_KEY, value || "");
  }

  function clearSession() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.setItem(LOGIN_INTENT_KEY, "host");
  }

  function redirectToLogin() {
    clearSession();
    window.location.href = "/Admin.html";
  }

  function getApiBases() {
    const bases = [];
    const stored = localStorage.getItem(API_BASE_STORAGE_KEY);
    const origin = window.location.origin;
    bases.push("https://benzy-luxury-website.onrender.com");
    if (stored && stored !== origin) bases.push(stored);
    return Array.from(new Set(bases));
  }

  async function api(path, options) {
    const requestOptions = options || {};
    const token = getToken();
    let lastError = null;

    const attemptedBases = getApiBases();
    for (const base of attemptedBases) {
      try {
        const headers = {
          "Content-Type": "application/json",
          ...(requestOptions.headers || {})
        };
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(`${base}${path}`, {
          method: requestOptions.method || "GET",
          headers,
          body: requestOptions.body || undefined
        });
        const data = await response.json().catch(function () {
          return null;
        });
        if (!response.ok) {
          throw new Error(data?.error || data?.message || "Request failed.");
        }
        localStorage.setItem(API_BASE_STORAGE_KEY, base);
        return data;
      } catch (error) {
        lastError = error;
        if (localStorage.getItem(API_BASE_STORAGE_KEY) === base) {
          localStorage.removeItem(API_BASE_STORAGE_KEY);
        }
      }
    }

    throw new Error(`${lastError?.message || "Unable to reach the admin API."} Tried: ${attemptedBases.join(", ")}`);
  }

  async function downloadAdminFile(path, filename) {
    const token = getToken();
    let lastError = null;
    for (const base of getApiBases()) {
      try {
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(`${base}${path}`, { headers });
        if (!response.ok) {
          const data = await response.json().catch(function () { return null; });
          throw new Error(data?.error || data?.message || "Download failed.");
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        localStorage.setItem(API_BASE_STORAGE_KEY, base);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Unable to download file.");
  }

  function formatCurrency(value, currency) {
    const amount = Number(value || 0);
    const safeCurrency = String(currency || "NGN").toUpperCase();
    try {
      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: safeCurrency,
        maximumFractionDigits: 2
      }).format(Number.isFinite(amount) ? amount : 0);
    } catch (_error) {
      return `${safeCurrency} ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
    }
  }

  function formatDate(value) {
    if (!value) return "Not set";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatShortDate(value) {
    if (!value) return "Not set";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function titleCase(value) {
    return String(value || "")
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }

  function normalizeOrderStatusValue(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (["pending", "pending verification", "pending_verification", "awaiting_confirmation"].includes(raw)) return "pending";
    if (["placed", "confirmed", "processing", "shipped", "delivered", "cancelled", "failed"].includes(raw)) return raw;
    return "pending";
  }

  function normalizePaymentStatusValue(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (["paid", "success", "successful"].includes(raw)) return "paid";
    if (["failed", "error", "abandoned"].includes(raw)) return "failed";
    if (raw === "refunded") return "refunded";
    return "pending";
  }

  function normalizePaymentMethodValue(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (["bank", "bank transfer", "bank_transfer"].includes(raw)) return "bank_transfer";
    if (["card", "card payment"].includes(raw)) return "card";
    if (["apple pay", "apple_pay", "applepay"].includes(raw)) return "apple_pay";
    if (["paystack", "flutterwave", "wallet"].includes(raw)) return raw;
    return raw || "unknown";
  }

  function isBankTransferOrder(order) {
    return normalizePaymentMethodValue(order?.paymentMethodCode || order?.paymentMethod) === "bank_transfer";
  }

  function canConfirmBankTransfer(order) {
    if (typeof order?.canConfirmBankTransfer === "boolean") {
      return order.canConfirmBankTransfer;
    }
    const paymentStatus = normalizePaymentStatusValue(order?.paymentStatus);
    const orderStatus = normalizeOrderStatusValue(order?.orderStatus || order?.status);
    return isBankTransferOrder(order)
      && paymentStatus !== "paid"
      && paymentStatus !== "refunded"
      && orderStatus !== "cancelled"
      && orderStatus !== "failed";
  }

  function addDaysIso(value, days) {
    const base = value ? new Date(value) : new Date();
    if (Number.isNaN(base.getTime())) return "";
    base.setDate(base.getDate() + days);
    return base.toISOString().slice(0, 10);
  }

  function getAutoEstimatedDelivery(order) {
    const explicit = String(order?.estimatedDelivery || "").trim();
    if (explicit) return explicit;
    const orderStatus = normalizeOrderStatusValue(order?.orderStatus || order?.status);
    const baseDate = String(order?.orderDate || order?.createdAt || new Date().toISOString()).trim();
    if (["cancelled", "failed"].includes(orderStatus)) return "";
    if (orderStatus === "shipped") return addDaysIso(new Date().toISOString().slice(0, 10), 3);
    return addDaysIso(baseDate, 7);
  }

  function getOrderAutomationState(order) {
    const paymentStatus = normalizePaymentStatusValue(order?.paymentStatus);
    const paymentMethodCode = normalizePaymentMethodValue(order?.paymentMethodCode || order?.paymentMethod);
    const paymentMethodLabel = titleCase(order?.paymentMethod || paymentMethodCode || "payment");
    const confirmedAt = order?.metadata?.bankTransferConfirmedAt || order?.paidAt || null;
    const automation = order?.automation && typeof order.automation === "object" ? order.automation : null;

    if (paymentStatus === "paid") {
      return {
        mode: "is-paid",
        heading: automation?.title || (paymentMethodCode === "bank_transfer" ? "Transfer already confirmed" : "Payment captured automatically"),
        body: automation?.description || (paymentMethodCode === "bank_transfer"
          ? "This bank transfer is already confirmed. You can move straight into fulfilment and customer updates."
          : `${paymentMethodLabel} already marked this order as paid, so payment stays locked while you manage fulfilment only.`),
        caption: confirmedAt ? `Paid ${formatShortDate(confirmedAt)}` : "Payment locked",
        canConfirm: false
      };
    }

    if (paymentStatus === "refunded") {
      return {
        mode: "is-refunded",
        heading: automation?.title || "Refund recorded",
        body: automation?.description || "This order payment has already been refunded. Payment state is locked and no further transfer confirmation is needed.",
        caption: "Refund handled",
        canConfirm: false
      };
    }

    if (paymentStatus === "failed") {
      return {
        mode: "is-blocked",
        heading: automation?.title || "Payment failed",
        body: automation?.description || "Keep the order out of fulfilment until a new successful payment comes in. The system manages the payment state here.",
        caption: "Waiting for a fresh payment",
        canConfirm: false
      };
    }

    if (paymentMethodCode === "bank_transfer") {
      return {
        mode: "is-review",
        heading: automation?.title || "Awaiting bank transfer review",
        body: automation?.description || "This is the only payment flow that may need a one-time host confirmation. Once confirmed, payment locks to paid and the order moves into processing automatically.",
        caption: "One-time host action",
        canConfirm: true
      };
    }

    return {
      mode: "is-automatic",
      heading: automation?.title || "Waiting for gateway update",
      body: automation?.description || `${paymentMethodLabel} is still controlling this payment state automatically. There is nothing to reconfirm from the admin side.`,
      caption: "System-managed",
      canConfirm: false
    };
  }

  function getOrderFulfilmentState(order) {
    const orderStatus = normalizeOrderStatusValue(order?.orderStatus || order?.status);
    const paymentStatus = normalizePaymentStatusValue(order?.paymentStatus);
    const manualOverrideAt = String(order?.metadata?.manualOverrideAt || "").trim();
    const manualOverrideBy = String(order?.metadata?.manualOverrideBy || "").trim();
    const actions = [];
    let title = "Waiting for payment";
    let body = "The system will move this order into processing after payment is confirmed.";
    let mode = "waiting";

    if (paymentStatus === "failed") {
      title = "Payment failed";
      body = "Fulfilment is paused until a successful payment arrives.";
      mode = "blocked";
    } else if (paymentStatus === "refunded") {
      title = "Refund completed";
      body = "This order is closed because the payment has already been refunded.";
      mode = "closed";
    } else if (["cancelled", "failed"].includes(orderStatus)) {
      title = orderStatus === "cancelled" ? "Order cancelled" : "Order failed";
      body = "This order is closed and no further fulfilment action is available.";
      mode = "closed";
    } else if (orderStatus === "delivered") {
      title = "Delivered";
      body = "The order lifecycle is complete. Payment and fulfilment are now locked.";
      mode = "completed";
    } else if (orderStatus === "shipped") {
      title = "In transit";
      body = "The parcel is already out. Your next fulfilment action is to mark it delivered.";
      mode = "active";
      actions.push({ action: "deliver-order", label: "Mark delivered" });
    } else if (paymentStatus === "paid") {
      title = "Ready for dispatch";
      body = "Payment has already cleared, so the system keeps the order in processing until you mark it shipped.";
      mode = "active";
      actions.push({ action: "ship-order", label: "Mark shipped" });
      actions.push({ action: "cancel-order", label: "Cancel order" });
    } else if (canConfirmBankTransfer(order)) {
      title = "Awaiting transfer review";
      body = "The order will move into processing automatically after the bank transfer is confirmed.";
      mode = "review";
    }

    if (manualOverrideAt) {
      body = `${body} Manual override was last applied on ${formatShortDate(manualOverrideAt)}${manualOverrideBy ? ` by ${manualOverrideBy}` : ""}.`;
    }

    return {
      title,
      body,
      mode,
      actions,
      estimatedDelivery: getAutoEstimatedDelivery(order),
      manualOverrideAt,
      manualOverrideBy
    };
  }

  function getMessageWorkflowState(message) {
    const workflow = message?.workflow && typeof message.workflow === "object" ? message.workflow : null;
    if (workflow) {
      return {
        status: workflow.status || String(message?.status || "new").trim().toLowerCase() || "new",
        mode: workflow.mode || "new",
        title: workflow.title || "Fresh inbox item",
        body: workflow.body || "This message is waiting for follow-up.",
        hasInternalNote: workflow.hasInternalNote === true,
        systemTriaged: workflow.systemTriaged === true,
        supportDeliveredCount: Number(workflow.supportDeliveredCount || 0),
        senderAcknowledged: workflow.senderAcknowledged === true,
        whatsappReady: workflow.whatsappReady === true,
        whatsappSent: workflow.whatsappSent === true
      };
    }

    const supportDeliveredCount = Array.isArray(message?.delivery?.email?.supportDelivered)
      ? message.delivery.email.supportDelivered.length
      : 0;
    const senderAcknowledged = message?.delivery?.email?.senderAcknowledged === true;
    const whatsappReady = message?.delivery?.whatsapp?.ready === true;
    const whatsappSent = message?.delivery?.whatsapp?.sent === true;
    const hasInternalNote = Boolean(String(message?.internalNote || "").trim());
    const systemTriaged = supportDeliveredCount > 0 || senderAcknowledged || whatsappReady || whatsappSent;
    const requestedStatus = String(message?.status || "").trim().toLowerCase();

    if (requestedStatus === "resolved") {
      return {
        status: "resolved",
        mode: "resolved",
        title: "Conversation resolved",
        body: "The thread is closed for now. Reopen it only if the customer needs another follow-up.",
        hasInternalNote,
        systemTriaged,
        supportDeliveredCount,
        senderAcknowledged,
        whatsappReady,
        whatsappSent
      };
    }

    if (hasInternalNote) {
      return {
        status: "in_progress",
        mode: "owned",
        title: "Host follow-up in progress",
        body: "A private note already exists, so this conversation is being actively handled.",
        hasInternalNote,
        systemTriaged,
        supportDeliveredCount,
        senderAcknowledged,
        whatsappReady,
        whatsappSent
      };
    }

    if (systemTriaged) {
      return {
        status: "in_progress",
        mode: "triaged",
        title: "System triaged and routed",
        body: "Support delivery and acknowledgement signals have already moved this message into the working queue automatically.",
        hasInternalNote,
        systemTriaged,
        supportDeliveredCount,
        senderAcknowledged,
        whatsappReady,
        whatsappSent
      };
    }

    return {
      status: "new",
      mode: "new",
      title: "Fresh inbox item",
      body: "This message is still new and has not picked up any follow-up activity yet.",
      hasInternalNote,
      systemTriaged,
      supportDeliveredCount,
      senderAcknowledged,
      whatsappReady,
      whatsappSent
    };
  }

  function getPermissionsForUser(user) {
    const role = String(user?.adminRole || "super_admin").trim().toLowerCase();
    return new Set(PERMISSIONS_BY_ROLE[role] || PERMISSIONS_BY_ROLE.super_admin);
  }

  function buildResolvedMessageFlash(messageRecord) {
    const resolved = messageRecord?.delivery?.resolved || {};
    const sent = [
      resolved.emailSent ? "email" : "",
      resolved.whatsappSent ? "WhatsApp" : ""
    ].filter(Boolean);
    if (sent.length) {
      return `Message resolved. Customer notified by ${sent.join(" and ")}.`;
    }
    if (resolved.emailSkipped || resolved.whatsappSkipped) {
      return "Message resolved. Customer notice was skipped by their notification settings or missing contact details.";
    }
    if (resolved.emailError || resolved.whatsappError) {
      return "Message resolved. Customer notice could not be delivered right now.";
    }
    return "Message resolved.";
  }

  function hasPermission(permission) {
    return state.permissions.has(permission);
  }

  function showFlash(message, isError) {
    if (!(nodes.flash instanceof HTMLElement)) return;
    if (!message) {
      nodes.flash.hidden = true;
      nodes.flash.textContent = "";
      return;
    }
    nodes.flash.hidden = false;
    nodes.flash.textContent = message;
    nodes.flash.style.background = isError ? "rgba(201, 82, 59, 0.12)" : "rgba(31, 122, 81, 0.12)";
    nodes.flash.style.borderColor = isError ? "rgba(201, 82, 59, 0.18)" : "rgba(31, 122, 81, 0.18)";
    nodes.flash.style.color = isError ? "#c9523b" : "#1f7a51";
    window.clearTimeout(showFlash._timer);
    showFlash._timer = window.setTimeout(function () {
      showFlash("");
    }, 4000);
  }

  function setLogArchiveStatus(message, isError) {
    if (!(nodes.logArchiveStatus instanceof HTMLElement)) return;
    nodes.logArchiveStatus.textContent = message || "";
    nodes.logArchiveStatus.dataset.state = message ? (isError ? "error" : "success") : "";
  }

  function updateTopbar(section) {
    const copy = SECTION_TITLES[section] || SECTION_TITLES.dashboard;
    if (nodes.pageKicker) nodes.pageKicker.textContent = copy.kicker;
    if (nodes.pageTitle) nodes.pageTitle.textContent = copy.title;
  }

  function updateClock() {
    if (!(nodes.time instanceof HTMLElement)) return;
    nodes.time.textContent = new Date().toLocaleString("en-NG", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function renderMetricCards(target, cards) {
    if (!(target instanceof HTMLElement)) return;
    if (!Array.isArray(cards) || !cards.length) {
      target.innerHTML = emptyState("No metrics available yet.");
      return;
    }
    target.innerHTML = cards.map(function (card) {
      const tagName = card.action ? "button" : "article";
      const typeAttr = card.action ? ' type="button"' : "";
      const actionAttr = card.action ? ` data-metric-action="${escapeHtml(card.action)}"` : "";
      return `
        <${tagName} class="admin-metric${card.action ? " admin-metric-link" : ""}"${typeAttr}${actionAttr}>
          <p>${escapeHtml(card.label)}</p>
          <strong>${escapeHtml(card.value)}</strong>
          <span class="admin-muted-note">${escapeHtml(card.note || "")}</span>
        </${tagName}>
      `;
    }).join("");
  }

  function getField(form, name) {
    return form?.elements?.namedItem(name) || null;
  }

  function getFieldValue(form, name) {
    const field = getField(form, name);
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
      return field.value;
    }
    return "";
  }

  function getSkuWords(value) {
    const cleaned = String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim();
    return cleaned
      .split(/\s+/)
      .filter(Boolean)
      .filter(function (word) {
        return !["BLX", "BENZY", "BENZYLUX", "BENZYLUXURY", "LUXURY"].includes(word);
      });
  }

  function buildSkuCode(value, fallback, maxLength) {
    const words = getSkuWords(value);
    if (!words.length) return fallback;
    const code = words.length === 1
      ? words[0].slice(0, maxLength)
      : words.slice(0, 3).map(function (word) { return word.charAt(0); }).join("");
    return code.slice(0, maxLength) || fallback;
  }

  function getSkuSequenceNumber(value) {
    const raw = String(value || "").trim().toUpperCase();
    const modernMatch = raw.match(/^BLX-[A-Z0-9]+-(\d{1,5})-[A-Z0-9]+$/);
    if (modernMatch) return Number.parseInt(modernMatch[1], 10);
    const legacyMatch = raw.match(/^BLX-(\d{1,5})$/);
    if (legacyMatch) return Number.parseInt(legacyMatch[1], 10);
    return 0;
  }

  function getNextSkuSequence() {
    const maxSequence = state.products.reduce(function (max, product) {
      const fromSku = getSkuSequenceNumber(product?.sku);
      const fromProductId = getSkuSequenceNumber(product?.productId);
      return Math.max(max, fromSku, fromProductId);
    }, 0);
    return String(maxSequence + 1).padStart(3, "0");
  }

  function getRandomChar(chars) {
    if (window.crypto?.getRandomValues) {
      const buffer = new Uint32Array(1);
      window.crypto.getRandomValues(buffer);
      return chars[buffer[0] % chars.length];
    }
    return chars[Math.floor(Math.random() * chars.length)];
  }

  function getSkuRandomCode() {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const numbers = "23456789";
    const mixed = `${letters}${numbers}`;
    return `${getRandomChar(letters)}${getRandomChar(numbers)}${getRandomChar(mixed)}`;
  }

  function generateProductSku(form) {
    const categoryCode = buildSkuCode(getFieldValue(form, "categoryName"), "GEN", 3);
    return `BLX-${categoryCode}-${getNextSkuSequence()}-${getSkuRandomCode()}`;
  }

  function getRandomCodeToken(length) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let token = "";
    for (let index = 0; index < length; index += 1) {
      token += getRandomChar(chars);
    }
    return token;
  }

  function generateCouponCode(form) {
    const discountValue = Math.max(0, Math.round(Number(getFieldValue(form, "discountValue") || 0)));
    const discountType = getFieldValue(form, "discountType") === "fixed" ? "NGN" : "OFF";
    const base = discountValue > 0 && discountValue < 1000
      ? `BLX${discountValue}${discountType}`
      : `BLX${getRandomCodeToken(5)}`;
    const existingCodes = new Set((Array.isArray(state.coupons) ? state.coupons : []).map(function (coupon) {
      return String(coupon?.code || "").trim().toUpperCase();
    }));

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = `${base}${getRandomCodeToken(2)}`;
      if (!existingCodes.has(code)) return code;
    }

    return `BLX${getRandomCodeToken(7)}`;
  }

  function getFieldChecked(form, name) {
    const field = getField(form, name);
    return field instanceof HTMLInputElement ? field.checked : false;
  }

  function getScopedField(scope, name) {
    if (!(scope instanceof HTMLElement) && !(scope instanceof HTMLFormElement)) return null;
    return scope.querySelector(`[name="${name}"], [data-field="${name}"]`);
  }

  function getScopedFieldValue(scope, name) {
    const field = getScopedField(scope, name);
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
      return field.value;
    }
    return "";
  }

  function getScopedFieldChecked(scope, name) {
    const field = getScopedField(scope, name);
    return field instanceof HTMLInputElement ? field.checked : false;
  }

  function renderDashboard() {
    const overview = state.overview;
    if (!overview) return;
    renderMetricCards(nodes.dashboardMetrics, [
      { label: "Total orders", value: String(overview.metrics?.totalOrders || 0), note: "All recorded orders" },
      { label: "Total sales", value: formatCurrency(overview.metrics?.totalSales || 0, "NGN"), note: "Paid order revenue" },
      { label: "Pending orders", value: String(overview.metrics?.pendingOrders || 0), note: "Needs follow-up" },
      { label: "Low stock products", value: String(overview.metrics?.lowStockProducts || 0), note: "Restock soon" },
      { label: "New customers", value: String(overview.metrics?.newCustomers || 0), note: "Last 30 days" },
      { label: "Contact messages", value: String(overview.metrics?.contactMessages || 0), note: "Awaiting follow-up" }
    ]);

    if (nodes.dashboardAlerts) {
      const alerts = Array.isArray(overview.alerts) ? overview.alerts : [];
      nodes.dashboardAlerts.innerHTML = alerts.length
        ? alerts.map(function (alert) {
            return `<div class="admin-stack-item"><h4>${escapeHtml(titleCase(alert.type))}</h4><p class="admin-meta">${escapeHtml(alert.label)}</p></div>`;
          }).join("")
        : emptyState("No alerts right now.");
    }

    if (nodes.dashboardTransactions) {
      const transactions = Array.isArray(overview.recentTransactions) ? overview.recentTransactions : [];
      nodes.dashboardTransactions.innerHTML = transactions.length
        ? transactions.map(function (item) {
            return `
              <article class="admin-transaction-item">
                <div class="admin-meta-row">
                  <span class="admin-tag ${item.status === "failed" ? "is-danger" : item.status === "paid" ? "is-success" : ""}">${escapeHtml(titleCase(item.status))}</span>
                  <span class="admin-chip">${escapeHtml(item.type === "wallet" ? "Wallet" : "Order payment")}</span>
                </div>
                <h4>${escapeHtml(item.orderId || item.id || "Payment record")}</h4>
                <p class="admin-meta">${escapeHtml(item.customerName || item.customerEmail || "Unknown customer")}</p>
                <p class="admin-meta">${escapeHtml(item.method || "Method not set")} | ${escapeHtml(formatDate(item.paidAt || item.createdAt))}</p>
                <strong>${escapeHtml(formatCurrency(item.amount || 0, item.currency || "NGN"))}</strong>
              </article>
            `;
          }).join("")
        : emptyState("No recent transactions yet.");
    }

    if (nodes.dashboardDailySales) {
      const entries = Array.isArray(overview.reports?.dailySales) ? overview.reports.dailySales : [];
      const max = entries.reduce(function (highest, entry) {
        return Math.max(highest, Number(entry.total || 0));
      }, 0) || 1;
      nodes.dashboardDailySales.innerHTML = entries.length
        ? entries.map(function (entry) {
            const width = Math.max(6, Math.round((Number(entry.total || 0) / max) * 100));
            return `
              <div class="admin-chart-row">
                <span>${escapeHtml(entry.label)}</span>
                <div class="admin-chart-bar"><i style="width:${width}%"></i></div>
                <strong>${escapeHtml(formatCurrency(entry.total || 0, "NGN"))}</strong>
              </div>
            `;
          }).join("")
        : emptyState("No paid orders yet.");
    }

    if (nodes.dashboardBestSellers) {
      const sellers = Array.isArray(overview.reports?.bestSellingProducts) ? overview.reports.bestSellingProducts : [];
      nodes.dashboardBestSellers.innerHTML = sellers.length
        ? sellers.map(function (item) {
            return `
              <div class="admin-stack-item">
                <h4>${escapeHtml(item.name || "Product")}</h4>
                <p class="admin-meta">${escapeHtml(String(item.quantity || 0))} sold | ${escapeHtml(formatCurrency(item.revenue || 0, "NGN"))}</p>
              </div>
            `;
          }).join("")
        : emptyState("No product sales yet.");
    }

    if (nodes.dashboardTopCustomers) {
      const customers = Array.isArray(overview.reports?.topCustomers) ? overview.reports.topCustomers : [];
      nodes.dashboardTopCustomers.innerHTML = customers.length
        ? customers.map(function (customer) {
            return `
              <div class="admin-stack-item">
                <h4>${escapeHtml(customer.name || customer.email || "Customer")}</h4>
                <p class="admin-meta">${escapeHtml(String(customer.totalOrders || 0))} orders | ${escapeHtml(formatCurrency(customer.totalSpent || 0, "NGN"))}</p>
              </div>
            `;
          }).join("")
        : emptyState("No repeat customers yet.");
    }
  }

  function fillProductForm(product) {
    if (!(nodes.productForm instanceof HTMLFormElement)) return;
    nodes.productForm.reset();
    getField(nodes.productForm, "productId").value = product?.productId || "";
    getField(nodes.productForm, "name").value = product?.name || "";
    getField(nodes.productForm, "categoryName").value = product?.categoryName || "";
    getField(nodes.productForm, "sku").value = product?.sku || "";
    getField(nodes.productForm, "price").value = product?.price ?? "";
    getField(nodes.productForm, "discountPrice").value = product?.discountPrice ?? "";
    getField(nodes.productForm, "stockQuantity").value = product?.stockQuantity ?? "";
    getField(nodes.productForm, "sizes").value = Array.isArray(product?.sizes) ? product.sizes.join(", ") : "";
    getField(nodes.productForm, "colors").value = Array.isArray(product?.colors) ? product.colors.join(", ") : "";
    getField(nodes.productForm, "description").value = product?.description || "";
    getField(nodes.productForm, "images").value = Array.isArray(product?.images) ? product.images.join("\n") : "";
    getField(nodes.productForm, "featured").checked = product?.featured === true;
    getField(nodes.productForm, "isActive").checked = product?.isActive !== false;
    if (nodes.productEditorState) {
      nodes.productEditorState.textContent = product?.name
        ? `Editing ${product.name}. Update the merchandising details, then save to refresh the live catalog.`
        : "Create a new style or open an existing card below to edit it with the same form.";
    }
    if (nodes.productSubmitBtn) {
      nodes.productSubmitBtn.textContent = product?.name ? "Update product" : "Save product";
    }
  }

  function resetProductForm() {
    fillProductForm(null);
    if (nodes.productImageUpload instanceof HTMLInputElement) {
      nodes.productImageUpload.value = "";
    }
  }

  function renderProducts() {
    if (nodes.productsSummary instanceof HTMLElement) {
      const totalProducts = state.products.length;
      const featuredProducts = state.products.filter(function (product) { return product.featured === true; }).length;
      const hiddenProducts = state.products.filter(function (product) { return product.isActive === false; }).length;
      const lowStockProducts = state.products.filter(function (product) {
        return product.lowStock === true || Number(product.stockQuantity || 0) <= 5;
      }).length;
      nodes.productsSummary.innerHTML = [
        { label: "Total products", value: totalProducts, note: "Catalog entries" },
        { label: "Featured", value: featuredProducts, note: "Launch-facing pieces" },
        { label: "Low stock", value: lowStockProducts, note: "Needs restock" },
        { label: "Hidden", value: hiddenProducts, note: "Not visible live" }
      ].map(function (item) {
        return `
          <article class="admin-product-summary-card">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(String(item.value))}</strong>
            <small>${escapeHtml(item.note)}</small>
          </article>
        `;
      }).join("");
    }

    if (!(nodes.productsGrid instanceof HTMLElement)) return;
    if (!state.products.length) {
      nodes.productsGrid.innerHTML = emptyState("No products available yet.");
      return;
    }

    nodes.productsGrid.innerHTML = state.products.map(function (product) {
      const previewImage = normalizeAssetUrl(product.images?.[0] || product.image1 || "");
      return `
        <article class="admin-product-card" data-product-id="${escapeHtml(product.productId)}">
          <div class="admin-product-media">
            <img src="${escapeHtml(previewImage)}" alt="${escapeHtml(product.name)}" />
          </div>
          <div class="admin-product-content">
            <div class="admin-chip-row">
              <span class="admin-chip">${escapeHtml(product.categoryName || "Category")}</span>
              <span class="admin-tag ${product.lowStock ? "is-danger" : "is-success"}">${product.lowStock ? "Low stock" : "Healthy stock"}</span>
              <span class="admin-chip">${product.isActive ? "Published" : "Hidden"}</span>
            </div>
            <div class="admin-product-heading">
              <div>
                <h4>${escapeHtml(product.name)}</h4>
                <p class="admin-meta">Stock ${escapeHtml(String(product.stockQuantity || 0))} | Sizes ${escapeHtml((product.sizes || []).join(", ") || "Not set")}</p>
              </div>
              <strong class="admin-product-price">${escapeHtml(formatCurrency(product.price, product.currency))}</strong>
            </div>
            <p class="admin-meta">${product.discountPrice ? `Discount ${escapeHtml(formatCurrency(product.discountPrice, product.currency))} | ` : ""}Colors ${escapeHtml((product.colors || []).join(", ") || "Not set")}</p>
            ${product.description ? `<p class="admin-muted-note">${escapeHtml(product.description)}</p>` : ""}
            <div class="admin-action-row">
              <button class="admin-inline-btn" type="button" data-action="edit-product">Edit</button>
              <button class="admin-inline-btn" type="button" data-action="toggle-product">${product.isActive ? "Hide" : "Publish"}</button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderOrders() {
    const orders = Array.isArray(state.orders) ? state.orders : [];
    const activeQueue = orders.filter(function (order) {
      return ["pending", "placed", "confirmed", "processing"].includes(normalizeOrderStatusValue(order?.orderStatus || order?.status));
    }).length;
    const awaitingTransferReview = orders.filter(function (order) {
      return canConfirmBankTransfer(order);
    }).length;
    const paidOrders = orders.filter(function (order) {
      return normalizePaymentStatusValue(order?.paymentStatus) === "paid";
    }).length;
    const shippedOrders = orders.filter(function (order) {
      return ["shipped", "delivered"].includes(normalizeOrderStatusValue(order?.orderStatus || order?.status));
    }).length;

    if (nodes.ordersSummary instanceof HTMLElement) {
      nodes.ordersSummary.innerHTML = [
        `Active queue ${escapeHtml(String(activeQueue))}`,
        `Paid ${escapeHtml(String(paidOrders))}`,
        `Transfer review ${escapeHtml(String(awaitingTransferReview))}`,
        `Shipped or delivered ${escapeHtml(String(shippedOrders))}`
      ].map(function (label) {
        return `<span class="admin-stat-pill">${label}</span>`;
      }).join("");
    }

    if (nodes.ordersAutomation instanceof HTMLElement) {
      const rules = [
        {
          tone: paidOrders ? "is-paid" : "is-automatic",
          title: "Paid orders stay locked",
          body: `${paidOrders} paid order(s) are already confirmed by the system, so hosts can focus on fulfilment instead of reconfirming payment.`
        },
        {
          tone: awaitingTransferReview ? "is-review" : "is-automatic",
          title: "Bank transfer review appears only when needed",
          body: awaitingTransferReview
            ? `${awaitingTransferReview} bank transfer order(s) are still waiting for one-time review.`
            : "No bank transfer orders are waiting for review right now."
        },
        {
          tone: "is-blocked",
          title: "Fulfilment stays behind payment",
          body: "Pending or failed payments stay out of active fulfilment until the system captures payment or the transfer review is completed."
        }
      ];

      nodes.ordersAutomation.innerHTML = rules.map(function (rule) {
        return `
          <article class="admin-order-rule ${rule.tone}">
            <h4>${escapeHtml(rule.title)}</h4>
            <p>${escapeHtml(rule.body)}</p>
          </article>
        `;
      }).join("");
    }

    if (!(nodes.ordersList instanceof HTMLElement)) return;
    if (!orders.length) {
      nodes.ordersList.innerHTML = emptyState("No orders yet.");
      return;
    }

    nodes.ordersList.innerHTML = orders.map(function (order) {
      const orderStatus = normalizeOrderStatusValue(order.orderStatus || "pending");
      const paymentStatus = normalizePaymentStatusValue(order.paymentStatus || "pending");
      const automation = getOrderAutomationState(order);
      const fulfilment = getOrderFulfilmentState(order);
      const transferReviewAvailable = canConfirmBankTransfer(order) && automation.canConfirm;
      const note = order.metadata?.adminNotes || "";
      const itemsCount = Array.isArray(order.items)
        ? order.items.reduce(function (sum, item) {
          return sum + Math.max(1, Number(item?.quantity || 1));
        }, 0)
        : 0;
      const paymentTagClass = paymentStatus === "failed"
        ? "is-danger"
        : paymentStatus === "paid"
          ? "is-success"
          : paymentStatus === "refunded"
            ? "is-warning"
            : "";
      const orderTagClass = orderStatus === "delivered"
        ? "is-success"
        : ["cancelled", "failed"].includes(orderStatus)
          ? "is-danger"
          : "";
      const paymentCaption = paymentStatus === "paid"
        ? (order.paidAt ? `Paid ${formatShortDate(order.paidAt)}` : automation.caption)
        : automation.caption;
      const paymentLockLabel = paymentStatus === "paid" || paymentStatus === "refunded"
        ? "Payment locked"
        : "System handles payment";
      const manualOverrideMeta = fulfilment.manualOverrideAt
        ? `Last used ${formatShortDate(fulfilment.manualOverrideAt)}${fulfilment.manualOverrideBy ? ` | ${fulfilment.manualOverrideBy}` : ""}`
        : "Use only if the automatic flow needs correction";

      return `
        <article class="admin-order-card ${escapeHtml(automation.mode)}" data-order-id="${escapeHtml(order.orderId)}">
          <div class="admin-order-top">
            <div class="admin-order-heading">
              <div class="admin-meta-row">
                <span class="admin-chip">${escapeHtml(order.orderId)}</span>
                <span class="admin-tag ${paymentTagClass}">${escapeHtml(titleCase(paymentStatus))}</span>
                <span class="admin-tag ${orderTagClass}">${escapeHtml(titleCase(orderStatus))}</span>
                ${fulfilment.manualOverrideAt ? `<span class="admin-chip">Manual override</span>` : ""}
              </div>
              <div class="admin-order-customer">
                <h4>${escapeHtml(order.customerName || "Customer")}</h4>
                <p class="admin-meta">${escapeHtml(order.customerEmail || "No email")}</p>
              </div>
            </div>
            <div class="admin-order-total-block">
              <strong class="admin-order-total">${escapeHtml(formatCurrency(order.total || 0, order.currency || "NGN"))}</strong>
              <p class="admin-meta">${escapeHtml(`${itemsCount} item${itemsCount === 1 ? "" : "s"} | ${formatShortDate(order.orderDate || order.createdAt)}`)}</p>
            </div>
          </div>
          <div class="admin-order-grid">
            <div class="admin-info-tile"><h4>${escapeHtml(order.paymentMethod || "Payment method")}</h4><p class="admin-meta">Route ${escapeHtml(order.paymentReference || "Not available")}</p></div>
            <div class="admin-info-tile"><h4>${escapeHtml(order.customerPhone || "No phone")}</h4><p class="admin-meta">${escapeHtml(order.shippingAddress || "No address")}</p></div>
            <div class="admin-info-tile"><h4>${escapeHtml(formatShortDate(order.orderDate || order.createdAt))}</h4><p class="admin-meta">Estimated ${escapeHtml(order.estimatedDelivery || "Not set")}</p></div>
            <div class="admin-info-tile"><h4>${escapeHtml(paymentCaption)}</h4><p class="admin-meta">${escapeHtml(automation.heading)}</p></div>
          </div>
          <div class="admin-order-automation ${escapeHtml(automation.mode)}">
            <div class="admin-order-automation-copy">
              <p class="admin-card-kicker">Automation state</p>
              <h4>${escapeHtml(automation.heading)}</h4>
              <p class="admin-meta">${escapeHtml(automation.body)}</p>
            </div>
            <div class="admin-order-automation-meta">
              <span class="admin-chip">${escapeHtml(paymentCaption)}</span>
              <span class="admin-inline-pill">${escapeHtml(transferReviewAvailable ? "Review required" : "System managed")}</span>
            </div>
          </div>
          <div class="admin-order-form-grid">
            <div class="admin-inline-field admin-inline-field-static admin-order-status-field admin-order-status-body is-${escapeHtml(fulfilment.mode)}">
              <span class="admin-field-label">Order status</span>
              <strong>${escapeHtml(titleCase(orderStatus))}</strong>
              <p class="admin-field-caption">${escapeHtml(fulfilment.body)}</p>
            </div>
            <div class="admin-inline-field admin-inline-field-static admin-inline-field-status">
              <span class="admin-field-label">Payment status</span>
              <strong>${escapeHtml(titleCase(paymentStatus))}</strong>
              <p class="admin-field-caption">${escapeHtml(automation.body)}</p>
            </div>
            <label class="admin-inline-field admin-order-delivery-field">
              <span class="admin-field-label">Delivery target</span>
              <input data-field="estimatedDelivery" type="date" value="${escapeHtml(fulfilment.estimatedDelivery || "")}" />
              <p class="admin-field-caption">System suggested. Adjust only when courier timing changes.</p>
            </label>
            <label class="admin-inline-field admin-order-notes-field">
              <span class="admin-field-label">Admin notes</span>
              <textarea data-field="adminNotes" rows="3" placeholder="Add fulfilment, delivery, or client care notes">${escapeHtml(note)}</textarea>
            </label>
          </div>
          <div class="admin-order-actions">
            <button class="admin-primary-btn" type="button" data-action="save-order">Save notes</button>
            ${fulfilment.actions.map(function (entry) {
              return `<button class="admin-inline-btn" type="button" data-action="${escapeHtml(entry.action)}">${escapeHtml(entry.label)}</button>`;
            }).join("")}
            ${transferReviewAvailable
              ? '<button class="admin-inline-btn" type="button" data-action="confirm-payment">Confirm bank transfer</button>'
              : `<span class="admin-order-lock">${escapeHtml(paymentLockLabel)}</span>`}
            <button class="admin-inline-btn" type="button" data-action="print-order">Print invoice</button>
          </div>
          <details class="admin-order-manual"${fulfilment.manualOverrideAt ? " open" : ""}>
            <summary class="admin-order-manual-summary">
              <span>Manual override</span>
              <small>${escapeHtml(manualOverrideMeta)}</small>
            </summary>
            <div class="admin-order-manual-body">
              <label class="admin-inline-field admin-order-manual-field">
                <span class="admin-field-label">Override status</span>
                <select data-field="manualOrderStatus">
                  ${["pending", "placed", "confirmed", "processing", "shipped", "delivered", "cancelled"].map(function (status) {
                    return `<option value="${status}" ${status === orderStatus ? "selected" : ""}>${titleCase(status)}</option>`;
                  }).join("")}
                </select>
                <p class="admin-field-caption">Exceptional use only. This updates fulfilment status manually, while payment status remains system-managed.</p>
              </label>
              <div class="admin-order-manual-footer">
                <p class="admin-muted-note">Keep automation as the default. Open this only when the live fulfilment state needs correction.</p>
                <button class="admin-inline-btn" type="button" data-action="manual-override-order">Apply manual override</button>
              </div>
            </div>
          </details>
        </article>
      `;
    }).join("");
  }

  function renderCustomers() {
    if (!(nodes.customersList instanceof HTMLElement)) return;
    if (!state.customers.length) {
      nodes.customersList.innerHTML = emptyState("No customer records yet.");
      return;
    }
    nodes.customersList.innerHTML = state.customers.map(function (customer) {
      return `
        <article class="admin-customer-card" data-customer-id="${escapeHtml(String(customer.id))}">
          <div class="admin-meta-row">
            <span class="admin-chip">${escapeHtml(customer.email)}</span>
            <span class="admin-tag ${customer.isBanned ? "is-danger" : "is-success"}">${customer.isBanned ? "Restricted" : "Active"}</span>
          </div>
          <div class="admin-customer-grid">
            <div class="admin-info-tile"><h4>${escapeHtml(customer.name || "Customer")}</h4><p class="admin-meta">${escapeHtml(customer.phone || "No phone")}</p></div>
            <div class="admin-info-tile"><h4>${escapeHtml(String(customer.totalOrders || 0))} orders</h4><p class="admin-meta">${escapeHtml(formatCurrency(customer.totalSpent || 0, "NGN"))}</p></div>
            <div class="admin-info-tile"><h4>${escapeHtml(formatShortDate(customer.createdAt))}</h4><p class="admin-meta">Joined</p></div>
            <div class="admin-info-tile"><h4>${escapeHtml(customer.lastOrderId || "No orders")}</h4><p class="admin-meta">${escapeHtml(customer.shippingAddress || "No saved address")}</p></div>
          </div>
          <div class="admin-customer-actions">
            <button class="admin-inline-btn" type="button" data-action="toggle-ban">${customer.isBanned ? "Unban" : "Ban"}</button>
            <button class="admin-inline-btn" type="button" data-action="reset-password">Reset password</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderMessages() {
    const messages = Array.isArray(state.messages?.messages) ? state.messages.messages : [];
    const workflowStates = messages.map(getMessageWorkflowState);
    const newCount = workflowStates.filter(function (entry) { return entry.status === "new"; }).length;
    const inProgressCount = workflowStates.filter(function (entry) { return entry.status === "in_progress"; }).length;
    const resolvedCount = workflowStates.filter(function (entry) { return entry.status === "resolved"; }).length;
    const autoTriagedCount = workflowStates.filter(function (entry) { return entry.systemTriaged; }).length;
    const ownerNotesCount = workflowStates.filter(function (entry) { return entry.hasInternalNote; }).length;

    if (nodes.messagesSummary instanceof HTMLElement) {
      nodes.messagesSummary.innerHTML = `
        <span class="admin-stat-pill">Total ${escapeHtml(String(messages.length))}</span>
        <span class="admin-stat-pill">New ${escapeHtml(String(newCount))}</span>
        <span class="admin-stat-pill">In progress ${escapeHtml(String(inProgressCount))}</span>
        <span class="admin-stat-pill">Resolved ${escapeHtml(String(resolvedCount))}</span>
        <span class="admin-stat-pill">Auto triaged ${escapeHtml(String(autoTriagedCount))}</span>
        <span class="admin-stat-pill">Owner notes ${escapeHtml(String(ownerNotesCount))}</span>
      `;
    }

    if (nodes.messagesAutomation instanceof HTMLElement) {
      const rules = [
        {
          tone: autoTriagedCount ? "is-triaged" : "is-new",
          title: "System triage runs automatically",
          body: autoTriagedCount
            ? `${autoTriagedCount} thread(s) already moved into the working queue from delivery and acknowledgement activity.`
            : "Fresh inbox items stay marked new until the system or a host picks up the thread."
        },
        {
          tone: ownerNotesCount ? "is-owned" : "is-triaged",
          title: "Private notes claim a thread",
          body: ownerNotesCount
            ? `${ownerNotesCount} thread(s) already have owner notes, so they are being actively handled.`
            : "Adding an internal note automatically moves the thread into follow-up mode."
        },
        {
          tone: resolvedCount ? "is-resolved" : "is-triaged",
          title: "Hosts close the loop manually",
          body: resolvedCount
            ? `${resolvedCount} thread(s) are currently closed and can be reopened when the customer writes back.`
            : "The main manual action left is resolving or reopening a conversation once the customer is handled."
        }
      ];

      nodes.messagesAutomation.innerHTML = rules.map(function (rule) {
        return `
          <article class="admin-message-rule ${rule.tone}">
            <h4>${escapeHtml(rule.title)}</h4>
            <p>${escapeHtml(rule.body)}</p>
          </article>
        `;
      }).join("");
    }

    if (!(nodes.messagesList instanceof HTMLElement)) return;
    if (!messages.length) {
      nodes.messagesList.innerHTML = emptyState("No contact messages yet.");
      return;
    }

    nodes.messagesList.innerHTML = messages.map(function (message) {
      const workflow = getMessageWorkflowState(message);
      const statusClass = workflow.status === "resolved" ? "is-success" : workflow.status === "new" ? "is-danger" : "";
      const deliveredCount = Array.isArray(message.delivery?.email?.supportDelivered) ? message.delivery.email.supportDelivered.length : 0;
      const emailConfigured = Boolean(message.delivery?.email?.configured);
      const whatsappSent = Boolean(message.delivery?.whatsapp?.sent);
      const senderAcknowledged = Boolean(message.delivery?.email?.senderAcknowledged);
      const hasInternalNote = Boolean(String(message.internalNote || "").trim());
      const resolvedDelivery = message.delivery?.resolved || {};
      const whatsappLabel = whatsappSent
        ? "WhatsApp sent"
        : message.delivery?.whatsapp?.deliveryMethod === "browser-link"
          ? "WhatsApp ready"
          : message.delivery?.whatsapp?.configured
          ? "WhatsApp via WATI"
          : "WhatsApp unavailable";
      const resolvedNotifyLabel = resolvedDelivery.emailSent || resolvedDelivery.whatsappSent
        ? [
            resolvedDelivery.emailSent ? "email" : "",
            resolvedDelivery.whatsappSent ? "WhatsApp" : ""
          ].filter(Boolean).join(" + ")
        : resolvedDelivery.emailSkipped || resolvedDelivery.whatsappSkipped
          ? "Customer notice skipped"
          : resolvedDelivery.emailError || resolvedDelivery.whatsappError
            ? "Customer notice failed"
            : "Customer notice pending";
      const emailStatusLabel = !emailConfigured
        ? "Email not configured"
        : deliveredCount
          ? `${deliveredCount} email${deliveredCount === 1 ? "" : "s"} sent`
          : "Email pending";
      const mailtoLink = `mailto:${String(message.email || "").trim()}?subject=${encodeURIComponent(`Re: ${message.subject || "Benzy Luxury"}`)}`;
      const resolveLabel = workflow.status === "resolved" ? "Reopen thread" : "Mark resolved";
      const resolveAction = workflow.status === "resolved" ? "reopen-message" : "resolve-message";
      const noteLabel = hasInternalNote ? "Note saved to thread" : "No owner note yet";

      return `
        <article class="admin-message-card ${escapeHtml(`is-${workflow.mode}`)}" data-message-id="${escapeHtml(message.messageId)}">
          <div class="admin-message-top">
            <div class="admin-meta-row">
              <span class="admin-chip">${escapeHtml(message.source || "contact-page")}</span>
              <span class="admin-tag ${statusClass}">${escapeHtml(titleCase(workflow.status || "new"))}</span>
              <span class="admin-chip">${escapeHtml(workflow.title)}</span>
            </div>
            <div class="admin-message-time">
              <strong>${escapeHtml(formatShortDate(message.createdAt))}</strong>
              <p class="admin-meta">${escapeHtml(formatDate(message.createdAt))}</p>
            </div>
          </div>
          <div class="admin-message-header">
            <div class="admin-message-contact">
              <h4>${escapeHtml(message.subject || "Contact message")}</h4>
              <p class="admin-meta">${escapeHtml(message.name || "Visitor")} | ${escapeHtml(message.email || "No email")} ${message.phone ? `| ${escapeHtml(message.phone)}` : ""}</p>
              <p class="admin-meta">${message.submittedFrom ? escapeHtml(message.submittedFrom) : "Source unavailable"}</p>
            </div>
          </div>
          <div class="admin-message-delivery-grid">
            <div class="admin-info-tile"><h4>${escapeHtml(emailStatusLabel)}</h4><p class="admin-meta">Support inbox delivery</p></div>
            <div class="admin-info-tile"><h4>${escapeHtml(senderAcknowledged ? "Customer acknowledged" : "Awaiting acknowledgement")}</h4><p class="admin-meta">Auto-reply state</p></div>
            <div class="admin-info-tile"><h4>${escapeHtml(whatsappLabel)}</h4><p class="admin-meta">WhatsApp handoff</p></div>
            <div class="admin-info-tile"><h4>${escapeHtml(noteLabel)}</h4><p class="admin-meta">Owner note state</p></div>
            <div class="admin-info-tile"><h4>${escapeHtml(resolvedNotifyLabel)}</h4><p class="admin-meta">Resolved customer notice</p></div>
          </div>
          <div class="admin-message-automation ${escapeHtml(`is-${workflow.mode}`)}">
            <div class="admin-message-automation-copy">
              <p class="admin-card-kicker">Workflow state</p>
              <h4>${escapeHtml(workflow.title)}</h4>
              <p class="admin-meta">${escapeHtml(workflow.body)}</p>
            </div>
            <div class="admin-message-automation-meta">
              <span class="admin-chip">${escapeHtml(`WhatsApp ${workflow.whatsappReady ? "available" : "not ready"}`)}</span>
              <span class="admin-inline-pill">${escapeHtml(workflow.systemTriaged ? "Auto triaged" : "Waiting for triage")}</span>
            </div>
          </div>
          <div class="admin-message-body">${escapeHtmlWithBreaks(message.message || "")}</div>
          <div class="admin-message-form-grid">
            <div class="admin-inline-field admin-inline-field-static admin-message-status-field">
              <span class="admin-field-label">Conversation state</span>
              <strong>${escapeHtml(titleCase(workflow.status || "new"))}</strong>
              <p class="admin-field-caption">${escapeHtml(workflow.body)}</p>
            </div>
            <label class="admin-inline-field admin-message-note-field">Internal note
              <textarea data-field="internalNote" rows="4" placeholder="Add a private follow-up note">${escapeHtml(message.internalNote || "")}</textarea>
            </label>
          </div>
          <div class="admin-message-actions">
            <button class="admin-primary-btn" type="button" data-action="save-message">Save note</button>
            <button class="admin-inline-btn" type="button" data-action="${resolveAction}">${resolveLabel}</button>
            <a class="admin-inline-btn admin-link-btn" href="${escapeHtml(mailtoLink)}">Reply by email</a>
            ${message.delivery?.whatsapp?.url ? `<a class="admin-inline-btn admin-link-btn" href="${escapeHtml(message.delivery.whatsapp.url)}" target="_blank" rel="noopener noreferrer">Open WhatsApp</a>` : '<span class="admin-order-lock">WhatsApp unavailable</span>'}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderPayments() {
    renderMetricCards(nodes.paymentsSummary, [
      { label: "Verified payments", value: String(state.payments.summary?.verifiedPayments || 0), note: "Paid and confirmed", action: "payment-records" },
      { label: "Failed payments", value: String(state.payments.summary?.failedPayments || 0), note: "Needs investigation", action: "payment-records" },
      { label: "Bank transfers", value: String(state.payments.summary?.bankTransferConfirmations || 0), note: "Manual confirmations", action: "payment-records" },
      { label: "Wallet payments", value: String(state.payments.summary?.walletPayments || 0), note: "Wallet transaction records", action: "payment-records" },
      { label: "Refund records", value: String(state.payments.summary?.refundRecords || 0), note: "Tracked refunds", action: "payment-records" }
    ]);

    if (!(nodes.paymentsList instanceof HTMLElement)) return;
    const entries = Array.isArray(state.payments.payments) ? state.payments.payments : [];
    nodes.paymentsList.innerHTML = entries.length
      ? entries.map(function (payment) {
          return `
            <article class="admin-payment-card" data-order-id="${escapeHtml(payment.orderId || "")}" data-payment-id="${escapeHtml(payment.id || "")}">
              <div class="admin-order-top">
                <div class="admin-meta-row">
                  <span class="admin-chip">${escapeHtml(payment.type === "wallet" ? "Wallet" : "Order")}</span>
                  <span class="admin-tag ${payment.status === "failed" ? "is-danger" : payment.status === "paid" ? "is-success" : ""}">${escapeHtml(titleCase(payment.status || "pending"))}</span>
                </div>
                <strong class="admin-order-total">${escapeHtml(formatCurrency(payment.amount || 0, payment.currency || "NGN"))}</strong>
              </div>
              <div class="admin-payment-grid">
                <div class="admin-info-tile"><h4>${escapeHtml(payment.orderId || payment.id || "Payment")}</h4><p class="admin-meta">${escapeHtml(payment.customerName || payment.customerEmail || "Unknown")}</p></div>
                <div class="admin-info-tile"><h4>${escapeHtml(payment.method || "Method")}</h4><p class="admin-meta">Payment route</p></div>
                <div class="admin-info-tile"><h4>${escapeHtml(payment.provider || "Provider")}</h4><p class="admin-meta">${escapeHtml(formatDate(payment.paidAt || payment.createdAt))}</p></div>
                <div class="admin-info-tile"><h4>${escapeHtml(String((payment.refunds || []).length))} refunds</h4><p class="admin-meta">${escapeHtml(payment.bankTransferConfirmedAt ? "Bank transfer confirmed" : "No manual confirmation")}</p></div>
              </div>
              ${payment.type === "order" ? `<div class="admin-payment-actions"><button class="admin-inline-btn" type="button" data-action="refund-payment">Record refund</button></div>` : ""}
            </article>
          `;
        }).join("")
      : emptyState("No payment records yet.");
  }

  function toDateTimeInput(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    return local.toISOString().slice(0, 16);
  }

  function formatCouponBenefit(coupon) {
    if (coupon?.discountType === "fixed") {
      return `${formatCurrency(coupon?.discountValue || 0, "NGN")} off`;
    }
    return `${String(coupon?.discountValue || 0)}% off`;
  }

  function getCouponAutomationState(coupon) {
    const automation = coupon?.automation && typeof coupon.automation === "object" ? coupon.automation : {};
    const usageLimit = coupon?.usageLimit == null ? null : Math.max(0, Number(coupon.usageLimit || 0));
    const usedCount = Math.max(0, Number(coupon?.usedCount || 0));
    const usageRemaining = usageLimit == null ? null : Math.max(usageLimit - usedCount, 0);
    const expiryDate = coupon?.expiresAt ? new Date(coupon.expiresAt) : null;
    const expiryMs = expiryDate instanceof Date && !Number.isNaN(expiryDate.getTime()) ? expiryDate.getTime() : null;
    const isExpired = automation.isExpired === true || (Number.isFinite(expiryMs) && expiryMs < Date.now());
    const isExhausted = automation.isExhausted === true || (usageLimit != null && usedCount >= usageLimit);
    const expiresSoon = automation.expiresSoon === true
      || (!isExpired && Number.isFinite(expiryMs) && expiryMs <= (Date.now() + (7 * 24 * 60 * 60 * 1000)));
    const lowRemaining = automation.lowRemaining === true
      || (usageRemaining != null && usageRemaining > 0 && (usageRemaining <= 3 || (usageLimit && (usedCount / usageLimit) >= 0.8)));
    const manualEnabled = automation.manualEnabled != null ? automation.manualEnabled : coupon?.isActive !== false;
    const isRedeemable = automation.isRedeemable != null ? automation.isRedeemable : manualEnabled && !isExpired && !isExhausted;

    let mode = typeof automation.mode === "string" && automation.mode ? automation.mode : "live";
    let stateLabel = automation.stateLabel || "Live";
    let title = automation.title || "Redeemable at checkout";
    let description = automation.description || "This offer is active and can be redeemed by eligible shoppers right now.";

    if (!automation.mode) {
      if (isExpired) {
        mode = "closed";
        stateLabel = "Expired";
        title = "Expired automatically";
        description = "Checkout no longer accepts this code because the campaign end date has passed.";
      } else if (isExhausted) {
        mode = "closed";
        stateLabel = "Limit reached";
        title = "Usage limit reached";
        description = "The total redemption cap has been consumed, so this offer is now blocked automatically.";
      } else if (!manualEnabled) {
        mode = "paused";
        stateLabel = "Paused";
        title = "Manually paused";
        description = "This code is configured but intentionally disabled until you relaunch it.";
      } else if (expiresSoon || lowRemaining) {
        mode = "attention";
        stateLabel = "Review soon";
        title = "Still live, but needs attention";
        description = expiresSoon && lowRemaining
          ? "This offer is close to expiry and almost out of redemptions."
          : expiresSoon
            ? "This offer is still live, but its expiry date is approaching."
            : "This offer is still live, but only a few redemptions remain.";
      }
    }

    const previewParts = [
      coupon?.discountType === "fixed"
        ? formatCurrency(coupon?.discountValue || 0, "NGN")
        : `${String(coupon?.discountValue || 0)}%`
    ];
    if (Number(coupon?.minimumOrderAmount || 0) > 0) {
      previewParts.push(`from ${formatCurrency(coupon.minimumOrderAmount || 0, "NGN")}`);
    }
    if (Array.isArray(coupon?.applicableProductIds) && coupon.applicableProductIds.length) {
      previewParts.push(`${coupon.applicableProductIds.length} product${coupon.applicableProductIds.length === 1 ? "" : "s"}`);
    }
    if (coupon?.freeShipping) previewParts.push("plus free shipping");

    return {
      mode,
      stateLabel,
      tagClass: mode === "live" ? "is-success" : mode === "attention" ? "is-warning" : "is-danger",
      title,
      description,
      isRedeemable,
      usageRemaining,
      usageStat: usageLimit == null ? `Redeemed ${usedCount} | Unlimited` : `Redeemed ${usedCount} / ${usageLimit}`,
      expiryStat: coupon?.expiresAt ? `Ends ${formatShortDate(coupon.expiresAt)}` : "No expiry date",
      expiryNote: coupon?.expiresAt
        ? (isExpired ? "Campaign end date has passed." : expiresSoon ? "Close to expiry window." : "Expiry date still healthy.")
        : "Offer stays live until you pause it or a limit is reached.",
      preview: previewParts.join(" | "),
      toggleLabel: manualEnabled ? "Pause coupon" : "Resume coupon",
      lockCopy: isRedeemable
        ? "Expiry and redemption limits are enforced automatically."
        : "Checkout is already blocking this offer automatically."
    };
  }

  function buildCouponPayloadFromScope(scope) {
    return {
      code: getScopedFieldValue(scope, "code").trim().toUpperCase(),
      discountType: getScopedFieldValue(scope, "discountType") || "percent",
      discountValue: Number(getScopedFieldValue(scope, "discountValue") || 0),
      minimumOrderAmount: Number(getScopedFieldValue(scope, "minimumOrderAmount") || 0),
      maximumDiscountAmount: getScopedFieldValue(scope, "maximumDiscountAmount").trim(),
      usageLimit: getScopedFieldValue(scope, "usageLimit").trim(),
      perUserLimit: getScopedFieldValue(scope, "perUserLimit").trim(),
      expiresAt: getScopedFieldValue(scope, "expiresAt"),
      applicableProductIds: getScopedFieldValue(scope, "applicableProductIds").trim(),
      freeShipping: getScopedFieldChecked(scope, "freeShipping"),
      isActive: getScopedFieldChecked(scope, "isActive")
    };
  }

  function syncCouponCapField(scope) {
    if (!(scope instanceof HTMLElement) && !(scope instanceof HTMLFormElement)) return;
    const discountTypeField = getScopedField(scope, "discountType");
    const capField = getScopedField(scope, "maximumDiscountAmount");
    if (!(discountTypeField instanceof HTMLSelectElement) || !(capField instanceof HTMLInputElement)) return;
    const isPercent = discountTypeField.value === "percent";
    const shell = capField.closest("label, .admin-inline-field");
    capField.disabled = !isPercent;
    capField.placeholder = isPercent ? "Optional maximum discount" : "Only used for percentage discounts";
    if (!isPercent) capField.value = "";
    if (shell instanceof HTMLElement) {
      shell.classList.toggle("is-disabled", !isPercent);
    }
  }

  function renderCouponsSummary() {
    if (!(nodes.couponsSummary instanceof HTMLElement)) return;
    const coupons = Array.isArray(state.coupons) ? state.coupons : [];
    const summary = coupons.reduce(function (acc, coupon) {
      const automation = getCouponAutomationState(coupon);
      acc.total += 1;
      if (automation.mode === "live") acc.live += 1;
      if (automation.mode === "attention") acc.attention += 1;
      if (automation.mode === "paused") acc.paused += 1;
      if (automation.mode === "closed") acc.closed += 1;
      if (coupon?.freeShipping) acc.freeShipping += 1;
      return acc;
    }, { total: 0, live: 0, attention: 0, paused: 0, closed: 0, freeShipping: 0 });

    nodes.couponsSummary.innerHTML = `
      <span class="admin-stat-pill">Total ${escapeHtml(String(summary.total))}</span>
      <span class="admin-stat-pill">Live ${escapeHtml(String(summary.live))}</span>
      <span class="admin-stat-pill">Review soon ${escapeHtml(String(summary.attention))}</span>
      <span class="admin-stat-pill">Paused ${escapeHtml(String(summary.paused))}</span>
      <span class="admin-stat-pill">Closed ${escapeHtml(String(summary.closed))}</span>
      <span class="admin-stat-pill">Free shipping ${escapeHtml(String(summary.freeShipping))}</span>
    `;
  }

  function renderCouponsAutomation() {
    if (!(nodes.couponsAutomation instanceof HTMLElement)) return;
    const coupons = Array.isArray(state.coupons) ? state.coupons : [];
    const summary = coupons.reduce(function (acc, coupon) {
      const automation = getCouponAutomationState(coupon);
      if (automation.mode === "live") acc.live += 1;
      if (automation.mode === "attention") acc.attention += 1;
      if (automation.mode === "paused") acc.paused += 1;
      if (automation.mode === "closed") acc.closed += 1;
      return acc;
    }, { live: 0, attention: 0, paused: 0, closed: 0 });

    const cards = [
      {
        mode: summary.live ? "live" : "paused",
        title: `Live offers (${summary.live})`,
        body: "These codes are active, within policy, and currently redeemable at checkout."
      },
      {
        mode: summary.attention ? "attention" : "paused",
        title: `Needs review (${summary.attention})`,
        body: "These campaigns are close to expiry or nearly out of redemptions, so they should be refreshed before the next push."
      },
      {
        mode: summary.closed ? "closed" : "paused",
        title: `Closed automatically (${summary.closed})`,
        body: "Expired or exhausted offers are stopped by the system without waiting for an admin to intervene."
      },
      {
        mode: summary.paused ? "paused" : "live",
        title: `Manually paused (${summary.paused})`,
        body: "These offers are still configured, but hosts have intentionally kept them offline until they are needed again."
      }
    ];

    nodes.couponsAutomation.innerHTML = cards.map(function (card) {
      return `
        <article class="admin-coupon-rule is-${escapeHtml(card.mode)}">
          <h4>${escapeHtml(card.title)}</h4>
          <p>${escapeHtml(card.body)}</p>
        </article>
      `;
    }).join("");
  }

  function renderCoupons() {
    renderCouponsSummary();
    renderCouponsAutomation();
    if (!(nodes.couponsList instanceof HTMLElement)) return;
    if (!state.coupons.length) {
      nodes.couponsList.innerHTML = emptyState("No coupons yet.");
      return;
    }
    nodes.couponsList.innerHTML = state.coupons.map(function (coupon) {
      const automation = getCouponAutomationState(coupon);
      const usageLimit = coupon.usageLimit == null ? null : Math.max(0, Number(coupon.usageLimit || 0));
      const usageRemaining = usageLimit == null ? null : Math.max(usageLimit - Number(coupon.usedCount || 0), 0);
      return `
        <article class="admin-stack-item admin-coupon-card is-${escapeHtml(automation.mode)}" data-coupon-code="${escapeHtml(coupon.code)}">
          <div class="admin-order-top">
            <div class="admin-meta-row">
              <span class="admin-chip admin-code">${escapeHtml(coupon.code)}</span>
              <span class="admin-tag ${automation.tagClass}">${escapeHtml(automation.stateLabel)}</span>
              ${Array.isArray(coupon.applicableProductIds) && coupon.applicableProductIds.length ? `<span class="admin-chip">Products ${escapeHtml(String(coupon.applicableProductIds.length))}</span>` : ""}
              ${coupon.freeShipping ? '<span class="admin-chip">Free shipping</span>' : ""}
              ${coupon.discountType === "percent" && coupon.maximumDiscountAmount != null
                ? `<span class="admin-chip">Cap ${escapeHtml(formatCurrency(coupon.maximumDiscountAmount || 0, "NGN"))}</span>`
                : ""}
            </div>
            <div class="admin-order-total-block">
              <strong class="admin-order-total">${escapeHtml(formatCouponBenefit(coupon))}</strong>
              <span class="admin-muted-note">${escapeHtml(automation.preview)}</span>
            </div>
          </div>
          <div class="admin-coupon-automation is-${escapeHtml(automation.mode)}">
            <div class="admin-coupon-automation-copy">
              <h4>${escapeHtml(automation.title)}</h4>
              <p>${escapeHtml(automation.description)}</p>
            </div>
            <div class="admin-coupon-automation-meta">
              <span class="admin-stat-pill">${escapeHtml(automation.usageStat)}</span>
              <span class="admin-stat-pill">${escapeHtml(automation.expiryStat)}</span>
            </div>
          </div>
          <div class="admin-coupon-metrics">
            <div class="admin-info-tile">
              <span>Redeemed</span>
              <strong>${escapeHtml(String(coupon.usedCount || 0))}</strong>
              <small>${escapeHtml(usageLimit == null ? "Unlimited campaign volume." : `${String(usageRemaining || 0)} redemption(s) left.`)}</small>
            </div>
            <div class="admin-info-tile">
              <span>Minimum order</span>
              <strong>${escapeHtml(Number(coupon.minimumOrderAmount || 0) > 0 ? formatCurrency(coupon.minimumOrderAmount || 0, "NGN") : "No minimum")}</strong>
              <small>${escapeHtml(Number(coupon.minimumOrderAmount || 0) > 0 ? "Basket threshold before checkout accepts this code." : "No basket threshold is currently required.")}</small>
            </div>
            <div class="admin-info-tile">
              <span>Expiry window</span>
              <strong>${escapeHtml(coupon.expiresAt ? formatShortDate(coupon.expiresAt) : "No expiry")}</strong>
              <small>${escapeHtml(automation.expiryNote)}</small>
            </div>
            <div class="admin-info-tile">
              <span>Per customer</span>
              <strong>${escapeHtml(coupon.perUserLimit == null ? "Open" : `${String(coupon.perUserLimit)}x`)}</strong>
              <small>${escapeHtml(coupon.perUserLimit == null ? "No per-customer cap." : "Maximum uses allowed for one customer.")}</small>
            </div>
          </div>
          <div class="admin-coupon-form-grid">
            <label class="admin-inline-field">Type
              <select data-field="discountType">
                <option value="percent" ${coupon.discountType === "percent" ? "selected" : ""}>Percentage</option>
                <option value="fixed" ${coupon.discountType === "fixed" ? "selected" : ""}>Fixed</option>
              </select>
            </label>
            <label class="admin-inline-field">Value
              <input data-field="discountValue" type="number" min="0" step="1" value="${escapeHtml(String(coupon.discountValue || 0))}" />
            </label>
            <label class="admin-inline-field">Cap (percent only)
              <input data-field="maximumDiscountAmount" type="number" min="0" step="100" value="${escapeHtml(coupon.maximumDiscountAmount == null ? "" : String(coupon.maximumDiscountAmount))}" />
            </label>
            <label class="admin-inline-field">Minimum order
              <input data-field="minimumOrderAmount" type="number" min="0" step="100" value="${escapeHtml(String(coupon.minimumOrderAmount || 0))}" />
            </label>
            <label class="admin-inline-field">Usage limit
              <input data-field="usageLimit" type="number" min="0" step="1" value="${escapeHtml(coupon.usageLimit == null ? "" : String(coupon.usageLimit))}" />
            </label>
            <label class="admin-inline-field">Per user limit
              <input data-field="perUserLimit" type="number" min="0" step="1" value="${escapeHtml(coupon.perUserLimit == null ? "" : String(coupon.perUserLimit))}" />
            </label>
            <label class="admin-inline-field">Expiry
              <input data-field="expiresAt" type="datetime-local" value="${coupon.expiresAt ? escapeHtml(toDateTimeInput(coupon.expiresAt)) : ""}" />
            </label>
            <label class="admin-inline-field admin-coupon-product-target-field">Product codes
              <textarea data-field="applicableProductIds" rows="2" placeholder="Product IDs or SKU codes">${escapeHtml(Array.isArray(coupon.applicableProductIds) ? coupon.applicableProductIds.join(", ") : "")}</textarea>
            </label>
            <label class="admin-switch-field"><input data-field="freeShipping" type="checkbox" ${coupon.freeShipping ? "checked" : ""}><span>Free shipping</span></label>
            <label class="admin-switch-field"><input data-field="isActive" type="checkbox" ${coupon.isActive ? "checked" : ""}><span>Launch live</span></label>
          </div>
          <div class="admin-coupon-actions">
            <button class="admin-inline-btn" type="button" data-action="toggle-coupon">${escapeHtml(automation.toggleLabel)}</button>
            <button class="admin-primary-btn" type="button" data-action="save-coupon">Save coupon</button>
            <button class="admin-inline-btn admin-danger-btn" type="button" data-action="delete-coupon">Delete coupon</button>
            <span class="admin-coupon-lock">${escapeHtml(automation.lockCopy)}</span>
          </div>
        </article>
      `;
    }).join("");

    Array.from(nodes.couponsList.querySelectorAll("[data-coupon-code]")).forEach(function (card) {
      syncCouponCapField(card);
    });
  }

  function renderLogs() {
    if (!(nodes.activityLogs instanceof HTMLElement)) return;
    nodes.activityLogs.innerHTML = state.logs.length
      ? state.logs.map(function (log) {
          return `
            <div class="admin-stack-item">
              <h4>${escapeHtml(titleCase(log.area || "general"))} | ${escapeHtml(titleCase(log.action || "updated"))}</h4>
              <p class="admin-meta">${escapeHtml(log.message || "Admin activity")}</p>
              <p class="admin-meta">${escapeHtml(log.adminEmail || "admin")} | ${escapeHtml(formatDate(log.createdAt))}</p>
            </div>
          `;
        }).join("")
      : emptyState("No recent activity logs.");
  }

  function renderNewsletter() {
    if (!(nodes.newsletterSummary instanceof HTMLElement)) return;
    const summary = state.newsletter?.summary || {};
    const sourceSummary = summary.sourceSummary || {};
    nodes.newsletterSummary.innerHTML = `
      <span class="admin-stat-pill">Subscribers ${escapeHtml(String(summary.total || 0))}</span>
      <span class="admin-stat-pill">Discounts used ${escapeHtml(String(summary.usedDiscounts || 0))}</span>
      <span class="admin-stat-pill">Brevo ${state.newsletter?.brevo?.configured ? "connected" : "not configured"}</span>
      ${Object.keys(sourceSummary).map(function (key) {
        return `<span class="admin-stat-pill">${escapeHtml(titleCase(key))} ${escapeHtml(String(sourceSummary[key] || 0))}</span>`;
      }).join("")}
    `;

    if (nodes.subscribersList instanceof HTMLElement) {
      const subscribers = Array.isArray(state.newsletter?.subscribers) ? state.newsletter.subscribers : [];
      nodes.subscribersList.innerHTML = subscribers.length
        ? subscribers.map(function (subscriber) {
            return `
              <article class="admin-subscriber-card">
                <h4>${escapeHtml(subscriber.email)}</h4>
                <p class="admin-meta">Source ${escapeHtml(titleCase(subscriber.source || "unknown"))} | Joined ${escapeHtml(formatDate(subscriber.subscribedAt))}</p>
                <p class="admin-meta">Coupon ${escapeHtml(subscriber.discountCode || "None")} | ${subscriber.discountUsed ? "Used" : "Available"}</p>
              </article>
            `;
          }).join("")
        : emptyState("No subscribers yet.");
    }
  }

  function renderReviews() {
    if (!(nodes.reviewsList instanceof HTMLElement)) return;
    if (!state.reviews.length) {
      nodes.reviewsList.innerHTML = emptyState("No testimonials yet.");
      return;
    }
    nodes.reviewsList.innerHTML = state.reviews.map(function (review) {
      return `
        <article class="admin-stack-item" data-review-id="${escapeHtml(review.reviewId)}">
          <div class="admin-meta-row">
            <span class="admin-chip">${escapeHtml(review.customerName || "Anonymous")}</span>
            <span class="admin-tag ${review.featured ? "is-success" : ""}">${review.featured ? "Featured" : "Standard"}</span>
          </div>
          <h4>${escapeHtml(review.productName || "General testimonial")} | ${escapeHtml(String(review.rating || 5))}/5</h4>
          <p class="admin-message-body">${escapeHtml(review.comment || "")}</p>
          <div class="admin-order-grid">
            <label class="admin-inline-field">Status
              <select data-field="status">
                <option value="approved" ${review.status === "approved" ? "selected" : ""}>Approved</option>
                <option value="rejected" ${review.status === "rejected" ? "selected" : ""}>Rejected</option>
                <option value="spam" ${review.status === "spam" ? "selected" : ""}>Spam</option>
              </select>
            </label>
            <label class="admin-switch-field"><input data-field="featured" type="checkbox" ${review.featured ? "checked" : ""}><span>Feature</span></label>
          </div>
          <div class="admin-order-actions">
            <button class="admin-inline-btn" type="button" data-action="save-review">Save review</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderTeam() {
    if (!(nodes.teamList instanceof HTMLElement)) return;
    if (!state.users.length) {
      nodes.teamList.innerHTML = emptyState("No users yet.");
      return;
    }
    nodes.teamList.innerHTML = state.users.map(function (user) {
      const displayName = user.name || "User profile";
      const adminRoles = ["super_admin", "product_manager", "order_manager", "customer_support_admin"];
      const selectedAdminRole = adminRoles.includes(user.adminRole) ? user.adminRole : "customer_support_admin";
      const initials = String(displayName)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(function (part) { return part.charAt(0).toUpperCase(); })
        .join("") || "BL";
      return `
        <article class="admin-team-card" data-user-id="${escapeHtml(String(user.id))}">
          <div class="admin-team-profile">
            <div class="admin-team-avatar">${escapeHtml(initials)}</div>
            <div class="admin-team-summary">
              <div class="admin-meta-row">
                <span class="admin-chip">${escapeHtml(user.email)}</span>
                <span class="admin-tag ${user.role === "host" ? "is-success" : ""}">${escapeHtml(titleCase(user.role))}</span>
                ${user.isBanned ? '<span class="admin-tag is-danger">Restricted</span>' : ""}
              </div>
              <h4>${escapeHtml(displayName)}</h4>
              <p class="admin-meta">${escapeHtml(user.phone || user.email || "No phone on file")}</p>
            </div>
            <div class="admin-team-actions">
              <button class="admin-primary-btn" type="button" data-action="save-user">Save</button>
              <button class="admin-inline-btn admin-danger-btn" type="button" data-action="delete-user">Delete</button>
            </div>
          </div>
          <div class="admin-team-grid">
            <label class="admin-inline-field">Name
              <input data-field="name" type="text" value="${escapeHtml(user.name || "")}" />
            </label>
            <label class="admin-inline-field">Phone
              <input data-field="phone" type="text" value="${escapeHtml(user.phone || "")}" />
            </label>
            <label class="admin-inline-field">Role
              <select data-field="role">
                <option value="resident" ${user.role === "resident" ? "selected" : ""}>Resident</option>
                <option value="host" ${user.role === "host" ? "selected" : ""}>Host</option>
              </select>
            </label>
            <label class="admin-inline-field admin-role-field">Admin role
              <input data-field="adminRole" type="hidden" value="${escapeHtml(selectedAdminRole)}" />
              <details class="admin-role-picker">
                <summary><span>${escapeHtml(titleCase(selectedAdminRole))}</span></summary>
                <div class="admin-role-menu">
                  ${adminRoles.map(function (role) {
                    return `<button class="${role === selectedAdminRole ? "active" : ""}" type="button" data-admin-role-option="${escapeHtml(role)}">${escapeHtml(titleCase(role))}</button>`;
                  }).join("")}
                </div>
              </details>
            </label>
          </div>
        </article>
      `;
    }).join("");
  }

  function fillSettingsForm() {
    if (!(nodes.settingsForm instanceof HTMLFormElement) || !state.settings) return;
    const shipping = state.settings.shipping || {};
    const security = state.settings.security || {};
    getField(nodes.settingsForm, "defaultDomesticFeeNgn").value = shipping.defaultDomesticFeeNgn ?? "";
    getField(nodes.settingsForm, "lagosFeeNgn").value = shipping.lagosFeeNgn ?? "";
    getField(nodes.settingsForm, "otherStatesFeeNgn").value = shipping.otherStatesFeeNgn ?? "";
    getField(nodes.settingsForm, "internationalFeeNgn").value = shipping.internationalFeeNgn ?? "";
    getField(nodes.settingsForm, "freeShippingThresholdNgn").value = shipping.freeShippingThresholdNgn ?? "";
    getField(nodes.settingsForm, "lagosDelivery").value = shipping.deliveryTimes?.lagos || "";
    getField(nodes.settingsForm, "otherStatesDelivery").value = shipping.deliveryTimes?.otherStates || "";
    getField(nodes.settingsForm, "internationalDelivery").value = shipping.deliveryTimes?.international || "";
    getField(nodes.settingsForm, "adminSessionTimeoutMinutes").value = security.adminSessionTimeoutMinutes ?? 30;
    getField(nodes.settingsForm, "activityLogsRetentionDays").value = security.activityLogsRetentionDays ?? 30;
    getField(nodes.settingsForm, "twoFactorEnabled").checked = security.twoFactorEnabled === true;
  }

  function fillContentForm() {
    if (!(nodes.contentForm instanceof HTMLFormElement) || !state.content) return;
    getField(nodes.contentForm, "homepageEyebrow").value = state.content.homepageBanner?.eyebrow || "";
    getField(nodes.contentForm, "homepageTitle").value = state.content.homepageBanner?.title || "";
    getField(nodes.contentForm, "homepageCtaLabel").value = state.content.homepageBanner?.ctaLabel || "";
    getField(nodes.contentForm, "homepageCtaUrl").value = state.content.homepageBanner?.ctaUrl || "";
    getField(nodes.contentForm, "homepageSubtitle").value = state.content.homepageBanner?.subtitle || "";
    getField(nodes.contentForm, "heroHeading").value = state.content.heroSection?.heading || "";
    getField(nodes.contentForm, "heroBody").value = state.content.heroSection?.body || "";
    getField(nodes.contentForm, "aboutUs").value = state.content.aboutUs || "";
    getField(nodes.contentForm, "contactEmail").value = state.content.contactInfo?.email || "";
    getField(nodes.contentForm, "contactPhone").value = state.content.contactInfo?.phone || "";
    getField(nodes.contentForm, "contactAddress").value = state.content.contactInfo?.address || "";
    getField(nodes.contentForm, "faq").value = JSON.stringify(state.content.faq || [], null, 2);
    getField(nodes.contentForm, "policyShipping").value = state.content.policyPages?.shipping || "";
    getField(nodes.contentForm, "policyReturns").value = state.content.policyPages?.returns || "";
    getField(nodes.contentForm, "policyPrivacy").value = state.content.policyPages?.privacy || "";
    getField(nodes.contentForm, "policyTerms").value = state.content.policyPages?.terms || "";
    getField(nodes.contentForm, "footerHeadline").value = state.content.footerContent?.headline || "";
    getField(nodes.contentForm, "footerBody").value = state.content.footerContent?.body || "";
    getField(nodes.contentForm, "footerNewsletterNote").value = state.content.footerContent?.newsletterNote || "";
    getField(nodes.contentForm, "newsletterTitle").value = state.content.newsletterSection?.title || "";
    getField(nodes.contentForm, "newsletterBody").value = state.content.newsletterSection?.body || "";
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function readBlobAsDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ""));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function loadImageFromObjectUrl(url) {
    return new Promise(function (resolve, reject) {
      const image = new Image();
      image.onload = function () {
        resolve(image);
      };
      image.onerror = reject;
      image.src = url;
    });
  }

  async function prepareProductUploadImage(file) {
    const safeName = String(file?.name || "product-image").trim() || "product-image";
    const mimeType = String(file?.type || "").toLowerCase();
    if (!mimeType.startsWith("image/")) {
      throw new Error(`${safeName} is not an image file.`);
    }

    if (mimeType === "image/gif") {
      return { name: safeName, dataUrl: await readFileAsDataUrl(file) };
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await loadImageFromObjectUrl(objectUrl);
      const maxSide = 1800;
      const width = Number(image.naturalWidth || image.width || 0);
      const height = Number(image.naturalHeight || image.height || 0);
      if (!width || !height) {
        return { name: safeName, dataUrl: await readFileAsDataUrl(file) };
      }

      const scale = Math.min(1, maxSide / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        return { name: safeName, dataUrl: await readFileAsDataUrl(file) };
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(function (resolve) {
        canvas.toBlob(resolve, "image/webp", 0.86);
      });
      if (!blob) {
        return { name: safeName, dataUrl: await readFileAsDataUrl(file) };
      }

      return {
        name: safeName.replace(/\.[^.]+$/, "") + ".webp",
        dataUrl: await readBlobAsDataUrl(blob)
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function readUploadImages() {
    if (!(nodes.productImageUpload instanceof HTMLInputElement) || !nodes.productImageUpload.files?.length) {
      return [];
    }
    const files = Array.from(nodes.productImageUpload.files);
    const images = [];
    for (const file of files) {
      images.push(await prepareProductUploadImage(file));
    }
    const data = await api("/api/admin/uploads/products", {
      method: "POST",
      body: JSON.stringify({ images })
    });
    return Array.isArray(data?.urls) ? data.urls : [];
  }

  async function ensureHostSession() {
    const token = getToken();
    if (!token) {
      redirectToLogin();
      return false;
    }

    try {
      const data = await api("/api/auth/me");
      if (String(data?.user?.role || "").toLowerCase() !== "host") {
        redirectToLogin();
        return false;
      }
      state.user = data.user;
      state.permissions = getPermissionsForUser(data.user);
      renderCurrentUser();
      return true;
    } catch (_error) {
      redirectToLogin();
      return false;
    }
  }

  function renderCurrentUser() {
    if (nodes.userName) nodes.userName.textContent = state.user?.name || "Admin";
    if (nodes.userRole) nodes.userRole.textContent = titleCase(state.user?.adminRole || "super_admin");
  }

  function refreshVisibleNav() {
    const navLinks = Array.from(document.querySelectorAll(".admin-nav-link"));
    navLinks.forEach(function (button) {
      const section = button.getAttribute("data-section") || "dashboard";
      const permission = SECTION_TITLES[section]?.permission;
      const visible = !permission || hasPermission(permission);
      button.hidden = !visible;
      const sectionNode = nodes.sections.find(function (entry) {
        return entry.getAttribute("data-section") === section;
      });
      if (sectionNode) sectionNode.hidden = !visible;
    });
  }

  async function loadOverview(force) {
    if (state.loaded.dashboard && !force) return;
    const data = await api("/api/admin/overview");
    state.overview = data.overview;
    state.loaded.dashboard = true;
    if (state.overview?.currentUser) {
      state.user = { ...(state.user || {}), ...state.overview.currentUser };
      state.permissions = new Set(state.overview.currentUser.permissions || Array.from(getPermissionsForUser(state.user)));
      renderCurrentUser();
      refreshVisibleNav();
    }
    renderDashboard();
  }

  async function loadProducts(force) {
    if (state.loaded.products && !force) return;
    const data = await api("/api/admin/products");
    state.products = Array.isArray(data.products) ? data.products : [];
    state.loaded.products = true;
    renderProducts();
  }

  async function loadOrders(force) {
    if (state.loaded.orders && !force) return;
    const data = await api("/api/admin/orders");
    state.orders = Array.isArray(data.orders) ? data.orders : [];
    state.loaded.orders = true;
    renderOrders();
  }

  async function loadCustomers(force) {
    if (state.loaded.customers && !force) return;
    const data = await api("/api/admin/customers");
    state.customers = Array.isArray(data.customers) ? data.customers : [];
    state.loaded.customers = true;
    renderCustomers();
  }

  async function loadMessages(force) {
    if (state.loaded.messages && !force) return;
    const data = await api("/api/admin/messages");
    state.messages = {
      messages: Array.isArray(data.messages) ? data.messages : [],
      summary: data.summary || {}
    };
    state.loaded.messages = true;
    renderMessages();
  }

  async function loadPayments(force) {
    if (state.loaded.payments && !force) return;
    const data = await api("/api/admin/payments");
    state.payments = {
      payments: Array.isArray(data.payments) ? data.payments : [],
      summary: data.summary || {}
    };
    state.loaded.payments = true;
    renderPayments();
  }

  async function loadCoupons(force) {
    if (state.loaded.coupons && !force) return;
    const data = await api("/api/admin/coupons");
    state.coupons = Array.isArray(data.coupons) ? data.coupons : [];
    state.loaded.coupons = true;
    renderCoupons();
  }

  async function loadSettings(force) {
    if (state.loaded.settings && !force) return;
    const data = await api("/api/admin/settings");
    state.settings = data.settings || null;
    state.loaded.settings = true;
    fillSettingsForm();
    setSessionTimeout(Number(state.settings?.security?.adminSessionTimeoutMinutes || 30));
    if (hasPermission("logs")) {
      try {
        const logsData = await api("/api/admin/logs");
        state.logs = Array.isArray(logsData.logs) ? logsData.logs : [];
      } catch (_error) {
        state.logs = [];
      }
      renderLogs();
    } else if (nodes.activityLogs) {
      nodes.activityLogs.innerHTML = emptyState("This role cannot view activity logs.");
    }
  }

  async function loadContent(force) {
    if (state.loaded.content && !force) return;
    const data = await api("/api/admin/content");
    state.content = data.content || null;
    state.loaded.content = true;
    fillContentForm();
  }

  async function loadNewsletter(force) {
    if (state.loaded.newsletter && !force) return;
    const data = await api("/api/admin/newsletter");
    state.newsletter = data || null;
    state.loaded.newsletter = true;
    renderNewsletter();
  }

  async function loadReviews(force) {
    if (state.loaded.reviews && !force) return;
    const data = await api("/api/admin/reviews");
    state.reviews = Array.isArray(data.reviews) ? data.reviews : [];
    state.loaded.reviews = true;
    renderReviews();
  }

  async function loadTeam(force) {
    if (state.loaded.team && !force) return;
    const data = await api("/api/admin/users");
    state.users = Array.isArray(data.users) ? data.users : [];
    state.loaded.team = true;
    renderTeam();
  }

  async function loadSection(section, force) {
    switch (section) {
      case "dashboard": return loadOverview(force);
      case "products": return loadProducts(force);
      case "orders": return loadOrders(force);
      case "customers": return loadCustomers(force);
      case "messages": return loadMessages(force);
      case "payments": return loadPayments(force);
      case "coupons": return loadCoupons(force);
      case "settings": return loadSettings(force);
      case "content": return loadContent(force);
      case "newsletter": return loadNewsletter(force);
      case "reviews": return loadReviews(force);
      case "team": return loadTeam(force);
      default: return loadOverview(force);
    }
  }

  async function setSection(section, force) {
    const resolved = SECTION_TITLES[section] ? section : "dashboard";
    const permission = SECTION_TITLES[resolved].permission;
    if (permission && !hasPermission(permission)) {
      return setSection("dashboard", false);
    }

    state.activeSection = resolved;
    if (document.body instanceof HTMLElement) {
      document.body.dataset.adminSection = resolved;
    }
    updateTopbar(resolved);
    Array.from(document.querySelectorAll(".admin-nav-link")).forEach(function (button) {
      button.classList.toggle("active", button.getAttribute("data-section") === resolved);
    });
    nodes.sections.forEach(function (sectionNode) {
      sectionNode.classList.toggle("active", sectionNode.getAttribute("data-section") === resolved);
    });
    if (window.location.hash !== `#${resolved}`) {
      window.location.hash = resolved;
    }
    await loadSection(resolved, force);
    if (nodes.sidebar) nodes.sidebar.classList.remove("is-open");
  }

  function setSessionTimeout(minutes) {
    const safeMinutes = Math.max(5, Number.isFinite(minutes) ? minutes : 30);
    if (nodes.sessionPill) {
      nodes.sessionPill.textContent = `Auto logout in ${safeMinutes} min`;
    }

    const resetTimeout = function () {
      window.clearTimeout(state.sessionTimeoutHandle);
      state.sessionTimeoutHandle = window.setTimeout(function () {
        showFlash("Session timed out. Please sign in again.", true);
        window.setTimeout(function () {
          redirectToLogin();
        }, 400);
      }, safeMinutes * 60 * 1000);
    };

    ["click", "keydown", "mousemove", "touchstart"].forEach(function (eventName) {
      window.removeEventListener(eventName, setSessionTimeout._resetHandler || resetTimeout);
      window.addEventListener(eventName, resetTimeout, { passive: true });
    });
    setSessionTimeout._resetHandler = resetTimeout;
    resetTimeout();
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map(function (row) {
      return row.map(function (cell) {
        const safe = String(cell ?? "").replace(/"/g, '""');
        return `"${safe}"`;
      }).join(",");
    }).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function printOrder(order) {
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;
    const items = Array.isArray(order.items) ? order.items : [];
    popup.document.write(`
      <html>
        <head>
          <title>Invoice ${escapeHtml(order.orderId)}</title>
          <style>
            body{font-family:Arial,sans-serif;padding:32px;color:#231711}
            h1,h2{margin:0 0 12px}
            table{width:100%;border-collapse:collapse;margin-top:20px}
            td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left}
          </style>
        </head>
        <body>
          <h1>Benzy Luxury</h1>
          <h2>Order ${escapeHtml(order.orderId)}</h2>
          <p>Customer: ${escapeHtml(order.customerName || order.customerEmail || "")}</p>
          <p>Email: ${escapeHtml(order.customerEmail || "")}</p>
          <p>Phone: ${escapeHtml(order.customerPhone || "")}</p>
          <p>Shipping: ${escapeHtml(order.shippingAddress || "")}</p>
          <p>Status: ${escapeHtml(titleCase(order.orderStatus || ""))} | Payment: ${escapeHtml(titleCase(order.paymentStatus || ""))}</p>
          <table>
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
            <tbody>
              ${items.map(function (item) {
                return `<tr><td>${escapeHtml(item.name || item.title || "Item")}</td><td>${escapeHtml(String(item.quantity || item.qty || 1))}</td><td>${escapeHtml(formatCurrency(item.price || 0, order.currency || "NGN"))}</td></tr>`;
              }).join("")}
            </tbody>
          </table>
          <h2 style="margin-top:24px">Total: ${escapeHtml(formatCurrency(order.total || 0, order.currency || "NGN"))}</h2>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  function getSectionFromHash() {
    const section = String(window.location.hash || "").replace(/^#/, "");
    return SECTION_TITLES[section] ? section : "dashboard";
  }

  function bindEvents() {
    if (nodes.nav) {
      nodes.nav.addEventListener("click", function (event) {
        const button = event.target.closest(".admin-nav-link");
        if (!(button instanceof HTMLButtonElement)) return;
        setSection(button.getAttribute("data-section") || "dashboard", false).catch(function (error) {
          showFlash(error.message || "Unable to switch section.", true);
        });
      });
    }

    if (nodes.mobileNavBtn) {
      nodes.mobileNavBtn.addEventListener("click", function () {
        if (nodes.sidebar) nodes.sidebar.classList.toggle("is-open");
      });
    }

    if (nodes.logoutBtn) {
      nodes.logoutBtn.addEventListener("click", function () {
        redirectToLogin();
      });
    }

    if (nodes.refreshDashboardBtn) {
      nodes.refreshDashboardBtn.addEventListener("click", function () {
        loadOverview(true).then(function () {
          showFlash("Dashboard refreshed.", false);
        }).catch(function (error) {
          showFlash(error.message || "Unable to refresh dashboard.", true);
        });
      });
    }

    if (nodes.productForm instanceof HTMLFormElement) {
      nodes.productForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        try {
          if (nodes.productSubmitBtn instanceof HTMLButtonElement) nodes.productSubmitBtn.disabled = true;
          const imageLines = getFieldValue(nodes.productForm, "images")
            .split(/\n+/)
            .map(function (line) { return line.trim(); })
            .filter(Boolean);
          const uploads = await readUploadImages();
          const payload = {
            productId: getFieldValue(nodes.productForm, "productId").trim() || undefined,
            name: getFieldValue(nodes.productForm, "name").trim(),
            categoryName: getFieldValue(nodes.productForm, "categoryName").trim(),
            sku: getFieldValue(nodes.productForm, "sku").trim() || generateProductSku(nodes.productForm),
            price: Number(getFieldValue(nodes.productForm, "price") || 0),
            discountPrice: getFieldValue(nodes.productForm, "discountPrice").trim(),
            stockQuantity: Number(getFieldValue(nodes.productForm, "stockQuantity") || 0),
            sizes: getFieldValue(nodes.productForm, "sizes"),
            colors: getFieldValue(nodes.productForm, "colors"),
            description: getFieldValue(nodes.productForm, "description").trim(),
            images: imageLines.concat(uploads),
            featured: getFieldChecked(nodes.productForm, "featured"),
            isActive: getFieldChecked(nodes.productForm, "isActive")
          };

          const isEdit = Boolean(payload.productId);
          await api(isEdit ? `/api/admin/products/${encodeURIComponent(payload.productId)}` : "/api/admin/products", {
            method: isEdit ? "PATCH" : "POST",
            body: JSON.stringify(payload)
          });
          resetProductForm();
          state.loaded.products = false;
          state.loaded.dashboard = false;
          await Promise.all([loadProducts(true), loadOverview(true)]);
          showFlash(isEdit ? "Product updated." : "Product created.", false);
        } catch (error) {
          showFlash(error?.message || "Unable to save product.", true);
        } finally {
          if (nodes.productSubmitBtn instanceof HTMLButtonElement) nodes.productSubmitBtn.disabled = false;
        }
      });
    }

    if (nodes.productFormReset) {
      nodes.productFormReset.addEventListener("click", function () {
        resetProductForm();
      });
    }

    if (nodes.productSkuGenerateBtn instanceof HTMLButtonElement && nodes.productForm instanceof HTMLFormElement) {
      nodes.productSkuGenerateBtn.addEventListener("click", function () {
        const skuField = getField(nodes.productForm, "sku");
        if (skuField instanceof HTMLInputElement) {
          skuField.value = generateProductSku(nodes.productForm);
          skuField.focus();
        }
      });
    }

    if (nodes.productsGrid) {
      nodes.productsGrid.addEventListener("click", async function (event) {
        const button = event.target.closest("button[data-action]");
        if (!(button instanceof HTMLButtonElement)) return;
        const card = button.closest("[data-product-id]");
        if (!(card instanceof HTMLElement)) return;
        const productId = card.getAttribute("data-product-id") || "";
        const product = state.products.find(function (entry) { return entry.productId === productId; });
        if (!product) return;

        if (button.dataset.action === "edit-product") {
          fillProductForm(product);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }

        if (button.dataset.action === "toggle-product") {
          await api(`/api/admin/products/${encodeURIComponent(productId)}`, {
            method: "PATCH",
            body: JSON.stringify({ isActive: !product.isActive })
          });
          state.loaded.products = false;
          state.loaded.dashboard = false;
          await Promise.all([loadProducts(true), loadOverview(true)]);
          showFlash(product.isActive ? "Product hidden." : "Product published.", false);
        }
      });
    }

    if (nodes.ordersList) {
      nodes.ordersList.addEventListener("click", async function (event) {
        const button = event.target.closest("button[data-action]");
        if (!(button instanceof HTMLButtonElement)) return;
        const card = button.closest("[data-order-id]");
        if (!(card instanceof HTMLElement)) return;
        const orderId = card.getAttribute("data-order-id") || "";
        const order = state.orders.find(function (entry) { return entry.orderId === orderId; });
        if (!order) return;

        if (button.dataset.action === "print-order") {
          printOrder(order);
          return;
        }

        if (button.dataset.action === "confirm-payment") {
          if (!canConfirmBankTransfer(order)) {
            showFlash(`Payment on ${orderId} is already managed by the system.`, false);
            return;
          }
          await api(`/api/admin/orders/${encodeURIComponent(orderId)}/confirm-payment`, { method: "POST", body: JSON.stringify({}) });
          state.loaded.orders = false;
          state.loaded.payments = false;
          state.loaded.dashboard = false;
          await Promise.all([loadOrders(true), loadPayments(true), loadOverview(true)]);
          showFlash(`Payment confirmed for ${orderId}.`, false);
          return;
        }

        if (button.dataset.action === "save-order") {
          const payload = {
            estimatedDelivery: card.querySelector('[data-field="estimatedDelivery"]')?.value || "",
            adminNotes: card.querySelector('[data-field="adminNotes"]')?.value || ""
          };
          await api(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
          });
          state.loaded.orders = false;
          state.loaded.payments = false;
          state.loaded.dashboard = false;
          await Promise.all([loadOrders(true), loadPayments(true), loadOverview(true)]);
          showFlash(`Order ${orderId} notes updated.`, false);
          return;
        }

        if (["ship-order", "deliver-order", "cancel-order"].includes(button.dataset.action || "")) {
          if (button.dataset.action === "cancel-order" && !window.confirm(`Cancel order ${orderId}?`)) {
            return;
          }
          const actionMap = {
            "ship-order": "ship",
            "deliver-order": "deliver",
            "cancel-order": "cancel"
          };
          await api(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
            method: "PATCH",
            body: JSON.stringify({
              orderAction: actionMap[button.dataset.action || ""] || "",
              estimatedDelivery: card.querySelector('[data-field="estimatedDelivery"]')?.value || "",
              adminNotes: card.querySelector('[data-field="adminNotes"]')?.value || ""
            })
          });
          state.loaded.orders = false;
          state.loaded.payments = false;
          state.loaded.dashboard = false;
          await Promise.all([loadOrders(true), loadPayments(true), loadOverview(true)]);
          showFlash(
            button.dataset.action === "ship-order"
              ? `Order ${orderId} marked as shipped.`
              : button.dataset.action === "deliver-order"
                ? `Order ${orderId} marked as delivered.`
                : `Order ${orderId} cancelled.`,
            false
          );
          return;
        }

        if (button.dataset.action === "manual-override-order") {
          const nextStatus = card.querySelector('[data-field="manualOrderStatus"]')?.value || order.orderStatus;
          if (!window.confirm(`Apply a manual override to ${orderId} and set it to ${titleCase(nextStatus)}? Payment will remain automatic.`)) {
            return;
          }
          await api(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
            method: "PATCH",
            body: JSON.stringify({
              manualOverride: true,
              orderStatus: nextStatus,
              estimatedDelivery: card.querySelector('[data-field="estimatedDelivery"]')?.value || "",
              adminNotes: card.querySelector('[data-field="adminNotes"]')?.value || ""
            })
          });
          state.loaded.orders = false;
          state.loaded.payments = false;
          state.loaded.dashboard = false;
          await Promise.all([loadOrders(true), loadPayments(true), loadOverview(true)]);
          showFlash(`Manual override applied to ${orderId}.`, false);
        }
      });
    }

    if (nodes.customersList) {
      nodes.customersList.addEventListener("click", async function (event) {
        const button = event.target.closest("button[data-action]");
        if (!(button instanceof HTMLButtonElement)) return;
        const card = button.closest("[data-customer-id]");
        if (!(card instanceof HTMLElement)) return;
        const customerId = card.getAttribute("data-customer-id") || "";
        const customer = state.customers.find(function (entry) { return String(entry.id) === customerId; });
        if (!customer) return;

        if (button.dataset.action === "toggle-ban") {
          const banReason = customer.isBanned ? "" : window.prompt("Reason for restriction", customer.banReason || "Suspicious activity") || "";
          await api(`/api/admin/customers/${encodeURIComponent(customerId)}`, {
            method: "PATCH",
            body: JSON.stringify({
              isBanned: !customer.isBanned,
              banReason
            })
          });
          state.loaded.customers = false;
          state.loaded.team = false;
          await Promise.all([loadCustomers(true), hasPermission("users") ? loadTeam(true) : Promise.resolve()]);
          showFlash(customer.isBanned ? "Customer restored." : "Customer restricted.", false);
          return;
        }

        if (button.dataset.action === "reset-password") {
          const result = await api(`/api/admin/customers/${encodeURIComponent(customerId)}/reset-password`, {
            method: "POST",
            body: JSON.stringify({})
          });
          window.alert(`Temporary password: ${result.temporaryPassword}${result.emailed ? "\nThe customer was emailed too." : "\nEmail delivery was not confirmed."}`);
          showFlash("Temporary password generated.", false);
        }
      });
    }

    if (nodes.couponForm instanceof HTMLFormElement) {
      syncCouponCapField(nodes.couponForm);
      if (nodes.couponCodeGenerateBtn instanceof HTMLButtonElement) {
        nodes.couponCodeGenerateBtn.addEventListener("click", function () {
          const codeField = getField(nodes.couponForm, "code");
          if (codeField instanceof HTMLInputElement) {
            codeField.value = generateCouponCode(nodes.couponForm);
            codeField.focus();
          }
        });
      }

      nodes.couponForm.addEventListener("change", function (event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.matches('[name="discountType"]')) {
          syncCouponCapField(nodes.couponForm);
        }
      });
      nodes.couponForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        try {
          const payload = buildCouponPayloadFromScope(nodes.couponForm);
          await api("/api/admin/coupons", {
            method: "POST",
            body: JSON.stringify(payload)
          });
          nodes.couponForm.reset();
          const launchLiveField = getField(nodes.couponForm, "isActive");
          if (launchLiveField instanceof HTMLInputElement) {
            launchLiveField.checked = true;
          }
          syncCouponCapField(nodes.couponForm);
          state.loaded.coupons = false;
          await loadCoupons(true);
          showFlash("Coupon created.", false);
        } catch (error) {
          showFlash(error.message || "Unable to create coupon.", true);
        }
      });
    }

    if (nodes.couponsList) {
      nodes.couponsList.addEventListener("change", function (event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.matches('[data-field="discountType"]')) return;
        const card = target.closest("[data-coupon-code]");
        if (!(card instanceof HTMLElement)) return;
        syncCouponCapField(card);
      });

      nodes.couponsList.addEventListener("click", async function (event) {
        const button = event.target.closest("button[data-action]");
        if (!(button instanceof HTMLButtonElement)) return;
        const card = button.closest("[data-coupon-code]");
        if (!(card instanceof HTMLElement)) return;
        const code = card.getAttribute("data-coupon-code") || "";
        if (!code) return;
        if (!["save-coupon", "toggle-coupon", "delete-coupon"].includes(button.dataset.action || "")) return;

        try {
          if (button.dataset.action === "delete-coupon") {
            if (!window.confirm(`Delete coupon ${code}? This cannot be undone.`)) return;
            try {
              await api(`/api/admin/coupons/${encodeURIComponent(code)}`, { method: "DELETE" });
            } catch (_deleteError) {
              await api(`/api/admin/coupons/${encodeURIComponent(code)}/delete`, {
                method: "POST",
                body: JSON.stringify({})
              });
            }
            state.loaded.coupons = false;
            await loadCoupons(true);
            showFlash(`Coupon ${code} deleted.`, false);
            return;
          }

          const payload = buildCouponPayloadFromScope(card);
          if (button.dataset.action === "toggle-coupon") {
            const currentCoupon = state.coupons.find(function (entry) {
              return String(entry?.code || "").trim().toUpperCase() === code.toUpperCase();
            });
            payload.isActive = currentCoupon ? currentCoupon.isActive === false : !getScopedFieldChecked(card, "isActive");
          }

          await api(`/api/admin/coupons/${encodeURIComponent(code)}`, {
            method: "PATCH",
            body: JSON.stringify(payload)
          });
          state.loaded.coupons = false;
          await loadCoupons(true);
          showFlash(
            button.dataset.action === "toggle-coupon"
              ? `Coupon ${code} ${payload.isActive ? "resumed" : "paused"}.`
              : `Coupon ${code} updated.`,
            false
          );
        } catch (error) {
          showFlash(error.message || `Unable to update coupon ${code}.`, true);
        }
      });
    }

    if (nodes.settingsForm instanceof HTMLFormElement) {
      nodes.settingsForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const payload = {
          shipping: {
            defaultDomesticFeeNgn: Number(getFieldValue(nodes.settingsForm, "defaultDomesticFeeNgn") || 0),
            lagosFeeNgn: Number(getFieldValue(nodes.settingsForm, "lagosFeeNgn") || 0),
            otherStatesFeeNgn: Number(getFieldValue(nodes.settingsForm, "otherStatesFeeNgn") || 0),
            internationalFeeNgn: Number(getFieldValue(nodes.settingsForm, "internationalFeeNgn") || 0),
            freeShippingThresholdNgn: Number(getFieldValue(nodes.settingsForm, "freeShippingThresholdNgn") || 0),
            deliveryTimes: {
              lagos: getFieldValue(nodes.settingsForm, "lagosDelivery").trim(),
              otherStates: getFieldValue(nodes.settingsForm, "otherStatesDelivery").trim(),
              international: getFieldValue(nodes.settingsForm, "internationalDelivery").trim()
            }
          },
          security: {
            adminSessionTimeoutMinutes: Number(getFieldValue(nodes.settingsForm, "adminSessionTimeoutMinutes") || 30),
            activityLogsRetentionDays: Number(getFieldValue(nodes.settingsForm, "activityLogsRetentionDays") || 30),
            twoFactorEnabled: getFieldChecked(nodes.settingsForm, "twoFactorEnabled")
          }
        };
        const result = await api("/api/admin/settings", {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        state.settings = result.settings || payload;
        fillSettingsForm();
        setSessionTimeout(Number(state.settings?.security?.adminSessionTimeoutMinutes || 30));
        showFlash("Settings updated.", false);
      });
    }

    document.addEventListener("click", async function (event) {
      const exportButton = event.target.closest("[data-log-export]");
      if (exportButton instanceof HTMLButtonElement) {
        const period = exportButton.getAttribute("data-log-export") || "retention";
        const format = exportButton.getAttribute("data-log-format") || "csv";
        exportButton.disabled = true;
        try {
          await downloadAdminFile(
            `/api/admin/logs/export?period=${encodeURIComponent(period)}&format=${encodeURIComponent(format)}`,
            `benzy-admin-statement-${period}.${format}`
          );
          showFlash(`Activity log ${period} ${format.toUpperCase()} statement downloaded.`, false);
        } catch (error) {
          showFlash(error.message || "Unable to download activity statement.", true);
        } finally {
          exportButton.disabled = false;
        }
        return;
      }

      const emailButton = event.target.closest("[data-log-email]");
      if (emailButton instanceof HTMLButtonElement) {
        const period = emailButton.getAttribute("data-log-email") || "retention";
        const format = emailButton.getAttribute("data-log-format") || "csv";
        const originalLabel = emailButton.textContent;
        emailButton.disabled = true;
        emailButton.textContent = "Sending...";
        setLogArchiveStatus(`Sending ${period} ${format.toUpperCase()} statement to the admin email...`, false);
        try {
          const result = await api("/api/admin/logs/email", {
            method: "POST",
            body: JSON.stringify({ period, format })
          });
          const successMessage = `${format.toUpperCase()} activity statement sent to ${result.sentTo || "admin email"}.`;
          setLogArchiveStatus(successMessage, false);
          showFlash(successMessage, false);
        } catch (error) {
          const errorMessage = error.message || "Unable to email activity statement.";
          setLogArchiveStatus(errorMessage, true);
          showFlash(errorMessage, true);
        } finally {
          emailButton.disabled = false;
          emailButton.textContent = originalLabel;
        }
      }

    });

    if (nodes.contentForm instanceof HTMLFormElement) {
      nodes.contentForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        let faq = [];
        try {
          faq = JSON.parse(getFieldValue(nodes.contentForm, "faq") || "[]");
        } catch (_error) {
          showFlash("FAQ must be a valid JSON array.", true);
          return;
        }

        const payload = {
          homepageBanner: {
            eyebrow: getFieldValue(nodes.contentForm, "homepageEyebrow").trim(),
            title: getFieldValue(nodes.contentForm, "homepageTitle").trim(),
            ctaLabel: getFieldValue(nodes.contentForm, "homepageCtaLabel").trim(),
            ctaUrl: getFieldValue(nodes.contentForm, "homepageCtaUrl").trim(),
            subtitle: getFieldValue(nodes.contentForm, "homepageSubtitle").trim()
          },
          heroSection: {
            heading: getFieldValue(nodes.contentForm, "heroHeading").trim(),
            body: getFieldValue(nodes.contentForm, "heroBody").trim()
          },
          aboutUs: getFieldValue(nodes.contentForm, "aboutUs").trim(),
          contactInfo: {
            email: getFieldValue(nodes.contentForm, "contactEmail").trim(),
            phone: getFieldValue(nodes.contentForm, "contactPhone").trim(),
            address: getFieldValue(nodes.contentForm, "contactAddress").trim()
          },
          faq: faq,
          policyPages: {
            shipping: getFieldValue(nodes.contentForm, "policyShipping").trim(),
            returns: getFieldValue(nodes.contentForm, "policyReturns").trim(),
            privacy: getFieldValue(nodes.contentForm, "policyPrivacy").trim(),
            terms: getFieldValue(nodes.contentForm, "policyTerms").trim()
          },
          footerContent: {
            headline: getFieldValue(nodes.contentForm, "footerHeadline").trim(),
            body: getFieldValue(nodes.contentForm, "footerBody").trim(),
            newsletterNote: getFieldValue(nodes.contentForm, "footerNewsletterNote").trim()
          },
          newsletterSection: {
            title: getFieldValue(nodes.contentForm, "newsletterTitle").trim(),
            body: getFieldValue(nodes.contentForm, "newsletterBody").trim()
          }
        };
        const result = await api("/api/admin/content", {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        state.content = result.content || payload;
        fillContentForm();
        showFlash("Content updated.", false);
      });
    }

    if (nodes.exportSubscribersBtn) {
      nodes.exportSubscribersBtn.addEventListener("click", function () {
        const subscribers = Array.isArray(state.newsletter?.subscribers) ? state.newsletter.subscribers : [];
        if (!subscribers.length) {
          showFlash("There are no subscribers to export yet.", true);
          return;
        }
        downloadCsv("benzy-subscribers.csv", [["Email", "Source", "Subscribed At", "Discount Code", "Discount Used"]].concat(
          subscribers.map(function (subscriber) {
            return [
              subscriber.email,
              subscriber.source,
              subscriber.subscribedAt,
              subscriber.discountCode,
              subscriber.discountUsed ? "Yes" : "No"
            ];
          })
        ));
      });
    }

    if (nodes.newsletterForm instanceof HTMLFormElement) {
      nodes.newsletterForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const payload = {
          subject: getFieldValue(nodes.newsletterForm, "subject").trim(),
          body: getFieldValue(nodes.newsletterForm, "body").trim()
        };
        const result = await api("/api/admin/newsletter/announce", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        showFlash(`Announcement sent to ${result.sentCount} subscriber(s).`, false);
      });
    }

    if (nodes.reviewForm instanceof HTMLFormElement) {
      nodes.reviewForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        await api("/api/admin/reviews", {
          method: "POST",
          body: JSON.stringify({
            customerName: getFieldValue(nodes.reviewForm, "customerName").trim(),
            productName: getFieldValue(nodes.reviewForm, "productName").trim(),
            rating: Number(getFieldValue(nodes.reviewForm, "rating") || 5),
            comment: getFieldValue(nodes.reviewForm, "comment").trim(),
            featured: getFieldChecked(nodes.reviewForm, "featured")
          })
        });
        nodes.reviewForm.reset();
        getField(nodes.reviewForm, "rating").value = "5";
        state.loaded.reviews = false;
        await loadReviews(true);
        showFlash("Review saved.", false);
      });
    }

    if (nodes.reviewsList) {
      nodes.reviewsList.addEventListener("click", async function (event) {
        const button = event.target.closest("button[data-action]");
        if (!(button instanceof HTMLButtonElement)) return;
        if (button.dataset.action !== "save-review") return;
        const card = button.closest("[data-review-id]");
        if (!(card instanceof HTMLElement)) return;
        const reviewId = card.getAttribute("data-review-id") || "";
        await api(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: card.querySelector('[data-field="status"]')?.value || "approved",
            featured: Boolean(card.querySelector('[data-field="featured"]')?.checked)
          })
        });
        state.loaded.reviews = false;
        await loadReviews(true);
        showFlash("Review updated.", false);
      });
    }

    if (nodes.messagesList) {
      nodes.messagesList.addEventListener("click", async function (event) {
        const button = event.target.closest("button[data-action]");
        if (!(button instanceof HTMLButtonElement)) return;
        const card = button.closest("[data-message-id]");
        if (!(card instanceof HTMLElement)) return;
        const messageId = card.getAttribute("data-message-id") || "";
        const payload = {
          internalNote: card.querySelector('[data-field="internalNote"]')?.value || ""
        };

        if (button.dataset.action === "resolve-message") {
          payload.status = "resolved";
        } else if (button.dataset.action === "reopen-message") {
          payload.status = "in_progress";
        } else if (button.dataset.action !== "save-message") {
          return;
        }

        const response = await api(`/api/admin/messages/${encodeURIComponent(messageId)}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
        state.loaded.messages = false;
        state.loaded.dashboard = false;
        await Promise.all([loadMessages(true), loadOverview(true)]);
        showFlash(
          button.dataset.action === "resolve-message"
            ? buildResolvedMessageFlash(response?.messageRecord)
            : button.dataset.action === "reopen-message"
              ? "Message reopened."
              : "Message note saved.",
          false
        );
      });
    }

    if (nodes.teamList) {
      nodes.teamList.addEventListener("click", async function (event) {
        const roleOption = event.target.closest("button[data-admin-role-option]");
        if (roleOption instanceof HTMLButtonElement) {
          const card = roleOption.closest("[data-user-id]");
          if (!(card instanceof HTMLElement)) return;
          const nextRole = roleOption.getAttribute("data-admin-role-option") || "customer_support_admin";
          const hiddenField = card.querySelector('[data-field="adminRole"]');
          const picker = roleOption.closest(".admin-role-picker");
          const summaryLabel = picker?.querySelector("summary span");
          if (hiddenField instanceof HTMLInputElement) hiddenField.value = nextRole;
          if (summaryLabel instanceof HTMLElement) summaryLabel.textContent = titleCase(nextRole);
          Array.from(card.querySelectorAll("[data-admin-role-option]")).forEach(function (entry) {
            entry.classList.toggle("active", entry === roleOption);
          });
          if (picker instanceof HTMLDetailsElement) picker.open = false;
          return;
        }

        const button = event.target.closest("button[data-action]");
        if (!(button instanceof HTMLButtonElement)) return;
        const card = button.closest("[data-user-id]");
        if (!(card instanceof HTMLElement)) return;
        const userId = card.getAttribute("data-user-id") || "";

        if (button.dataset.action === "delete-user") {
          if (!window.confirm("Delete this user?")) return;
          await api(`/api/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE", body: JSON.stringify({}) });
          state.loaded.team = false;
          state.loaded.customers = false;
          await Promise.all([loadTeam(true), hasPermission("customers") ? loadCustomers(true) : Promise.resolve()]);
          showFlash("User deleted.", false);
          return;
        }

        if (button.dataset.action === "save-user") {
          const result = await api(`/api/admin/users/${encodeURIComponent(userId)}`, {
            method: "PATCH",
            body: JSON.stringify({
              name: card.querySelector('[data-field="name"]')?.value || "",
              phone: card.querySelector('[data-field="phone"]')?.value || "",
              role: card.querySelector('[data-field="role"]')?.value || "resident",
              adminRole: card.querySelector('[data-field="adminRole"]')?.value || "customer_support_admin"
            })
          });
          if (result?.token) {
            setToken(result.token);
            state.user = { ...(state.user || {}), ...(result.user || {}) };
            state.permissions = getPermissionsForUser(state.user);
            renderCurrentUser();
            refreshVisibleNav();
          }
          state.loaded.team = false;
          state.loaded.customers = false;
          await Promise.all([loadTeam(true), hasPermission("customers") ? loadCustomers(true) : Promise.resolve()]);
          showFlash("User updated.", false);
        }
      });
    }

    if (nodes.paymentsList) {
      nodes.paymentsList.addEventListener("click", async function (event) {
        const button = event.target.closest("button[data-action]");
        if (!(button instanceof HTMLButtonElement)) return;
        if (button.dataset.action !== "refund-payment") return;
        const card = button.closest("[data-order-id]");
        if (!(card instanceof HTMLElement)) return;
        const orderId = card.getAttribute("data-order-id") || "";
        if (!orderId) return;
        const amount = window.prompt("Refund amount in NGN");
        if (amount == null) return;
        const reason = window.prompt("Refund reason", "Refund recorded by admin") || "Refund recorded by admin";
        await api(`/api/admin/orders/${encodeURIComponent(orderId)}/refund`, {
          method: "POST",
          body: JSON.stringify({ amount: Number(amount || 0), reason: reason })
        });
        state.loaded.payments = false;
        state.loaded.orders = false;
        state.loaded.dashboard = false;
        await Promise.all([loadPayments(true), hasPermission("orders") ? loadOrders(true) : Promise.resolve(), loadOverview(true)]);
        showFlash(`Refund recorded for ${orderId}.`, false);
      });
    }

    if (nodes.paymentsSummary) {
      nodes.paymentsSummary.addEventListener("click", function (event) {
        const button = event.target.closest("[data-metric-action]");
        if (!(button instanceof HTMLElement)) return;
        if (button.getAttribute("data-metric-action") !== "payment-records") return;
        nodes.paymentsList?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    window.addEventListener("hashchange", function () {
      setSection(getSectionFromHash(), false).catch(function () {});
    });
  }

  async function init() {
    updateClock();
    window.setInterval(updateClock, 60000);
    bindEvents();
    const authenticated = await ensureHostSession();
    if (!authenticated) return;
    refreshVisibleNav();
    await loadOverview(true);
    await setSection(getSectionFromHash(), false);
  }

  init().catch(function (error) {
    showFlash(error.message || "Unable to load the admin dashboard.", true);
  });
})();

