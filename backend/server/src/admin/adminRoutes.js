const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');

const { getCollection } = require('../../mongo');
const Product = require('../cart/models/Product');
const Coupon = require('../cart/models/Coupon');
const {
  getBrevoConfig,
  isBrevoConfigured,
  sendOrderStatusUpdateEmail,
  sendPasswordResetEmail,
  sendTransactionalEmail
} = require('../services/brevoService');
const {
  isWatiConfigured,
  sendWatiSessionMessage
} = require('../services/watiService');

const ADMIN_ROLES = ['super_admin', 'operations_manager', 'product_manager', 'order_manager', 'customer_support_admin'];
const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({
  email: true,
  marketing: false,
  sms: true
});
const PRODUCT_UPLOAD_PUBLIC_PATH = '/uploads/products';
const PRODUCT_UPLOAD_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif']
]);
const PRODUCT_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

const DEFAULT_CONTENT = {
  homepageBanner: {
    eyebrow: 'Benzy Luxury',
    title: 'Welcome to Benzy Luxury',
    subtitle: 'A House of Timeless Elegance & Modern Luxury.',
    ctaLabel: 'Explore Luxury',
    ctaUrl: 'Shop.html'
  },
  heroSection: {
    heading: 'Luxury cut with edge.',
    body: ''
  },
  aboutUs: 'Benzy Luxury blends premium streetwear energy with polished tailoring and modern African fashion culture.',
  contactInfo: {
    email: 'admin@benzyluxury.com',
    phone: '+234 701 154 7813',
    address: 'Lagos, Nigeria'
  },
  faq: [
    {
      question: 'How do I create an account on the website?',
      answer: 'Open the Account page, choose Resident, and continue to the Profile page. There you can use the Create Account tab to register and start managing your orders and details.'
    },
    {
      question: 'How do I browse products by category?',
      answer: 'Use the Shop menu in the navigation bar to open All Products, Men, Women, or Accessories. This lets you move straight to the section you want without searching manually.'
    },
    {
      question: 'How do I search for a product quickly?',
      answer: 'Click the search icon to open the Search page, then type a product name or category. The search area is designed for quick product discovery and recent searches.'
    },
    {
      question: 'How do I add items to my cart?',
      answer: 'Select the product you want, choose any required options, and add it to your cart. You can then open the Cart page to review items, update quantities, or remove products before checkout.'
    },
    {
      question: 'Can I change the currency on the website?',
      answer: 'Yes. The website includes a currency selector on key shopping pages like Shop, Cart, and Checkout, so you can switch between supported currencies while viewing your order.'
    },
    {
      question: 'How do I use my saved address at checkout?',
      answer: 'Save your delivery details in your Profile first, then go to Checkout and choose one of your saved addresses from the address dropdown. The checkout page updates once an address is selected.'
    },
    {
      question: 'Where can I track my order on the website?',
      answer: 'Sign in to your Profile and open the Orders or Track Your Order section. You can view order history there and enter your order number to check its latest status.'
    },
    {
      question: 'Where can I manage my profile details?',
      answer: 'Your Profile page is the main place to manage your account details, saved addresses, orders, and other personal settings connected to your shopping experience.'
    },
    {
      question: 'What should I do if my payment does not go through?',
      answer: 'Return to the Checkout page and try the payment again after confirming your details. If the issue continues, use the Contact page so the Benzy Luxury team can assist you quickly.'
    },
    {
      question: 'How can I contact Benzy Luxury through the website?',
      answer: 'You can send a message directly from the Contact page using the contact form, or reach the brand through the listed email address and phone number for support.'
    }
  ],
  policyPages: {
    shipping: 'Benzy Luxury aims to process and ship orders within the estimated delivery period communicated to the Customer. However, delivery timelines may vary due to courier delays, weather conditions, public holidays, or incorrect delivery information provided by the Customer.\n\nThe Customer is responsible for providing accurate shipping details. Benzy Luxury shall not be liable for delays or failed deliveries caused by incorrect information supplied by the Customer.',
    returns: 'Returns or exchanges may only be accepted where the item received is damaged, defective, or incorrect; the Customer reports the issue within 48 hours of delivery; and the item remains unused and in its original condition.\n\nFor hygiene and quality assurance reasons, certain items may not qualify for return or exchange. Benzy Luxury reserves the right to inspect returned items before approving any refund or exchange.',
    privacy: 'Benzy Luxury respects the privacy of its customers and is committed to protecting personal information shared during transactions.\n\nCustomer information collected shall only be used for order processing, delivery coordination, customer support, and business communication. Benzy Luxury shall not knowingly share customer information with unauthorized third parties except where required by law or necessary for order fulfillment.',
    terms: 'The Customer agrees to use the Benzy Luxury website and services lawfully and in accordance with these policies. Any misuse of the website, fraudulent activity, or violation of these terms may result in refusal of service, cancellation of orders, or legal action where necessary.'
  },
  footerContent: {
    headline: 'Benzy Luxury',
    body: 'Premium essentials, statement jerseys, and elevated streetwear.',
    newsletterNote: 'Join the list for new drops and private offers.'
  },
  newsletterSection: {
    title: 'Stay close to the next drop',
    body: 'Collect subscriber emails, push announcements through Brevo, and track where each signup came from.'
  }
};

const CONTACT_INFO_DEFAULTS = Object.freeze({
  email: 'admin@benzyluxury.com',
  phone: '+234 701 154 7813',
  address: 'Lagos, Nigeria'
});
const LEGACY_CONTACT_EMAILS = new Set(['hello@benzyluxury.com', 'lilbenzyy@gmail.com']);
const LEGACY_CONTACT_PHONE_VALUES = new Set(['+2340000000000', '2340000000000']);
const LEGACY_POLICY_PLACEHOLDERS = new Set([
  'Add your shipping policy here.',
  'Add your returns and exchange policy here.',
  'Add your privacy policy here.',
  'Add your terms and conditions here.'
]);

function normalizeContactPhoneValue(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function normalizeSiteContentPayload(payload) {
  const next = payload && typeof payload === 'object'
    ? JSON.parse(JSON.stringify(payload))
    : {};
  const contactInfo = next.contactInfo && typeof next.contactInfo === 'object'
    ? next.contactInfo
    : {};
  const rawEmail = String(contactInfo.email || '').trim();
  const rawPhone = String(contactInfo.phone || '').trim();
  const rawAddress = String(contactInfo.address || '').trim();

  next.contactInfo = {
    ...contactInfo,
    email: rawEmail && !LEGACY_CONTACT_EMAILS.has(rawEmail.toLowerCase()) ? rawEmail : CONTACT_INFO_DEFAULTS.email,
    phone: rawPhone && !LEGACY_CONTACT_PHONE_VALUES.has(normalizeContactPhoneValue(rawPhone)) ? rawPhone : CONTACT_INFO_DEFAULTS.phone,
    address: rawAddress || CONTACT_INFO_DEFAULTS.address
  };

  const policyPages = next.policyPages && typeof next.policyPages === 'object'
    ? next.policyPages
    : {};
  next.policyPages = {
    ...policyPages,
    terms: LEGACY_POLICY_PLACEHOLDERS.has(String(policyPages.terms || '').trim()) ? DEFAULT_CONTENT.policyPages.terms : policyPages.terms,
    shipping: LEGACY_POLICY_PLACEHOLDERS.has(String(policyPages.shipping || '').trim()) ? DEFAULT_CONTENT.policyPages.shipping : policyPages.shipping,
    returns: LEGACY_POLICY_PLACEHOLDERS.has(String(policyPages.returns || '').trim()) ? DEFAULT_CONTENT.policyPages.returns : policyPages.returns,
    privacy: LEGACY_POLICY_PLACEHOLDERS.has(String(policyPages.privacy || '').trim()) ? DEFAULT_CONTENT.policyPages.privacy : policyPages.privacy
  };

  return next;
}

const ADMIN_PERMISSION_MAP = {
  super_admin: [
    'dashboard',
    'products',
    'orders',
    'customers',
    'messages',
    'payments',
    'coupons',
    'settings',
    'content',
    'newsletter',
    'reviews',
    'users',
    'logs'
  ],
  product_manager: ['dashboard', 'products', 'coupons', 'content'],
  operations_manager: ['dashboard', 'products', 'orders', 'customers', 'messages', 'payments', 'coupons', 'settings', 'content', 'newsletter', 'reviews', 'logs'],
  order_manager: ['dashboard', 'orders', 'payments', 'settings'],
  customer_support_admin: ['dashboard', 'orders', 'customers', 'messages', 'newsletter', 'reviews']
};

function createAdminRouter(dependencies) {
  const {
    asyncHandler,
    authMiddleware,
    requireHost,
    readOrders,
    readSettings,
    readSubscribers,
    readUsers,
    sanitizePlainText,
    signToken,
    toPublicUser,
    updateOrderRecord,
    buildNewsletterUnsubscribeUrl,
    saveProductUploadAsset,
    writeSettings,
    writeUsers
  } = dependencies;

  const router = express.Router();

  function getAdminContext(req) {
    return req.adminContext || { current: null, users: [] };
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
  }

  function normalizeNotificationSettings(source) {
    const settings = source && typeof source === 'object' ? source : {};
    return {
      email: settings.email === undefined ? DEFAULT_NOTIFICATION_SETTINGS.email : Boolean(settings.email),
      marketing: settings.marketing === undefined ? DEFAULT_NOTIFICATION_SETTINGS.marketing : Boolean(settings.marketing),
      sms: settings.sms === undefined ? DEFAULT_NOTIFICATION_SETTINGS.sms : Boolean(settings.sms)
    };
  }

  function normalizeWhatsAppPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.startsWith('00') ? digits.slice(2) : digits;
  }

  function safeString(value, maxLength = 160) {
    return typeof sanitizePlainText === 'function'
      ? sanitizePlainText(value, maxLength)
      : String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  }

  function safeMultiline(value, maxLength = 2400) {
    return String(value || '')
      .replace(/[<>]/g, '')
      .replace(/\r\n?/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, maxLength);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function toPositiveNumber(value, fallback = 0) {
    const parsed = toNumber(value, fallback);
    return parsed >= 0 ? parsed : fallback;
  }

  function toInteger(value, fallback = 0) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function toBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    }
    if (typeof value === 'number') return value !== 0;
    return fallback;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function deepMerge(base, extra) {
    const output = Array.isArray(base) ? [...base] : { ...(base || {}) };
    if (!extra || typeof extra !== 'object') return output;

    Object.entries(extra).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        output[key] = [...value];
        return;
      }

      if (value && typeof value === 'object') {
        output[key] = deepMerge(output[key] && typeof output[key] === 'object' ? output[key] : {}, value);
        return;
      }

      output[key] = value;
    });

    return output;
  }

  function normalizeAdminRole(user) {
    const isHost = String(user?.role || '').trim().toLowerCase() === 'host';
    if (!isHost) return '';
    const role = String(user?.adminRole || '').trim().toLowerCase();
    return ADMIN_ROLES.includes(role) ? role : 'super_admin';
  }

  function getPermissionsForUser(user) {
    const role = normalizeAdminRole(user);
    return new Set(ADMIN_PERMISSION_MAP[role] || []);
  }

  function hasPermission(user, permission) {
    if (!permission) return true;
    return getPermissionsForUser(user).has(permission);
  }

  function requirePermission(req, res, permission) {
    const currentUser = getAdminContext(req).current;
    if (hasPermission(currentUser, permission)) return true;
    res.status(403).json({ error: `You do not have permission to manage ${permission}.` });
    return false;
  }

  function isSuperAdmin(user) {
    return normalizeAdminRole(user) === 'super_admin';
  }

  function getRequestIpAddress(req) {
    const forwardedFor = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    return safeString(forwardedFor || req?.ip || req?.socket?.remoteAddress || 'Unknown location', 80);
  }

  function getRequestDevice(req) {
    return safeString(req?.headers?.['user-agent'] || 'Unknown device', 220);
  }

  function normalizeOrderStatus(status) {
    const value = String(status || '').trim().toLowerCase();
    if (['pending', 'pending verification', 'pending_verification', 'awaiting_confirmation'].includes(value)) return 'pending';
    if (['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'failed', 'returned', 'exchanged'].includes(value)) return value;
    return 'pending';
  }

  function normalizePaymentStatus(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (['paid', 'success', 'successful'].includes(raw)) return 'paid';
    if (['failed', 'error', 'abandoned'].includes(raw)) return 'failed';
    if (raw === 'refunded') return 'refunded';
    return 'pending';
  }

  function normalizePaymentMethod(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (['card', 'card payment'].includes(raw)) return 'card';
    if (['bank', 'bank transfer', 'bank_transfer'].includes(raw)) return 'bank_transfer';
    if (raw === 'wallet') return 'wallet';
    if (raw === 'paystack') return 'paystack';
    if (raw === 'flutterwave') return 'flutterwave';
    return raw || 'unknown';
  }

  function normalizeContactMessageStatus(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['new', 'unread'].includes(normalized)) return 'new';
    if (['in_progress', 'in-progress', 'open', 'working'].includes(normalized)) return 'in_progress';
    if (['resolved', 'closed', 'done'].includes(normalized)) return 'resolved';
    return 'new';
  }

  function buildContactWorkflow(entry, overrides = null) {
    const source = entry && typeof entry === 'object' ? entry : {};
    const delivery = source.delivery && typeof source.delivery === 'object' ? source.delivery : {};
    const emailDelivery = delivery.email && typeof delivery.email === 'object' ? delivery.email : {};
    const whatsappDelivery = delivery.whatsapp && typeof delivery.whatsapp === 'object' ? delivery.whatsapp : {};
    const nextInternalNote = safeMultiline(
      overrides && Object.prototype.hasOwnProperty.call(overrides, 'internalNote')
        ? overrides.internalNote
        : source.internalNote,
      800
    );
    const existingStatus = normalizeContactMessageStatus(source.status);
    const requestedStatus = overrides && Object.prototype.hasOwnProperty.call(overrides, 'status')
      ? normalizeContactMessageStatus(overrides.status)
      : '';
    const supportDeliveredCount = Array.isArray(emailDelivery.supportDelivered) ? emailDelivery.supportDelivered.length : 0;
    const senderAcknowledged = emailDelivery.senderAcknowledged === true;
    const whatsappReady = whatsappDelivery.ready === true;
    const whatsappSent = whatsappDelivery.sent === true;
    const hasInternalNote = Boolean(nextInternalNote);
    const systemTriaged = supportDeliveredCount > 0 || senderAcknowledged || whatsappReady || whatsappSent;
    let status = 'new';

    if (requestedStatus === 'resolved') {
      status = 'resolved';
    } else if (requestedStatus === 'in_progress') {
      status = 'in_progress';
    } else if (requestedStatus === 'new') {
      status = 'new';
    } else if (existingStatus === 'resolved') {
      status = 'resolved';
    } else if (hasInternalNote || systemTriaged) {
      status = 'in_progress';
    }

    let mode = 'new';
    let title = 'Fresh inbox item';
    let body = 'This message is still new and has not picked up any follow-up activity yet.';

    if (status === 'resolved') {
      mode = 'resolved';
      title = 'Conversation resolved';
      body = 'The thread is closed for now. Reopen it only if the customer needs another follow-up.';
    } else if (hasInternalNote) {
      mode = 'owned';
      title = 'Host follow-up in progress';
      body = 'A private note already exists, so this conversation is being actively handled.';
    } else if (systemTriaged) {
      mode = 'triaged';
      title = 'System triaged and routed';
      body = 'Support delivery and acknowledgement signals have already moved this message into the working queue automatically.';
    }

    return {
      status,
      mode,
      title,
      body,
      hasInternalNote,
      systemTriaged,
      supportDeliveredCount,
      senderAcknowledged,
      whatsappReady,
      whatsappSent
    };
  }

  function buildTracking(status, orderDate) {
    const normalized = normalizeOrderStatus(status);
    const steps = ['placed', 'confirmed', 'processing', 'shipped', 'delivered'];
    const activeIndex = Math.max(0, steps.indexOf(normalized));
    const baseDate = orderDate || new Date().toISOString().slice(0, 10);
    return steps.reduce((acc, step, index) => {
      acc[step] = {
        date: index <= activeIndex ? baseDate : null,
        completed: index <= activeIndex
      };
      return acc;
    }, {});
  }

  function addDaysISO(dateString, days) {
    let base = dateString ? new Date(dateString) : new Date();
    if (Number.isNaN(base.getTime())) {
      base = new Date();
    }
    base.setDate(base.getDate() + days);
    return base.toISOString().slice(0, 10);
  }

  function deriveManagedOrderStatus(orderStatus, paymentStatus) {
    const normalizedOrderStatus = normalizeOrderStatus(orderStatus);
    const normalizedPaymentStatus = normalizePaymentStatus(paymentStatus);

    if (normalizedPaymentStatus === 'paid' && ['pending', 'placed', 'confirmed'].includes(normalizedOrderStatus)) {
      return 'processing';
    }

    if (normalizedPaymentStatus === 'failed' && ['pending', 'placed', 'confirmed', 'processing'].includes(normalizedOrderStatus)) {
      return 'failed';
    }

    if (normalizedPaymentStatus === 'refunded' && ['pending', 'placed', 'confirmed', 'processing'].includes(normalizedOrderStatus)) {
      return 'cancelled';
    }

    if (normalizedPaymentStatus === 'pending' && ['processing', 'shipped', 'delivered'].includes(normalizedOrderStatus)) {
      return 'confirmed';
    }

    return normalizedOrderStatus;
  }

  function buildOrderAutomation(order) {
    const paymentMethodCode = normalizePaymentMethod(order?.paymentMethodCode || order?.paymentMethod);
    const paymentStatus = normalizePaymentStatus(order?.paymentStatus);
    const orderStatus = normalizeOrderStatus(order?.orderStatus || order?.status);
    const requiresTransferReview = paymentMethodCode === 'bank_transfer'
      && paymentStatus !== 'paid'
      && paymentStatus !== 'refunded'
      && orderStatus !== 'cancelled'
      && orderStatus !== 'failed';

    if (paymentStatus === 'paid') {
      return {
        requiresTransferReview: false,
        paymentLocked: true,
        title: paymentMethodCode === 'bank_transfer' ? 'Transfer already confirmed' : 'Payment captured automatically',
        description: paymentMethodCode === 'bank_transfer'
          ? 'The transfer is already marked as paid, so hosts should focus on fulfilment only.'
          : 'Gateway and wallet payments stay locked once paid. Hosts should only manage fulfilment steps from here.'
      };
    }

    if (paymentStatus === 'refunded') {
      return {
        requiresTransferReview: false,
        paymentLocked: true,
        title: 'Refund recorded',
        description: 'This order payment has already been refunded, so there is no transfer confirmation left to perform.'
      };
    }

    if (paymentStatus === 'failed') {
      return {
        requiresTransferReview: false,
        paymentLocked: true,
        title: 'Payment failed',
        description: 'Fulfilment should stay paused until a successful payment is captured.'
      };
    }

    if (requiresTransferReview) {
      return {
        requiresTransferReview: true,
        paymentLocked: false,
        title: 'Awaiting bank transfer review',
        description: 'This is the only payment flow that may still need a one-time host confirmation.'
      };
    }

    return {
      requiresTransferReview: false,
      paymentLocked: true,
      title: 'Waiting for gateway update',
      description: 'Card, wallet, and gateway-backed orders update payment state automatically without host confirmation.'
    };
  }

  function resolveGuidedOrderActionStatus(existingStatus, paymentStatus, action) {
    const normalizedStatus = normalizeOrderStatus(existingStatus);
    const normalizedPaymentStatus = normalizePaymentStatus(paymentStatus);
    const normalizedAction = safeString(action || '', 40).toLowerCase();

    if (!normalizedAction) return { orderStatus: normalizedStatus };

    if (normalizedAction === 'ship') {
      if (normalizedPaymentStatus !== 'paid') {
        return { error: 'An order must be paid before it can be marked as shipped.' };
      }
      if (['cancelled', 'failed', 'delivered', 'returned', 'exchanged'].includes(normalizedStatus)) {
        return { error: 'This order can no longer be marked as shipped.' };
      }
      return { orderStatus: 'shipped' };
    }

    if (normalizedAction === 'deliver') {
      if (normalizedPaymentStatus !== 'paid') {
        return { error: 'An order must be paid before it can be marked as delivered.' };
      }
      if (['cancelled', 'failed', 'delivered', 'returned', 'exchanged'].includes(normalizedStatus)) {
        return { error: 'This order can no longer be marked as delivered.' };
      }
      return { orderStatus: 'delivered' };
    }

    if (normalizedAction === 'cancel') {
      if (['delivered', 'returned', 'exchanged'].includes(normalizedStatus)) {
        return { error: 'A completed order cannot be cancelled.' };
      }
      if (normalizedStatus === 'cancelled') {
        return { orderStatus: 'cancelled' };
      }
      return { orderStatus: 'cancelled' };
    }

    if (normalizedAction === 'return') {
      if (normalizedPaymentStatus !== 'paid') {
        return { error: 'An order must be paid before a return can be processed.' };
      }
      if (!['delivered', 'shipped'].includes(normalizedStatus)) {
        return { error: 'Only shipped or delivered orders can be returned.' };
      }
      return { orderStatus: 'returned' };
    }

    if (normalizedAction === 'exchange') {
      if (normalizedPaymentStatus !== 'paid') {
        return { error: 'An order must be paid before an exchange can be processed.' };
      }
      if (!['delivered', 'shipped'].includes(normalizedStatus)) {
        return { error: 'Only shipped or delivered orders can be exchanged.' };
      }
      return { orderStatus: 'exchanged' };
    }

    return { error: 'Unsupported order action.' };
  }

  function resolveManagedEstimatedDelivery(order, finalOrderStatus, explicitValue) {
    const requestedValue = safeString(explicitValue || '', 80);
    if (requestedValue) return requestedValue;

    const existingValue = safeString(order?.estimatedDelivery || '', 80);
    if (existingValue) return existingValue;

    const orderDate = safeString(order?.orderDate || order?.createdAt || new Date().toISOString().slice(0, 10), 80);
    if (finalOrderStatus === 'shipped') {
      return addDaysISO(new Date().toISOString().slice(0, 10), 3);
    }

    if (['cancelled', 'failed'].includes(finalOrderStatus)) {
      return null;
    }

    return addDaysISO(orderDate, 7);
  }

  function resolveManagedOrderUpdate(order, updates, actorEmail) {
    const payload = updates && typeof updates === 'object' ? updates : {};
    const existingOrderStatus = normalizeOrderStatus(order?.orderStatus || order?.status);
    const existingPaymentStatus = normalizePaymentStatus(order?.paymentStatus);
    const manualOverride = toBoolean(payload.manualOverride, false);
    const requestedPaymentStatus = Object.prototype.hasOwnProperty.call(payload, 'paymentStatus')
      ? normalizePaymentStatus(payload.paymentStatus)
      : existingPaymentStatus;
    const paymentMethodCode = normalizePaymentMethod(order?.paymentMethodCode || order?.paymentMethod);
    const confirmBankTransfer = toBoolean(payload.confirmBankTransfer, false);
    const metadata = {
      ...(order?.metadata && typeof order.metadata === 'object' ? order.metadata : {}),
      ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {})
    };
    const now = new Date().toISOString();
    const alreadyPaid = confirmBankTransfer && ['paid', 'refunded'].includes(existingPaymentStatus);
    let finalPaymentStatus = existingPaymentStatus;
    let actionDrivenOrderStatus = null;
    let manualOverrideStatus = null;

    if (confirmBankTransfer) {
      if (paymentMethodCode !== 'bank_transfer') {
        return { error: 'Only bank transfer orders can be manually confirmed.' };
      }

      if (!alreadyPaid) {
        finalPaymentStatus = 'paid';
        metadata.bankTransferConfirmedAt = metadata.bankTransferConfirmedAt || now;
        metadata.bankTransferConfirmedBy = normalizeEmail(actorEmail);
      }
    }

    if (manualOverride) {
      if (!Object.prototype.hasOwnProperty.call(payload, 'orderStatus')) {
        return { error: 'Manual override requires an order status.' };
      }
      manualOverrideStatus = normalizeOrderStatus(payload.orderStatus);
      metadata.manualOverrideAt = now;
      metadata.manualOverrideBy = normalizeEmail(actorEmail);

      if (manualOverrideStatus === 'shipped') {
        metadata.shippedAt = metadata.shippedAt || now;
        metadata.shippedBy = normalizeEmail(actorEmail);
      } else if (manualOverrideStatus === 'delivered') {
        metadata.deliveredAt = metadata.deliveredAt || now;
        metadata.deliveredBy = normalizeEmail(actorEmail);
      } else if (manualOverrideStatus === 'cancelled') {
        metadata.cancelledAt = metadata.cancelledAt || now;
        metadata.cancelledBy = normalizeEmail(actorEmail);
      }
    } else if (payload?.orderAction) {
      const actionResult = resolveGuidedOrderActionStatus(existingOrderStatus, finalPaymentStatus, payload.orderAction);
      if (actionResult.error) {
        return { error: actionResult.error };
      }
      actionDrivenOrderStatus = actionResult.orderStatus;
      if (payload.orderAction === 'ship') {
        metadata.shippedAt = metadata.shippedAt || now;
        metadata.shippedBy = normalizeEmail(actorEmail);
      } else if (payload.orderAction === 'deliver') {
        metadata.deliveredAt = metadata.deliveredAt || now;
        metadata.deliveredBy = normalizeEmail(actorEmail);
      } else if (payload.orderAction === 'cancel') {
        metadata.cancelledAt = metadata.cancelledAt || now;
        metadata.cancelledBy = normalizeEmail(actorEmail);
      }
    }

    const ignoredManualPaymentChange = !confirmBankTransfer
      && Object.prototype.hasOwnProperty.call(payload, 'paymentStatus')
      && requestedPaymentStatus !== existingPaymentStatus;
    const ignoredManualOrderChange = !manualOverride
      && !payload?.orderAction
      && Object.prototype.hasOwnProperty.call(payload, 'orderStatus')
      && normalizeOrderStatus(payload.orderStatus) !== existingOrderStatus;
    const finalOrderStatus = manualOverride
      ? (manualOverrideStatus || existingOrderStatus)
      : deriveManagedOrderStatus(actionDrivenOrderStatus || existingOrderStatus, finalPaymentStatus);
    const estimatedDelivery = resolveManagedEstimatedDelivery(order, finalOrderStatus, payload?.estimatedDelivery);
    const paidAt = finalPaymentStatus === 'paid'
      ? (order?.paidAt || metadata.bankTransferConfirmedAt || now)
      : finalPaymentStatus === 'refunded'
        ? (order?.paidAt || metadata.bankTransferConfirmedAt || null)
        : null;

    return {
      orderStatus: finalOrderStatus,
      paymentStatus: finalPaymentStatus,
      paidAt,
      estimatedDelivery,
      metadata,
      paymentMethodCode,
      manualOverrideUsed: manualOverride,
      ignoredManualOrderChange,
      ignoredManualPaymentChange,
      alreadyPaid
    };
  }

  function slugify(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const productCategoryAliases = ['men', 'women', 'accessories'];

  function extractProductCategoryIds(value) {
    const rawValues = Array.isArray(value) ? value : [value];
    const ids = [];

    rawValues.forEach((entry) => {
      const raw = String(entry || '').trim();
      if (!raw) return;
      const normalized = slugify(raw);
      productCategoryAliases.forEach((alias) => {
        const matcher = new RegExp(`(^|-)${alias}(-|$)`, 'i');
        if (matcher.test(normalized) && !ids.includes(alias)) ids.push(alias);
      });
      raw
        .split(/[,/&|]+|\band\b|\s+/i)
        .map((part) => slugify(part))
        .filter(Boolean)
        .forEach((part) => {
          if (!ids.includes(part)) ids.push(part);
        });
    });

    return ids;
  }

  function capitalizeWords(value) {
    return String(value || '')
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function parseArrayInput(value) {
    if (Array.isArray(value)) {
      return value.map((entry) => safeString(entry, 120)).filter(Boolean);
    }

    if (typeof value === 'string') {
      return value
        .split(/[\n,]+/)
        .map((entry) => safeString(entry, 120))
        .filter(Boolean);
    }

    return [];
  }

  async function readSingleton(collectionName, id, defaults) {
    const collection = await getCollection(collectionName);
    const existing = await collection.findOne({ _id: id });
    if (!existing) {
      const next = collectionName === 'site_content' && id === 'main'
        ? normalizeSiteContentPayload(defaults)
        : clone(defaults);
      await collection.insertOne({ _id: id, ...next });
      return next;
    }

    const merged = deepMerge(clone(defaults), existing);
    const normalized = collectionName === 'site_content' && id === 'main'
      ? normalizeSiteContentPayload(merged)
      : merged;
    delete normalized._id;

    if (JSON.stringify(normalized) !== JSON.stringify({ ...existing, _id: undefined })) {
      await collection.replaceOne({ _id: id }, { _id: id, ...normalized }, { upsert: true });
    }

    return normalized;
  }

  async function writeSingleton(collectionName, id, data) {
    const collection = await getCollection(collectionName);
    const next = collectionName === 'site_content' && id === 'main'
      ? normalizeSiteContentPayload(data)
      : clone(data);
    await collection.replaceOne({ _id: id }, { _id: id, ...next }, { upsert: true });
    return next;
  }

  async function logAdminActivity(req, activity) {
    try {
      const currentUser = getAdminContext(req).current || {};
      const collection = await getCollection('admin_activity_logs');
      await collection.insertOne({
        adminId: currentUser.id || '',
        adminEmail: normalizeEmail(currentUser.email),
        adminName: safeString(currentUser.name || currentUser.email || 'Admin', 120),
        adminRole: normalizeAdminRole(currentUser),
        action: safeString(activity?.action || 'updated', 80),
        area: safeString(activity?.area || 'general', 80),
        entityId: safeString(activity?.entityId || '', 120),
        message: safeString(activity?.message || '', 240),
        ipAddress: getRequestIpAddress(req),
        device: getRequestDevice(req),
        metadata: activity?.metadata && typeof activity.metadata === 'object' ? clone(activity.metadata) : {},
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Admin activity log failed:', error);
    }
  }

  function escapeCsvCell(value) {
    const safeValue = String(value ?? '').replace(/"/g, '""');
    return `"${safeValue}"`;
  }

  function buildCsv(rows) {
    return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
  }

  function getLogArchiveRange(period, retentionDays) {
    const now = new Date();
    const safeRetentionDays = Math.max(1, toInteger(retentionDays, 30));
    const normalizedPeriod = safeString(period || 'retention', 30).toLowerCase();
    let start = new Date(now.getTime() - (safeRetentionDays * 24 * 60 * 60 * 1000));
    let label = `last-${safeRetentionDays}-days`;

    if (normalizedPeriod === 'daily') {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      label = 'today';
    } else if (normalizedPeriod === 'weekly') {
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      label = 'last-7-days';
    } else if (normalizedPeriod === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      label = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    } else if (normalizedPeriod === 'yearly') {
      start = new Date(now.getFullYear(), 0, 1);
      label = String(now.getFullYear());
    }

    return { start, end: now, label, period: normalizedPeriod };
  }

  function getStatementSection(area) {
    const normalized = safeString(area || 'general', 80).toLowerCase();
    const map = {
      orders: 'Orders and fulfilment',
      payments: 'Payments and refunds',
      products: 'Products and catalogue',
      coupons: 'Coupons and campaigns',
      customers: 'Customer compliance',
      messages: 'Customer support messages',
      users: 'Admin users and roles',
      settings: 'Settings and security',
      content: 'Storefront content',
      newsletter: 'Newsletter and subscribers',
      reviews: 'Reviews and moderation',
      reports: 'Reports and exports',
      logs: 'Audit exports'
    };
    return map[normalized] || 'General admin activity';
  }

  function buildActivityStatementCsv(logs, statement) {
    const safeLogs = Array.isArray(logs) ? logs : [];
    const bySection = new Map();
    safeLogs.forEach((log) => {
      const section = getStatementSection(log.area);
      if (!bySection.has(section)) bySection.set(section, []);
      bySection.get(section).push(log);
    });

    const rows = [
      ['Benzy Luxury Admin Activity Statement'],
      ['Period', statement.label],
      ['From', statement.start.toISOString()],
      ['To', statement.end.toISOString()],
      ['Retention setting', `${statement.retentionDays} day(s)`],
      ['Total records', String(safeLogs.length)],
      [],
      ['Section Summary'],
      ['Section', 'Records']
    ];

    Array.from(bySection.keys()).sort().forEach((section) => {
      rows.push([section, String(bySection.get(section).length)]);
    });

    rows.push([]);

    Array.from(bySection.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([section, entries]) => {
      rows.push([`Section: ${section}`]);
      rows.push(['Created At', 'Admin Email', 'Admin Name', 'Area', 'Action', 'Entity ID', 'IP Address', 'Device', 'Message']);
      entries.forEach((log) => {
        rows.push([
          log.createdAt || '',
          log.adminEmail || '',
          log.adminName || '',
          log.area || '',
          log.action || '',
          log.entityId || '',
          log.ipAddress || '',
          log.device || '',
          log.message || ''
        ]);
      });
      rows.push([]);
    });

    if (!safeLogs.length) {
      rows.push(['No activity records found for this period.']);
    }

    return buildCsv(rows);
  }

  function escapePdfText(value) {
    return String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  function pdfColor(hex) {
    const normalized = String(hex || '').replace('#', '').trim();
    const value = /^[0-9a-f]{6}$/i.test(normalized) ? normalized : '231711';
    return [0, 2, 4]
      .map((index) => (parseInt(value.slice(index, index + 2), 16) / 255).toFixed(3))
      .join(' ');
  }

  function pdfText(value, x, y, options = {}) {
    return [
      `${pdfColor(options.color || '231711')} rg`,
      'BT',
      `/${options.font || 'F1'} ${Number(options.size || 10)} Tf`,
      `1 0 0 1 ${x} ${y} Tm`,
      `(${escapePdfText(value)}) Tj`,
      'ET'
    ].join('\n');
  }

  function pdfRect(x, y, width, height, color) {
    return [
      `${pdfColor(color)} rg`,
      `${x} ${y} ${width} ${height} re`,
      'f'
    ].join('\n');
  }

  function pdfLine(x1, y1, x2, y2, color = 'e8ddd2') {
    return [
      `${pdfColor(color)} RG`,
      '0.75 w',
      `${x1} ${y1} m`,
      `${x2} ${y2} l`,
      'S'
    ].join('\n');
  }

  function wrapPdfText(value, maxChars = 72) {
    const words = String(value || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const lines = [];
    let current = '';
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  function buildSimplePdf(pageOperations) {
    const pageWidth = 612;
    const pageHeight = 792;
    const pages = Array.isArray(pageOperations) && pageOperations.length
      ? pageOperations
      : [[pdfText('No records found.', 48, 744)]];

    const objects = [];
    const addObject = (body) => {
      objects.push(body);
      return objects.length;
    };

    const fontObject = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const boldFontObject = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const pageRefs = [];

    pages.forEach((operations) => {
      const content = ['q', ...operations, 'Q'].join('\n');
      const contentObject = addObject(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
      const pageObject = addObject(`<< /Type /Page /Parent __PAGES__ /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObject} 0 R /F2 ${boldFontObject} 0 R >> >> /Contents ${contentObject} 0 R >>`);
      pageRefs.push(pageObject);
    });

    const pagesObject = addObject(`<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`);
    const catalogObject = addObject(`<< /Type /Catalog /Pages ${pagesObject} 0 R >>`);

    const chunks = ['%PDF-1.4\n'];
    const offsets = [0];
    objects.forEach((body, index) => {
      offsets.push(Buffer.byteLength(chunks.join(''), 'utf8'));
      chunks.push(`${index + 1} 0 obj\n${body.replace(/__PAGES__/g, `${pagesObject} 0 R`)}\nendobj\n`);
    });
    const xrefOffset = Buffer.byteLength(chunks.join(''), 'utf8');
    chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
    offsets.slice(1).forEach((offset) => {
      chunks.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
    });
    chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogObject} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    return Buffer.from(chunks.join(''), 'utf8');
  }

  function buildActivityStatementPdf(logs, statement) {
    const safeLogs = Array.isArray(logs) ? logs : [];
    const bySection = new Map();
    safeLogs.forEach((log) => {
      const section = getStatementSection(log.area);
      if (!bySection.has(section)) bySection.set(section, []);
      bySection.get(section).push(log);
    });

    const pages = [];
    let operations = [];
    let y = 0;
    const margin = 44;
    const contentWidth = 524;

    const startPage = () => {
      operations = [
        pdfRect(0, 0, 612, 792, 'fbf7f1'),
        pdfRect(0, 690, 612, 102, '231711'),
        pdfText('BENZY LUXURY', 44, 752, { size: 10, font: 'F2', color: 'ddb36a' }),
        pdfText('Admin Activity Statement', 44, 724, { size: 24, font: 'F2', color: 'ffffff' }),
        pdfText('Private control room archive', 44, 705, { size: 9, color: 'eaded2' }),
        pdfText(`Generated ${new Date().toISOString()}`, 386, 752, { size: 8, color: 'eaded2' })
      ];
      y = 640;
    };

    const finishPage = () => {
      operations.push(pdfLine(margin, 38, margin + contentWidth, 38, 'd9c8b8'));
      operations.push(pdfText(`Page ${pages.length + 1}`, 522, 24, { size: 8, color: '7b6758' }));
      pages.push(operations);
    };

    const ensureSpace = (height) => {
      if (y - height >= 64) return;
      finishPage();
      startPage();
    };

    const addMetricCard = (x, label, value) => {
      operations.push(pdfRect(x, 540, 160, 54, 'ffffff'));
      operations.push(pdfLine(x, 540, x + 160, 540, 'e6d8ca'));
      operations.push(pdfText(label, x + 12, 573, { size: 7, font: 'F2', color: '9f6536' }));
      operations.push(pdfText(value, x + 12, 552, { size: 15, font: 'F2', color: '231711' }));
    };

    const addWrapped = (text, x, startY, options = {}) => {
      wrapPdfText(text, options.maxChars || 78).forEach((line, index) => {
        operations.push(pdfText(line, x, startY - (index * (options.lineHeight || 11)), {
          size: options.size || 8,
          font: options.font || 'F1',
          color: options.color || '4e3a2c'
        }));
      });
    };

    startPage();
    operations.push(pdfRect(margin, 610, contentWidth, 54, 'ffffff'));
    operations.push(pdfLine(margin, 610, margin + contentWidth, 610, 'e6d8ca'));
    operations.push(pdfText(`Period: ${statement.label}`, 58, 646, { size: 11, font: 'F2', color: '231711' }));
    operations.push(pdfText(`From ${statement.start.toISOString()}`, 58, 626, { size: 8, color: '6b5a4d' }));
    operations.push(pdfText(`To ${statement.end.toISOString()}`, 318, 626, { size: 8, color: '6b5a4d' }));
    addMetricCard(44, 'TOTAL RECORDS', String(safeLogs.length));
    addMetricCard(226, 'RETENTION', `${statement.retentionDays} day(s)`);
    addMetricCard(408, 'SECTIONS', String(bySection.size || 0));
    y = 510;

    operations.push(pdfText('Section Summary', margin, y, { size: 13, font: 'F2', color: '231711' }));
    y -= 18;
    if (bySection.size) {
      Array.from(bySection.keys()).sort().forEach((section) => {
        ensureSpace(24);
        operations.push(pdfRect(margin, y - 5, contentWidth, 20, 'ffffff'));
        operations.push(pdfText(section, margin + 12, y, { size: 9, font: 'F2', color: '231711' }));
        operations.push(pdfText(`${bySection.get(section).length} record(s)`, 474, y, { size: 8, color: '7b6758' }));
        y -= 25;
      });
    } else {
      operations.push(pdfRect(margin, y - 40, contentWidth, 48, 'ffffff'));
      addWrapped('No activity records found for this period.', margin + 14, y - 14, { maxChars: 78, size: 9 });
      y -= 60;
    }

    y -= 8;
    Array.from(bySection.entries()).sort(([a], [b]) => a.localeCompare(b)).forEach(([section, entries]) => {
      ensureSpace(44);
      operations.push(pdfText(section, margin, y, { size: 13, font: 'F2', color: '231711' }));
      y -= 18;
      entries.forEach((log) => {
        ensureSpace(62);
        operations.push(pdfRect(margin, y - 39, contentWidth, 48, 'ffffff'));
        operations.push(pdfLine(margin, y - 39, margin + contentWidth, y - 39, 'eaded2'));
        operations.push(pdfText(`${log.action || 'activity'}${log.entityId ? ` / ${log.entityId}` : ''}`, margin + 12, y - 4, { size: 9, font: 'F2', color: '231711' }));
        operations.push(pdfText(`${log.createdAt || ''}  |  ${log.adminEmail || ''}`, margin + 12, y - 18, { size: 7.5, color: '7b6758' }));
        addWrapped(log.message || 'No additional detail recorded.', margin + 12, y - 32, { maxChars: 82, size: 8 });
        y -= 58;
      });
    });

    finishPage();
    return buildSimplePdf(pages);
  }

  async function buildActivityLogStatement(period) {
    const settings = await readSettings();
    const retentionDays = settings?.security?.activityLogsRetentionDays || 30;
    const range = getLogArchiveRange(period, retentionDays);
    const collection = await getCollection('admin_activity_logs');
    const logs = await collection
      .find({ createdAt: { $gte: range.start.toISOString(), $lte: range.end.toISOString() } }, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    const statement = { ...range, logs, retentionDays };
    const csv = buildActivityStatementCsv(logs, statement);
    const pdf = buildActivityStatementPdf(logs, statement);
    const filename = `benzy-admin-statement-${range.label}.csv`;
    const pdfFilename = `benzy-admin-statement-${range.label}.pdf`;
    return { ...statement, csv, pdf, filename, pdfFilename };
  }

  function getReportLabel(type) {
    const normalized = safeString(type || 'sales', 30).toLowerCase();
    const labels = {
      sales: 'Sales report',
      inventory: 'Inventory report',
      orders: 'Order report',
      customers: 'Customer report'
    };
    return labels[normalized] || labels.sales;
  }

  function normalizeReportType(type) {
    const normalized = safeString(type || 'sales', 30).toLowerCase();
    return ['sales', 'inventory', 'orders', 'customers'].includes(normalized) ? normalized : 'sales';
  }

  function buildOperationsReportCsv(report) {
    const rows = [
      ['Benzy Luxury Operations Report'],
      ['Type', report.label],
      ['Period', report.range.label],
      ['From', report.range.start.toISOString()],
      ['To', report.range.end.toISOString()],
      [],
      ['Metric', 'Value'],
      ...report.summaryRows,
      []
    ];

    report.sections.forEach((section) => {
      rows.push([section.title]);
      rows.push(section.headers);
      section.rows.forEach((row) => rows.push(row));
      rows.push([]);
    });

    return buildCsv(rows);
  }

  function buildOperationsReportPdf(report) {
    const margin = 48;
    const pages = [];
    let operations = [];
    let y = 736;

    const finishPage = () => {
      pages.push(operations);
      operations = [];
      y = 736;
    };

    const ensureSpace = (height) => {
      if (y - height >= 64) return;
      finishPage();
    };

    operations.push(pdfRect(0, 0, 612, 792, 'fffaf5'));
    operations.push(pdfText('Benzy Luxury Operations Report', margin, y, { size: 16, font: 'F2' }));
    y -= 24;
    operations.push(pdfText(`${report.label} / ${report.range.label}`, margin, y, { size: 10, color: '7b6758' }));
    y -= 34;

    operations.push(pdfText('Summary', margin, y, { size: 12, font: 'F2' }));
    y -= 20;
    report.summaryRows.forEach(([label, value]) => {
      ensureSpace(18);
      operations.push(pdfText(`${label}: ${value}`, margin, y, { size: 9 }));
      y -= 16;
    });
    y -= 8;

    report.sections.forEach((section) => {
      ensureSpace(48);
      operations.push(pdfText(section.title, margin, y, { size: 12, font: 'F2' }));
      y -= 20;
      section.rows.slice(0, 24).forEach((row) => {
        ensureSpace(20);
        operations.push(pdfText(row.join(' | ').slice(0, 110), margin, y, { size: 8, color: '4e3a2c' }));
        y -= 16;
      });
      y -= 8;
    });

    finishPage();
    return buildSimplePdf(pages);
  }

  async function buildOperationsReport(type, period) {
    const reportType = normalizeReportType(type);
    const range = getLogArchiveRange(period || 'monthly', 365);
    const [orders, users, products] = await Promise.all([
      readOrders(),
      readUsers(),
      Product.find({}).sort({ updatedAt: -1, createdAt: -1 }).lean()
    ]);
    const filteredOrders = orders.filter((order) => {
      const dateValue = new Date(order?.paidAt || order?.createdAt || order?.orderDate || '');
      return !Number.isNaN(dateValue.getTime()) && dateValue >= range.start && dateValue <= range.end;
    });
    const paidOrders = filteredOrders.filter((order) => normalizePaymentStatus(order?.paymentStatus) === 'paid');
    const totalSales = paidOrders.reduce((sum, order) => sum + toPositiveNumber(order?.total, 0), 0);
    const lowStockProducts = products.filter((product) => {
      const metadata = product?.metadata && typeof product.metadata === 'object' ? product.metadata : {};
      const threshold = Math.max(1, toInteger(metadata.lowStockThreshold, DEFAULT_LOW_STOCK_THRESHOLD));
      return toInteger(product?.stockQuantity, 0) <= threshold;
    });
    const customerStats = buildCustomerStats(users, orders).filter((customer) => customer.role === 'resident');

    const summaryRows = [
      ['Total sales', `NGN ${totalSales.toLocaleString('en-NG')}`],
      ['Orders in range', String(filteredOrders.length)],
      ['Paid orders', String(paidOrders.length)],
      ['Total products', String(products.length)],
      ['Low stock products', String(lowStockProducts.length)],
      ['Customers', String(customerStats.length)]
    ];

    const sections = [];
    if (reportType === 'sales') {
      sections.push({
        title: 'Sales by day',
        headers: ['Period', 'Total'],
        rows: buildDateBuckets(paidOrders, period === 'weekly' ? 8 : period === 'daily' ? 7 : 6, period === 'weekly' ? 'week' : period === 'daily' ? 'day' : 'month')
          .map((entry) => [entry.label, `NGN ${Number(entry.total || 0).toLocaleString('en-NG')}`])
      });
    } else if (reportType === 'inventory') {
      sections.push({
        title: 'Inventory',
        headers: ['Product', 'SKU', 'Stock', 'Status'],
        rows: products.map((product) => [
          product.name || 'Product',
          product.sku || product.productId || '',
          String(toInteger(product.stockQuantity, 0)),
          lowStockProducts.some((entry) => String(entry.productId) === String(product.productId)) ? 'Low stock' : 'Healthy'
        ])
      });
    } else if (reportType === 'orders') {
      sections.push({
        title: 'Orders',
        headers: ['Order ID', 'Customer', 'Status', 'Payment', 'Total'],
        rows: filteredOrders.map((order) => [
          order.orderId || '',
          order.customerName || order.customerEmail || order?.customer?.email || '',
          normalizeOrderStatus(order.orderStatus || order.status),
          normalizePaymentStatus(order.paymentStatus),
          `NGN ${toPositiveNumber(order.total, 0).toLocaleString('en-NG')}`
        ])
      });
    } else {
      sections.push({
        title: 'Customers',
        headers: ['Customer', 'Email', 'Orders', 'Spent'],
        rows: customerStats.map((customer) => [
          customer.name || 'Customer',
          customer.email || '',
          String(customer.totalOrders || 0),
          `NGN ${toPositiveNumber(customer.totalSpent, 0).toLocaleString('en-NG')}`
        ])
      });
    }

    const report = {
      type: reportType,
      label: getReportLabel(reportType),
      range,
      summaryRows,
      sections
    };
    return {
      ...report,
      csv: buildOperationsReportCsv(report),
      pdf: buildOperationsReportPdf(report),
      filename: `benzy-${reportType}-report-${range.label}.csv`,
      pdfFilename: `benzy-${reportType}-report-${range.label}.pdf`
    };
  }

  async function getContentDocument() {
    return readSingleton('site_content', 'main', DEFAULT_CONTENT);
  }

  async function saveContentDocument(payload) {
    return writeSingleton('site_content', 'main', payload);
  }

  async function getReviews() {
    const collection = await getCollection('reviews');
    return collection
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
  }

  function buildPrimaryAddress(user, ordersByEmail) {
    const addresses = Array.isArray(user?.addresses) ? user.addresses : [];
    const defaultAddress = addresses.find((entry) => entry?.isDefault) || addresses[0] || null;
    if (defaultAddress) {
      return [
        defaultAddress.line1,
        defaultAddress.city,
        defaultAddress.state,
        defaultAddress.country
      ].filter(Boolean).join(', ');
    }

    const latestOrder = (ordersByEmail || [])[0];
    return safeString(latestOrder?.shippingAddress || latestOrder?.customer?.address || '', 220);
  }

  function mapProductForAdmin(product) {
    const metadata = product?.metadata && typeof product.metadata === 'object' ? product.metadata : {};
    const colors = parseArrayInput(metadata.availableColors || metadata.colors);
    const sizes = parseArrayInput(metadata.availableSizes || metadata.sizes);
    const stockQuantity = Math.max(0, toInteger(product?.stockQuantity, 0));
    const lowStockThreshold = Math.max(1, toInteger(metadata.lowStockThreshold, DEFAULT_LOW_STOCK_THRESHOLD));
    const images = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];

    return {
      productId: String(product?.productId || '').trim(),
      name: safeString(product?.name || '', 120),
      slug: safeString(product?.slug || '', 160),
      categoryId: safeString(product?.categoryId || 'all', 80).toLowerCase(),
      categoryIds: Array.isArray(product?.categoryIds) ? product.categoryIds.filter(Boolean) : [safeString(product?.categoryId || 'all', 80).toLowerCase()],
      categoryName: safeString(product?.categoryName || 'All', 80),
      price: toPositiveNumber(product?.price, 0),
      discountPrice: metadata.discountPrice == null ? null : toPositiveNumber(metadata.discountPrice, 0),
      currency: safeString(product?.currency || 'NGN', 10).toUpperCase(),
      images,
      image1: images[0] || '',
      image2: images[1] || '',
      stockQuantity,
      sizes,
      colors,
      featured: toBoolean(metadata.featured, false),
      isActive: product?.isActive !== false,
      lowStock: stockQuantity <= lowStockThreshold,
      lowStockThreshold,
      description: safeString(metadata.description || '', 600),
      sku: safeString(metadata.sku || product?.variants?.[0]?.sku || '', 80),
      createdAt: product?.createdAt ? new Date(product.createdAt).toISOString() : null,
      updatedAt: product?.updatedAt ? new Date(product.updatedAt).toISOString() : null
    };
  }

  function generateProductId() {
    return `BLX-${Date.now().toString(36).toUpperCase()}`;
  }

  function buildProductPayload(body, existing = null) {
    const name = safeString(body?.name || existing?.name || '', 120);
    if (!name) throw new Error('Product name is required.');

    const productId = safeString(body?.productId || existing?.productId || generateProductId(), 80);
    const price = toPositiveNumber(body?.price, existing?.price ?? 0);
    const stockQuantity = Math.max(0, toInteger(body?.stockQuantity, existing?.stockQuantity ?? 0));
    const explicitImages = Array.isArray(body?.images) ? body.images : null;
    const aliasedImages = [body?.image1, body?.image2].filter(Boolean);
    const images = parseArrayInput(
      explicitImages
      || body?.images
      || body?.imageUrls
      || aliasedImages
      || existing?.images
      || []
    );
    const sizes = parseArrayInput(body?.sizes || existing?.metadata?.availableSizes || []);
    const colors = parseArrayInput(body?.colors || existing?.metadata?.availableColors || []);
    const categorySource = body?.categoryIds
      || body?.categories
      || body?.categoryName
      || body?.categoryId
      || existing?.categoryIds
      || existing?.categoryName
      || existing?.categoryId
      || 'all';
    const categoryIds = extractProductCategoryIds(categorySource);
    const safeCategoryIds = categoryIds.length ? categoryIds : ['all'];
    const categoryId = safeCategoryIds[0];
    const categoryName = safeString(
      body?.categoryName
      || existing?.categoryName
      || safeCategoryIds.map((id) => capitalizeWords(id)).join(', ')
      || 'All',
      120
    );
    const sku = safeString(body?.sku || existing?.metadata?.sku || `BLX-${productId.slice(-6).toUpperCase()}`, 80);
    const isActive = toBoolean(body?.isActive ?? body?.published, existing?.isActive !== false);
    const featured = toBoolean(body?.featured ?? body?.isFeatured, toBoolean(existing?.metadata?.featured, false));
    const discountPriceInput = body?.discountPrice;
    const discountPrice = discountPriceInput === '' || discountPriceInput == null
      ? (existing?.metadata?.discountPrice ?? null)
      : toPositiveNumber(discountPriceInput, 0);
    const lowStockThreshold = Math.max(1, toInteger(body?.lowStockThreshold, existing?.metadata?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD));

    return {
      productId,
      normalizedName: name.toLowerCase().replace(/\s+/g, ' ').trim(),
      name,
      slug: slugify(body?.slug || name),
      categoryId,
      categoryIds: safeCategoryIds,
      categoryName,
      price,
      currency: safeString(body?.currency || existing?.currency || 'NGN', 10).toUpperCase(),
      image: images[0] || existing?.image || '',
      images,
      stockQuantity,
      isActive,
      variants: [
        {
          variantId: `${productId}-default`,
          sku,
          color: colors[0] || '',
          size: sizes[0] || '',
          stockQuantity,
          price,
          image: images[0] || existing?.image || '',
          isDefault: true
        }
      ],
      metadata: {
        ...(existing?.metadata && typeof existing.metadata === 'object' ? existing.metadata : {}),
        description: safeString(body?.description || existing?.metadata?.description || '', 600),
        discountPrice: discountPrice && discountPrice > 0 ? discountPrice : null,
        featured,
        availableSizes: sizes,
        availableColors: colors,
        lowStockThreshold,
        sku,
        hidden: !isActive,
        updatedFromAdminAt: new Date().toISOString()
      }
    };
  }

  function parseProductUpload(entry) {
    const source = entry && typeof entry === 'object' ? entry : {};
    const dataUrl = String(source.dataUrl || source.content || '').trim();
    const match = dataUrl.match(/^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i);
    if (!match) return { error: 'Upload must be a valid image data URL.' };

    const mimeType = String(match[1] || '').trim().toLowerCase();
    const extension = PRODUCT_UPLOAD_TYPES.get(mimeType);
    if (!extension) return { error: 'Only JPG, PNG, WEBP, and GIF images can be uploaded.' };

    const buffer = Buffer.from(String(match[2] || '').replace(/\s+/g, ''), 'base64');
    if (!buffer.length) return { error: 'Uploaded image is empty.' };
    if (buffer.length > PRODUCT_UPLOAD_MAX_BYTES) return { error: 'Each uploaded image must be 8MB or smaller.' };

    const originalName = safeString(source.name || 'product-image', 80)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'product-image';
    const uniqueSuffix = `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`;

    return {
      buffer,
      mimeType,
      fileName: `${originalName}-${uniqueSuffix}.${extension}`
    };
  }

  function buildProductUploadFileName(name, mimeType) {
    const extension = PRODUCT_UPLOAD_TYPES.get(String(mimeType || '').trim().toLowerCase());
    if (!extension) return null;
    const originalName = safeString(name || 'product-image', 80)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'product-image';
    const uniqueSuffix = `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`;
    return `${originalName}-${uniqueSuffix}.${extension}`;
  }

  async function saveProductUploads(images) {
    const entries = Array.isArray(images) ? images.slice(0, 8) : [];
    const saved = [];

    if (!entries.length) return saved;
    for (const entry of entries) {
      const parsed = parseProductUpload(entry);
      if (parsed.error) {
        const error = new Error(parsed.error);
        error.status = 400;
        throw error;
      }

      await saveProductUploadAsset({
        buffer: parsed.buffer,
        contentType: parsed.mimeType,
        fileName: parsed.fileName
      });
      saved.push(`${PRODUCT_UPLOAD_PUBLIC_PATH}/${parsed.fileName}`);
    }

    return saved;
  }

  async function saveProductUploadBuffer(buffer, options = {}) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
      const error = new Error('Uploaded image is empty.');
      error.status = 400;
      throw error;
    }
    if (buffer.length > PRODUCT_UPLOAD_MAX_BYTES) {
      const error = new Error('Each uploaded image must be 8MB or smaller.');
      error.status = 400;
      throw error;
    }

    const fileName = buildProductUploadFileName(options.name, options.mimeType);
    if (!fileName) {
      const error = new Error('Only JPG, PNG, WEBP, and GIF images can be uploaded.');
      error.status = 400;
      throw error;
    }

    await saveProductUploadAsset({
      buffer,
      contentType: String(options.mimeType || '').trim().toLowerCase(),
      fileName
    });
    return `${PRODUCT_UPLOAD_PUBLIC_PATH}/${fileName}`;
  }

  function sortByDateDesc(items, dateSelector) {
    return [...items].sort((left, right) => {
      const leftValue = String(dateSelector(left) || '');
      const rightValue = String(dateSelector(right) || '');
      return rightValue.localeCompare(leftValue);
    });
  }

  function groupOrdersByEmail(orders) {
    const grouped = new Map();
    (Array.isArray(orders) ? orders : []).forEach((order) => {
      const email = normalizeEmail(order?.customerEmail || order?.customer?.email);
      if (!email) return;
      if (!grouped.has(email)) grouped.set(email, []);
      grouped.get(email).push(order);
    });

    grouped.forEach((entries, email) => {
      grouped.set(email, sortByDateDesc(entries, (order) => order?.createdAt || order?.orderDate));
    });

    return grouped;
  }

  function buildCustomerStats(users, orders) {
    const ordersByEmail = groupOrdersByEmail(orders);
    return (Array.isArray(users) ? users : []).map((user) => {
      const userEmail = normalizeEmail(user?.email);
      const customerOrders = ordersByEmail.get(userEmail) || [];
      const totalOrders = customerOrders.length;
      const totalSpent = customerOrders.reduce((sum, order) => sum + toPositiveNumber(order?.total, 0), 0);
      const lastOrder = customerOrders[0] || null;

      return {
        id: user?.id,
        name: safeString(user?.name || 'Customer', 120),
        email: userEmail,
        phone: safeString(user?.phone || '', 40),
        role: String(user?.role || 'resident').trim().toLowerCase() === 'host' ? 'host' : 'resident',
        adminRole: normalizeAdminRole(user),
        isBanned: toBoolean(user?.isBanned, false),
        banReason: safeString(user?.banReason || '', 200),
        createdAt: user?.createdAt || null,
        lastLoginAt: user?.lastLoginAt || null,
        shippingAddress: buildPrimaryAddress(user, customerOrders),
        totalOrders,
        totalSpent,
        lastOrderId: lastOrder?.orderId || null,
        lastOrderAt: lastOrder?.createdAt || lastOrder?.orderDate || null
      };
    });
  }

  function mapContactMessage(entry) {
    const delivery = entry?.delivery && typeof entry.delivery === 'object' ? entry.delivery : {};
    const emailDelivery = delivery.email && typeof delivery.email === 'object' ? delivery.email : {};
    const whatsappDelivery = delivery.whatsapp && typeof delivery.whatsapp === 'object' ? delivery.whatsapp : {};
    const dashboardDelivery = delivery.dashboard && typeof delivery.dashboard === 'object' ? delivery.dashboard : {};
    const resolvedDelivery = delivery.resolved && typeof delivery.resolved === 'object' ? delivery.resolved : {};
    const workflow = buildContactWorkflow(entry);

    return {
      messageId: safeString(entry?.messageId || entry?._id || '', 120),
      source: safeString(entry?.source || 'contact-page', 80).toLowerCase(),
      status: workflow.status,
      name: safeString(entry?.name || 'Visitor', 120),
      email: normalizeEmail(entry?.email),
      phone: safeString(entry?.phone || '', 40),
      subject: safeString(entry?.subject || 'Contact message', 140),
      message: safeMultiline(entry?.message || '', 3000),
      internalNote: safeMultiline(entry?.internalNote || '', 800),
      submittedFrom: safeString(entry?.submittedFrom || '', 200),
      createdAt: entry?.createdAt || null,
      updatedAt: entry?.updatedAt || null,
      delivery: {
        dashboard: {
          savedAt: dashboardDelivery.savedAt || entry?.createdAt || null
        },
        email: {
          configured: emailDelivery.configured === true,
          contactSynced: emailDelivery.contactSynced === true,
          supportRecipients: Array.isArray(emailDelivery.supportRecipients)
            ? emailDelivery.supportRecipients.map((recipient) => normalizeEmail(recipient)).filter(Boolean)
            : [],
          supportDelivered: Array.isArray(emailDelivery.supportDelivered)
            ? emailDelivery.supportDelivered.map((recipient) => normalizeEmail(recipient)).filter(Boolean)
            : [],
          senderAcknowledged: emailDelivery.senderAcknowledged === true,
          errors: Array.isArray(emailDelivery.errors)
            ? emailDelivery.errors.map((error) => safeString(error, 240)).filter(Boolean)
            : []
        },
        whatsapp: {
          configured: whatsappDelivery.configured === true,
          templateConfigured: whatsappDelivery.templateConfigured === true,
          provider: safeString(whatsappDelivery.provider || 'browser-link', 40),
          deliveryMethod: safeString(whatsappDelivery.deliveryMethod || '', 60),
          ready: whatsappDelivery.ready === true,
          sent: whatsappDelivery.sent === true,
          targetPhone: safeString(whatsappDelivery.targetPhone || '', 40),
          channelPhone: safeString(whatsappDelivery.channelPhone || '', 40),
          url: safeString(whatsappDelivery.url || '', 1200),
          manualUrl: safeString(whatsappDelivery.manualUrl || '', 1200),
          messageId: safeString(whatsappDelivery.messageId || '', 240),
          error: safeString(whatsappDelivery.error || '', 240)
        },
        resolved: {
          resolvedBy: normalizeEmail(resolvedDelivery.resolvedBy || ''),
          resolvedNotifiedAt: resolvedDelivery.resolvedNotifiedAt || null,
          emailSent: resolvedDelivery.email?.sent === true,
          whatsappSent: resolvedDelivery.whatsapp?.sent === true,
          emailSkipped: safeString(resolvedDelivery.email?.skipped || '', 240),
          whatsappSkipped: safeString(resolvedDelivery.whatsapp?.skipped || '', 240),
          emailError: safeString(resolvedDelivery.email?.error || '', 240),
          whatsappError: safeString(resolvedDelivery.whatsapp?.error || '', 240)
        }
      },
      workflow
    };
  }

  function buildContactMessagesSummary(messages) {
    const records = Array.isArray(messages) ? messages : [];
    return {
      total: records.length,
      newCount: records.filter((entry) => entry.status === 'new').length,
      inProgressCount: records.filter((entry) => entry.status === 'in_progress').length,
      resolvedCount: records.filter((entry) => entry.status === 'resolved').length,
      emailDeliveredCount: records.filter((entry) => (entry.delivery?.email?.supportDelivered || []).length > 0).length,
      whatsappReadyCount: records.filter((entry) => entry.delivery?.whatsapp?.ready).length,
      autoTriagedCount: records.filter((entry) => entry.workflow?.systemTriaged).length,
      ownerNotesCount: records.filter((entry) => entry.workflow?.hasInternalNote).length
    };
  }

  function findUserNotificationSettings(users, email) {
    const normalizedEmail = normalizeEmail(email);
    const user = (Array.isArray(users) ? users : []).find((entry) => normalizeEmail(entry?.email) === normalizedEmail);
    return normalizeNotificationSettings(user?.notifications);
  }

  function buildContactResolvedEmail(messageRecord) {
    const name = safeString(messageRecord?.name || 'there', 80) || 'there';
    const subject = safeString(messageRecord?.subject || 'your message', 120) || 'your message';
    const supportEmail = safeString(DEFAULT_CONTENT.contactInfo.email || 'admin@benzyluxury.com', 160);
    const html = `
      <div style="margin:0;padding:0;background:#f7f1ea;font-family:Arial,sans-serif;color:#231711;">
        <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
          <div style="background:#fffaf4;border:1px solid #e8dfd5;border-radius:18px;padding:28px;">
            <p style="margin:0 0 10px;color:#a37a35;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">Benzy Luxury Support</p>
            <h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;color:#1c1511;">We have attended to your message</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(name)},</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Your message about <strong>${escapeHtml(subject)}</strong> has been marked as handled by the Benzy Luxury team.</p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">If you still need help, reply to this email and we will continue from the same conversation.</p>
            <p style="margin:0;color:#6b5a4d;font-size:13px;line-height:1.6;">Support: ${escapeHtml(supportEmail)}</p>
          </div>
        </div>
      </div>
    `;
    const text = [
      `Hi ${name},`,
      '',
      `Your message about "${subject}" has been marked as handled by the Benzy Luxury team.`,
      'If you still need help, reply to this email and we will continue from the same conversation.',
      '',
      `Support: ${supportEmail}`
    ].join('\n');

    return { html, text };
  }

  function buildContactResolvedWhatsAppText(messageRecord) {
    const name = safeString(messageRecord?.name || 'there', 80) || 'there';
    const subject = safeString(messageRecord?.subject || 'your message', 120) || 'your message';
    return `Hi ${name}, Benzy Luxury has attended to your message about "${subject}". If you still need help, reply here and we will continue with you.`;
  }

  async function sendContactResolvedNotifications(messageRecord, users, adminEmail) {
    const email = normalizeEmail(messageRecord?.email || '');
    const phone = normalizeWhatsAppPhone(messageRecord?.phone || '');
    const notifications = findUserNotificationSettings(users, email);
    const summary = {
      email: {
        attempted: false,
        sent: false,
        skipped: '',
        messageId: '',
        error: ''
      },
      whatsapp: {
        attempted: false,
        sent: false,
        skipped: '',
        messageId: '',
        error: ''
      },
      resolvedBy: normalizeEmail(adminEmail || ''),
      resolvedNotifiedAt: new Date().toISOString()
    };

    if (!notifications.email) {
      summary.email.skipped = 'Customer email notifications are disabled.';
    } else if (!isBrevoConfigured()) {
      summary.email.skipped = 'Brevo is not configured.';
    } else if (!isValidEmail(email)) {
      summary.email.skipped = 'Customer email is missing or invalid.';
    } else {
      summary.email.attempted = true;
      try {
        const content = buildContactResolvedEmail(messageRecord);
        const result = await sendTransactionalEmail({
          toEmail: email,
          toName: safeString(messageRecord?.name || '', 120),
          subject: 'We have attended to your message | Benzy Luxury',
          htmlContent: content.html,
          textContent: content.text,
          tags: ['support', 'contact-form', 'resolved']
        });
        summary.email.sent = true;
        summary.email.messageId = safeString(result?.messageId || '', 240);
      } catch (error) {
        summary.email.error = safeString(error?.message || 'Resolved email failed.', 240);
      }
    }

    if (!notifications.sms) {
      summary.whatsapp.skipped = 'Customer SMS/WhatsApp notifications are disabled.';
    } else if (!isWatiConfigured()) {
      summary.whatsapp.skipped = 'WATI is not configured.';
    } else if (!phone) {
      summary.whatsapp.skipped = 'Customer phone number is missing.';
    } else {
      summary.whatsapp.attempted = true;
      try {
        const result = await sendWatiSessionMessage({
          phone,
          messageText: buildContactResolvedWhatsAppText(messageRecord),
          localMessageId: `contact-resolved-${safeString(messageRecord?.messageId || messageRecord?._id || 'message', 80)}-${Date.now()}`
        });
        summary.whatsapp.sent = true;
        summary.whatsapp.messageId = safeString(result?.messageId || '', 240);
      } catch (error) {
        summary.whatsapp.error = safeString(error?.message || 'Resolved WhatsApp message failed.', 240);
      }
    }

    return summary;
  }

  function hasOwn(source, key) {
    return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
  }

  function readCouponOptionalLimit(value, label) {
    if (value == null || String(value).trim() === '') {
      return { value: null };
    }
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: `${label} must be a whole number that is 0 or more.` };
    }
    return { value: parsed === 0 ? null : parsed };
  }

  function readCouponOptionalNonNegativeNumber(value, label) {
    if (value == null || String(value).trim() === '') {
      return { value: null };
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: `${label} must be a number that is 0 or more.` };
    }
    return { value: parsed === 0 ? null : parsed };
  }

  function readCouponOptionalDate(value, label) {
    if (value == null || String(value).trim() === '') {
      return { value: null };
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return { error: `${label} must be a valid date.` };
    }
    return { value: parsed };
  }

  function buildCouponAutomation(coupon) {
    const manualEnabled = coupon?.isActive !== false;
    const usedCount = Math.max(0, toInteger(coupon?.usedCount, 0));
    const usageLimit = coupon?.usageLimit == null ? null : Math.max(0, toInteger(coupon.usageLimit, 0));
    const usageRemaining = usageLimit == null ? null : Math.max(usageLimit - usedCount, 0);
    const expiresAt = coupon?.expiresAt ? new Date(coupon.expiresAt) : null;
    const expiryMs = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt.getTime() : null;
    const isExpired = Number.isFinite(expiryMs) && expiryMs < Date.now();
    const isExhausted = usageLimit != null && usedCount >= usageLimit;
    const expiresSoon = !isExpired && Number.isFinite(expiryMs) && expiryMs <= (Date.now() + (7 * 24 * 60 * 60 * 1000));
    const lowRemaining = usageRemaining != null && usageRemaining > 0 && (usageRemaining <= 3 || (usageLimit && (usedCount / usageLimit) >= 0.8));
    const isRedeemable = manualEnabled && !isExpired && !isExhausted;

    let mode = 'live';
    let stateLabel = 'Live';
    let title = 'Redeemable at checkout';
    let description = 'This offer is active, within policy, and available to eligible shoppers right now.';

    if (isExpired) {
      mode = 'closed';
      stateLabel = 'Expired';
      title = 'Expired automatically';
      description = 'Checkout no longer accepts this code because the campaign end date has passed.';
    } else if (isExhausted) {
      mode = 'closed';
      stateLabel = 'Limit reached';
      title = 'Usage limit reached';
      description = 'The total redemption cap has already been consumed, so the system now blocks this offer automatically.';
    } else if (!manualEnabled) {
      mode = 'paused';
      stateLabel = 'Paused';
      title = 'Manually paused';
      description = 'This coupon is configured, but it has been intentionally disabled until a host relaunches it.';
    } else if (expiresSoon || lowRemaining) {
      mode = 'attention';
      stateLabel = 'Review soon';
      title = 'Still live, but needs attention';
      description = expiresSoon && lowRemaining
        ? 'This coupon is close to expiry and almost out of redemptions.'
        : expiresSoon
          ? 'This coupon is still live, but the expiry date is approaching.'
          : 'This coupon is still live, but only a few redemptions remain.';
    }

    return {
      mode,
      stateLabel,
      title,
      description,
      manualEnabled,
      isRedeemable,
      isExpired,
      isExhausted,
      expiresSoon,
      lowRemaining,
      usageLimit,
      usageRemaining,
      usedCount
    };
  }

  function mapAdminCoupon(coupon) {
    const record = coupon && typeof coupon === 'object' ? coupon : {};
    return {
      code: safeString(record.code || '', 80),
      discountType: safeString(record.discountType || 'percent', 20) === 'fixed' ? 'fixed' : 'percent',
      discountValue: toPositiveNumber(record.discountValue, 0),
      minimumOrderAmount: toPositiveNumber(record.minimumOrderAmount, 0),
      maximumDiscountAmount: record.maximumDiscountAmount == null ? null : toPositiveNumber(record.maximumDiscountAmount, 0),
      expiresAt: record.expiresAt ? new Date(record.expiresAt).toISOString() : null,
      isActive: record.isActive !== false,
      usageLimit: record.usageLimit == null ? null : toInteger(record.usageLimit, 0),
      usedCount: toInteger(record.usedCount, 0),
      perUserLimit: record.perUserLimit == null ? null : toInteger(record.perUserLimit, 0),
      applicableProductIds: parseArrayInput(record.applicableProductIds || []),
      applicableCategoryIds: parseArrayInput(record.applicableCategoryIds || []),
      excludedProductIds: parseArrayInput(record.excludedProductIds || []),
      freeShipping: toBoolean(record.freeShipping, false),
      createdAt: record.createdAt ? new Date(record.createdAt).toISOString() : null,
      automation: buildCouponAutomation(record)
    };
  }

  function buildCouponSummary(coupons) {
    const records = Array.isArray(coupons) ? coupons : [];
    return records.reduce((acc, coupon) => {
      const automation = coupon?.automation && typeof coupon.automation === 'object'
        ? coupon.automation
        : buildCouponAutomation(coupon);
      acc.total += 1;
      if (automation.mode === 'live') acc.live += 1;
      if (automation.mode === 'attention') acc.attention += 1;
      if (automation.mode === 'paused') acc.paused += 1;
      if (automation.mode === 'closed') acc.closed += 1;
      if (coupon?.freeShipping) acc.freeShipping += 1;
      return acc;
    }, {
      total: 0,
      live: 0,
      attention: 0,
      paused: 0,
      closed: 0,
      freeShipping: 0
    });
  }

  function resolveCouponMutation(source, existingCoupon = null) {
    const payload = source && typeof source === 'object' ? source : {};
    const current = existingCoupon && typeof existingCoupon === 'object' ? existingCoupon : {};
    const discountType = safeString(
      hasOwn(payload, 'discountType') ? payload.discountType : current.discountType || 'percent',
      20
    ) === 'fixed' ? 'fixed' : 'percent';
    const discountValue = Number(hasOwn(payload, 'discountValue') ? payload.discountValue : current.discountValue);
    const minimumOrderAmount = Number(hasOwn(payload, 'minimumOrderAmount') ? payload.minimumOrderAmount : current.minimumOrderAmount || 0);
    const maxDiscountResult = readCouponOptionalNonNegativeNumber(
      hasOwn(payload, 'maximumDiscountAmount') ? payload.maximumDiscountAmount : current.maximumDiscountAmount,
      'Discount cap'
    );
    const expiresAtResult = readCouponOptionalDate(
      hasOwn(payload, 'expiresAt') ? payload.expiresAt : current.expiresAt,
      'Expiry date'
    );
    const usageLimitResult = readCouponOptionalLimit(
      hasOwn(payload, 'usageLimit') ? payload.usageLimit : current.usageLimit,
      'Usage limit'
    );
    const perUserLimitResult = readCouponOptionalLimit(
      hasOwn(payload, 'perUserLimit') ? payload.perUserLimit : current.perUserLimit,
      'Per-user limit'
    );
    const applicableProductIds = hasOwn(payload, 'applicableProductIds')
      ? parseArrayInput(payload.applicableProductIds)
      : parseArrayInput(current.applicableProductIds || []);
    const applicableCategoryIds = hasOwn(payload, 'applicableCategoryIds')
      ? parseArrayInput(payload.applicableCategoryIds).map((entry) => entry.toLowerCase())
      : parseArrayInput(current.applicableCategoryIds || []);
    const excludedProductIds = hasOwn(payload, 'excludedProductIds')
      ? parseArrayInput(payload.excludedProductIds)
      : parseArrayInput(current.excludedProductIds || []);

    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return { error: 'Discount value must be greater than 0.' };
    }

    if (discountType === 'percent' && discountValue > 100) {
      return { error: 'Percentage discounts cannot exceed 100.' };
    }

    if (!Number.isFinite(minimumOrderAmount) || minimumOrderAmount < 0) {
      return { error: 'Minimum order amount must be 0 or more.' };
    }

    if (maxDiscountResult.error) return { error: maxDiscountResult.error };
    if (expiresAtResult.error) return { error: expiresAtResult.error };
    if (usageLimitResult.error) return { error: usageLimitResult.error };
    if (perUserLimitResult.error) return { error: perUserLimitResult.error };
    if (
      usageLimitResult.value != null
      && perUserLimitResult.value != null
      && perUserLimitResult.value > usageLimitResult.value
    ) {
      return { error: 'Per-user limit cannot be greater than the total usage limit.' };
    }

    return {
      value: {
        discountType,
        discountValue,
        minimumOrderAmount,
        maximumDiscountAmount: discountType === 'fixed' ? null : maxDiscountResult.value,
        expiresAt: expiresAtResult.value,
        isActive: hasOwn(payload, 'isActive')
          ? toBoolean(payload.isActive, current.isActive !== false)
          : current.isActive !== false,
        usageLimit: usageLimitResult.value,
        perUserLimit: perUserLimitResult.value,
        applicableProductIds,
        applicableCategoryIds,
        excludedProductIds,
        freeShipping: hasOwn(payload, 'freeShipping')
          ? toBoolean(payload.freeShipping, current.freeShipping === true)
          : current.freeShipping === true
      }
    };
  }

  async function resolveCouponProductTargets(targets) {
    const tokens = parseArrayInput(targets);
    if (!tokens.length) return [];

    const candidates = Array.from(new Set(tokens.flatMap((entry) => {
      const raw = safeString(entry, 120);
      const upper = raw.toUpperCase();
      return raw === upper ? [raw] : [raw, upper];
    }))).filter(Boolean);

    const products = await Product.find({
      $or: [
        { productId: { $in: candidates } },
        { 'metadata.sku': { $in: candidates } },
        { 'variants.sku': { $in: candidates } }
      ]
    }).select({ productId: 1, metadata: 1, variants: 1 }).lean();

    const lookup = new Map();
    products.forEach((product) => {
      const productId = safeString(product?.productId || '', 120);
      const metadata = product?.metadata && typeof product.metadata === 'object' ? product.metadata : {};
      const values = [
        productId,
        safeString(metadata.sku || '', 120),
        ...(Array.isArray(product?.variants) ? product.variants.map((variant) => safeString(variant?.sku || '', 120)) : [])
      ].filter(Boolean);
      values.forEach((value) => {
        lookup.set(value.toUpperCase(), productId);
      });
    });

    const resolved = tokens.map((entry) => lookup.get(String(entry).toUpperCase()) || entry);
    return Array.from(new Set(resolved));
  }

  async function getContactMessagesData() {
    const collection = await getCollection('contact_messages');
    const records = await collection
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    const messages = records.map(mapContactMessage);
    return {
      messages,
      summary: buildContactMessagesSummary(messages)
    };
  }

  function buildPaymentRecords(orders, users) {
    const orderPayments = (Array.isArray(orders) ? orders : []).map((order) => {
      const metadata = order?.metadata && typeof order.metadata === 'object' ? order.metadata : {};
      const refunds = Array.isArray(metadata.refunds) ? metadata.refunds : [];
      return {
        id: safeString(order?.paymentReference || order?.transactionId || order?.orderId || '', 120),
        type: 'order',
        orderId: safeString(order?.orderId || '', 120),
        customerEmail: normalizeEmail(order?.customerEmail || order?.customer?.email),
        customerName: safeString(order?.customerName || order?.customer?.name || '', 120),
        amount: toPositiveNumber(order?.total, 0),
        currency: safeString(order?.currency || 'NGN', 10).toUpperCase(),
        status: normalizePaymentStatus(order?.paymentStatus),
        provider: safeString(order?.paymentProvider || normalizePaymentMethod(order?.paymentMethodCode || order?.paymentMethod), 40),
        method: safeString(order?.paymentMethod || order?.paymentMethodCode || 'Not selected', 80),
        bankTransferConfirmedAt: metadata.bankTransferConfirmedAt || null,
        paidAt: order?.paidAt || null,
        createdAt: order?.createdAt || order?.orderDate || null,
        refunds: refunds.map((refund) => ({
          amount: toPositiveNumber(refund?.amount, 0),
          reason: safeString(refund?.reason || '', 200),
          refundedAt: refund?.refundedAt || null,
          refundedBy: safeString(refund?.refundedBy || '', 120)
        }))
      };
    });

    const walletPayments = (Array.isArray(users) ? users : []).flatMap((user) => {
      const transactions = Array.isArray(user?.wallet?.transactions) ? user.wallet.transactions : [];
      return transactions.map((transaction) => ({
        id: safeString(transaction?.reference || transaction?.transactionId || '', 120),
        type: 'wallet',
        orderId: safeString(transaction?.orderId || '', 120),
        customerEmail: normalizeEmail(user?.email),
        customerName: safeString(user?.name || '', 120),
        amount: toPositiveNumber(transaction?.amount, 0),
        currency: safeString(transaction?.currency || user?.wallet?.currency || 'NGN', 10).toUpperCase(),
        status: normalizePaymentStatus(transaction?.status || 'paid'),
        provider: safeString(transaction?.provider || 'wallet', 40),
        method: safeString(transaction?.paymentMethod || 'Wallet', 80),
        bankTransferConfirmedAt: null,
        paidAt: transaction?.createdAt || null,
        createdAt: transaction?.createdAt || null,
        refunds: []
      }));
    });

    return sortByDateDesc([...orderPayments, ...walletPayments], (entry) => entry.paidAt || entry.createdAt);
  }

  function startOfWeek(date) {
    const next = new Date(date);
    const day = next.getDay();
    const diff = (day + 6) % 7;
    next.setDate(next.getDate() - diff);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function buildDateBuckets(orders, count, unit) {
    const buckets = [];
    const current = new Date();
    current.setHours(0, 0, 0, 0);

    for (let index = count - 1; index >= 0; index -= 1) {
      const cursor = new Date(current);
      if (unit === 'day') {
        cursor.setDate(cursor.getDate() - index);
        const label = cursor.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
        buckets.push({ label, key: cursor.toISOString().slice(0, 10), total: 0 });
      } else if (unit === 'week') {
        cursor.setDate(cursor.getDate() - (index * 7));
        const weekStart = startOfWeek(cursor);
        const label = `Week of ${weekStart.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}`;
        buckets.push({ label, key: weekStart.toISOString().slice(0, 10), total: 0 });
      } else {
        cursor.setMonth(cursor.getMonth() - index);
        cursor.setDate(1);
        const label = cursor.toLocaleDateString('en-NG', { month: 'short', year: 'numeric' });
        buckets.push({ label, key: cursor.toISOString().slice(0, 7), total: 0 });
      }
    }

    (Array.isArray(orders) ? orders : []).forEach((order) => {
      const amount = toPositiveNumber(order?.total, 0);
      const dateValue = new Date(order?.paidAt || order?.createdAt || order?.orderDate || '');
      if (Number.isNaN(dateValue.getTime())) return;

      const bucketKey = unit === 'day'
        ? dateValue.toISOString().slice(0, 10)
        : unit === 'week'
          ? startOfWeek(dateValue).toISOString().slice(0, 10)
          : dateValue.toISOString().slice(0, 7);

      const bucket = buckets.find((entry) => entry.key === bucketKey);
      if (bucket) bucket.total += amount;
    });

    return buckets.map((entry) => ({ label: entry.label, total: Number(entry.total.toFixed(2)) }));
  }

  async function buildOverviewPayload(req) {
    const [orders, users, subscribers, settings, products, contactMessagesCollection] = await Promise.all([
      readOrders(),
      readUsers(),
      readSubscribers(),
      readSettings(),
      Product.find({}).sort({ updatedAt: -1 }).lean(),
      getCollection('contact_messages')
    ]);
    const payments = buildPaymentRecords(orders, users);

    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const lowStockProducts = products.filter((product) => {
      const metadata = product?.metadata && typeof product.metadata === 'object' ? product.metadata : {};
      const threshold = Math.max(1, toInteger(metadata.lowStockThreshold, DEFAULT_LOW_STOCK_THRESHOLD));
      return toInteger(product?.stockQuantity, 0) <= threshold;
    });
    const newCustomers = users.filter((user) => {
      const createdAt = new Date(user?.createdAt || '').getTime();
      return Number.isFinite(createdAt) && createdAt >= thirtyDaysAgo;
    });
    const paidOrders = orders.filter((order) => normalizePaymentStatus(order?.paymentStatus) === 'paid');
    const totalSales = paidOrders.reduce((sum, order) => sum + toPositiveNumber(order?.total, 0), 0);
    const todayKey = new Date().toISOString().slice(0, 10);
    const todaysSales = paidOrders
      .filter((order) => String(order?.paidAt || order?.createdAt || order?.orderDate || '').slice(0, 10) === todayKey)
      .reduce((sum, order) => sum + toPositiveNumber(order?.total, 0), 0);
    const ordersByStatus = orders.reduce((summary, order) => {
      const status = normalizeOrderStatus(order?.orderStatus || order?.status);
      summary[status] = (summary[status] || 0) + 1;
      return summary;
    }, {});
    const pendingOrders = (ordersByStatus.pending || 0) + (ordersByStatus.placed || 0) + (ordersByStatus.confirmed || 0);
    const processingOrders = ordersByStatus.processing || 0;
    const deliveredOrders = ordersByStatus.delivered || 0;
    const cancelledOrders = ordersByStatus.cancelled || 0;
    const bankTransfersPending = orders.filter((order) => normalizePaymentMethod(order?.paymentMethodCode || order?.paymentMethod) === 'bank_transfer' && normalizePaymentStatus(order?.paymentStatus) !== 'paid').length;
    const refundsCount = payments.reduce((sum, payment) => sum + (Array.isArray(payment.refunds) ? payment.refunds.length : 0), 0);
    const [abandonedCarts, unreadContactMessages] = await Promise.all([
      getCollection('carts').then((collection) => collection.countDocuments({ 'items.0': { $exists: true } })),
      contactMessagesCollection.countDocuments({ status: { $in: ['new', 'in_progress'] } })
    ]);

    const productSalesMap = new Map();
    orders.forEach((order) => {
      const items = Array.isArray(order?.items) ? order.items : [];
      items.forEach((item) => {
        const key = safeString(item?.productId || item?.name || item?.title || 'product', 120);
        const current = productSalesMap.get(key) || {
          productId: safeString(item?.productId || '', 120),
          name: safeString(item?.name || item?.title || 'Product', 120),
          quantity: 0,
          revenue: 0
        };
        current.quantity += Math.max(1, toInteger(item?.quantity || item?.qty, 1));
        current.revenue += toPositiveNumber(item?.price, 0) * Math.max(1, toInteger(item?.quantity || item?.qty, 1));
        productSalesMap.set(key, current);
      });
    });

    const customerStats = buildCustomerStats(users, orders)
      .filter((customer) => customer.role === 'resident')
      .sort((left, right) => right.totalSpent - left.totalSpent);

    const recentOrders = sortByDateDesc(orders, (order) => order?.updatedAt || order?.createdAt || order?.orderDate)
      .slice(0, 8)
      .map((order) => ({
        orderId: safeString(order?.orderId || '', 120),
        customerName: safeString(order?.customerName || order?.customer?.name || 'Customer', 120),
        customerEmail: normalizeEmail(order?.customerEmail || order?.customer?.email),
        total: toPositiveNumber(order?.total, 0),
        currency: safeString(order?.currency || 'NGN', 10).toUpperCase(),
        orderStatus: normalizeOrderStatus(order?.orderStatus || order?.status),
        paymentStatus: normalizePaymentStatus(order?.paymentStatus),
        createdAt: order?.createdAt || order?.orderDate || null,
        updatedAt: order?.updatedAt || null
      }));
    const notifications = [
      ...(recentOrders.length ? [{ type: 'orders', label: `${recentOrders.length} recent order(s) ready for review` }] : []),
      ...(lowStockProducts.length ? [{ type: 'inventory', label: `${lowStockProducts.length} low stock product(s)` }] : []),
      ...(payments.filter((entry) => entry.status === 'failed').length ? [{ type: 'payments', label: `${payments.filter((entry) => entry.status === 'failed').length} failed payment(s)` }] : []),
      ...(unreadContactMessages ? [{ type: 'customers', label: `${unreadContactMessages} customer complaint/inquiry item(s)` }] : []),
      ...(refundsCount ? [{ type: 'returns', label: `${refundsCount} refund/return record(s)` }] : [])
    ];

    return {
      currentUser: {
        ...(toPublicUser ? toPublicUser(getAdminContext(req).current || {}) : {}),
        adminRole: normalizeAdminRole(getAdminContext(req).current || {}),
        permissions: Array.from(getPermissionsForUser(getAdminContext(req).current || {}))
      },
      metrics: {
        totalOrders: orders.length,
        totalSales,
        todaysSales,
        pendingOrders,
        processingOrders,
        deliveredOrders,
        cancelledOrders,
        totalProducts: products.length,
        lowStockProducts: lowStockProducts.length,
        newCustomers: newCustomers.length,
        contactMessages: unreadContactMessages,
        subscribers: subscribers.length
      },
      paymentSummary: {
        totalTransactions: payments.length,
        verifiedPayments: payments.filter((entry) => entry.status === 'paid').length,
        failedPayments: payments.filter((entry) => entry.status === 'failed').length,
        bankTransferPending: bankTransfersPending,
        walletPayments: payments.filter((entry) => entry.type === 'wallet' || entry.provider === 'wallet').length,
        refundRecords: refundsCount
      },
      recentTransactions: payments.slice(0, 8),
      recentOrders,
      notifications,
      alerts: [
        ...(lowStockProducts.length ? [{ type: 'inventory', label: `${lowStockProducts.length} low stock product(s)` }] : []),
        ...(bankTransfersPending ? [{ type: 'payments', label: `${bankTransfersPending} bank transfer payment(s) awaiting confirmation` }] : []),
        ...(newCustomers.length ? [{ type: 'customers', label: `${newCustomers.length} new customer(s) in the last 30 days` }] : []),
        ...(unreadContactMessages ? [{ type: 'messages', label: `${unreadContactMessages} contact message(s) awaiting follow-up` }] : [])
      ],
      reports: {
        dailySales: buildDateBuckets(paidOrders, 7, 'day'),
        weeklySales: buildDateBuckets(paidOrders, 8, 'week'),
        monthlySales: buildDateBuckets(paidOrders, 6, 'month'),
        bestSellingProducts: Array.from(productSalesMap.values())
          .sort((left, right) => right.quantity - left.quantity)
          .slice(0, 6),
        topCustomers: customerStats.slice(0, 6),
        abandonedCarts,
        trafficSource: {
          analyticsConnected: false,
          note: 'Traffic source tracking becomes available once your public site is connected to analytics.'
        }
      },
      settings: {
        shipping: settings?.shipping || null,
        security: settings?.security || null
      }
    };
  }

  router.use(authMiddleware);
  router.use(asyncHandler(async (req, res, next) => {
    const ctx = await requireHost(req, res);
    if (!ctx) return;
    req.adminContext = ctx;
    next();
  }));

  router.get('/overview', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'dashboard')) return;
    const overview = await buildOverviewPayload(req);
    res.json({ success: true, overview });
  }));

  router.get('/reports/export', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'dashboard')) return;
    const report = await buildOperationsReport(req.query?.type || 'sales', req.query?.period || 'monthly');
    const format = safeString(req.query?.format || 'csv', 20).toLowerCase() === 'pdf' ? 'pdf' : 'csv';
    await logAdminActivity(req, {
      action: 'exported',
      area: 'reports',
      entityId: `${report.type}-${report.range.label}`,
      message: `Exported ${report.label.toLowerCase()} for ${report.range.label}.`
    });

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${report.pdfFilename}"`);
      res.send(report.pdf);
      return;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    res.send(report.csv);
  }));

  router.get('/products', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'products')) return;
    const products = await Product.find({}).sort({ updatedAt: -1, createdAt: -1 }).lean();
    res.json({
      success: true,
      products: products.map(mapProductForAdmin)
    });
  }));

  router.post('/uploads/products', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'products')) return;
    const urls = await saveProductUploads(req.body?.images);
    res.status(201).json({ success: true, urls });
  }));

  router.post('/uploads/products/raw', express.raw({
    type: ['image/*', 'application/octet-stream'],
    limit: PRODUCT_UPLOAD_MAX_BYTES
  }), asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'products')) return;
    const url = await saveProductUploadBuffer(req.body, {
      mimeType: req.headers['content-type'],
      name: req.headers['x-upload-filename']
    });
    res.status(201).json({ success: true, url, urls: [url] });
  }));

  router.post('/products', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'products')) return;
    const payload = buildProductPayload(req.body || {});
    const created = await Product.create(payload);
    await logAdminActivity(req, {
      action: 'created',
      area: 'products',
      entityId: payload.productId,
      message: `Created product ${payload.name}.`
    });
    res.status(201).json({ success: true, product: mapProductForAdmin(created.toObject()) });
  }));

  router.patch('/products/:productId', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'products')) return;
    const existing = await Product.findOne({ productId: String(req.params.productId || '').trim() });
    if (!existing) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const payload = buildProductPayload(req.body || {}, existing.toObject());
    Object.assign(existing, payload);
    await existing.save();
    await logAdminActivity(req, {
      action: 'updated',
      area: 'products',
      entityId: payload.productId,
      message: `Updated product ${payload.name}.`
    });
    res.json({ success: true, product: mapProductForAdmin(existing.toObject()) });
  }));

  router.get('/orders', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'orders')) return;
    const [orders, users] = await Promise.all([readOrders(), readUsers()]);
    const customerByEmail = new Map(
      buildCustomerStats(users, orders).map((customer) => [customer.email, customer])
    );

    const enrichedOrders = sortByDateDesc(orders, (order) => order?.updatedAt || order?.createdAt || order?.orderDate)
      .map((order) => {
        const customer = customerByEmail.get(normalizeEmail(order?.customerEmail || order?.customer?.email)) || null;
        const automation = buildOrderAutomation(order);
        return {
          orderId: safeString(order?.orderId || '', 120),
          customerId: safeString(order?.customerId || '', 120),
          customerName: safeString(order?.customerName || order?.customer?.name || customer?.name || '', 120),
          customerEmail: normalizeEmail(order?.customerEmail || order?.customer?.email),
          customerPhone: safeString(order?.customerPhone || order?.customer?.phone || customer?.phone || '', 40),
          shippingAddress: safeString(order?.shippingAddress || customer?.shippingAddress || '', 220),
          total: toPositiveNumber(order?.total, 0),
          currency: safeString(order?.currency || 'NGN', 10).toUpperCase(),
          orderStatus: normalizeOrderStatus(order?.orderStatus || order?.status),
          paymentStatus: normalizePaymentStatus(order?.paymentStatus),
          paymentMethod: safeString(order?.paymentMethod || order?.paymentMethodCode || 'Not selected', 80),
          paymentMethodCode: normalizePaymentMethod(order?.paymentMethodCode || order?.paymentMethod),
          paymentReference: safeString(order?.paymentReference || order?.transactionId || '', 120),
          estimatedDelivery: order?.estimatedDelivery || null,
          orderDate: order?.orderDate || null,
          createdAt: order?.createdAt || null,
          updatedAt: order?.updatedAt || null,
          paidAt: order?.paidAt || null,
          items: Array.isArray(order?.items) ? order.items : [],
          tracking: order?.tracking || buildTracking(order?.orderStatus || order?.status, order?.orderDate),
          metadata: order?.metadata && typeof order.metadata === 'object' ? order.metadata : {},
          canConfirmBankTransfer: Boolean(automation.requiresTransferReview),
          automation
        };
      });

    res.json({ success: true, orders: enrichedOrders });
  }));

  router.patch('/orders/:orderId', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'orders')) return;
    if (toBoolean(req.body?.confirmBankTransfer, false) && !hasPermission(getAdminContext(req).current, 'payments')) {
      return res.status(403).json({ error: 'You do not have permission to confirm payments.' });
    }
    const orders = await readOrders();
    const order = orders.find((entry) => String(entry?.orderId || '').trim() === String(req.params.orderId || '').trim());
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const resolved = resolveManagedOrderUpdate(order, req.body, getAdminContext(req).current?.email);
    if (resolved.error) {
      return res.status(409).json({ error: resolved.error });
    }
    const metadata = {
      ...resolved.metadata,
      adminNotes: safeString(req.body?.adminNotes || order?.metadata?.adminNotes || '', 240)
    };

    const updated = await updateOrderRecord(order.orderId, {
      orderStatus: resolved.orderStatus,
      status: resolved.orderStatus,
      paymentStatus: resolved.paymentStatus,
      paidAt: resolved.paidAt,
      estimatedDelivery: resolved.estimatedDelivery,
      tracking: buildTracking(resolved.orderStatus, order.orderDate),
      metadata
    });
    let statusEmail = { sent: false, error: '' };
    const previousOrderStatus = normalizeOrderStatus(order?.orderStatus || order?.status);
    const statusChanged = previousOrderStatus !== normalizeOrderStatus(updated?.orderStatus || updated?.status);
    const customerEmail = normalizeEmail(updated?.customerEmail || updated?.customer?.email);
    const statusEmailKey = `orderStatusEmailSent_${normalizeOrderStatus(updated?.orderStatus || updated?.status)}`;

    if (statusChanged
      && customerEmail
      && normalizePaymentStatus(updated?.paymentStatus) === 'paid'
      && !updated?.metadata?.[statusEmailKey]) {
      try {
        const result = await sendOrderStatusUpdateEmail(customerEmail, updated, {
          previousStatus: previousOrderStatus
        });
        await updateOrderRecord(updated.orderId, {
          metadata: {
            ...(updated.metadata || {}),
            [statusEmailKey]: new Date().toISOString(),
            [`${statusEmailKey}MessageId`]: String(result?.messageId || '').trim() || null
          }
        });
        statusEmail = { sent: true, error: '' };
      } catch (error) {
        statusEmail = { sent: false, error: error.message || 'Unable to send status email.' };
      }
    }

    await logAdminActivity(req, {
      action: 'updated',
      area: 'orders',
      entityId: updated?.orderId || order.orderId,
      message: `Updated order ${updated?.orderId || order.orderId}.`,
      metadata: {
        orderStatus: resolved.orderStatus,
        paymentStatus: resolved.paymentStatus,
        manualOverrideUsed: resolved.manualOverrideUsed,
        paymentStatusAutoManaged: resolved.ignoredManualPaymentChange,
        statusEmailSent: statusEmail.sent
      }
    });

    res.json({
      success: true,
      order: updated,
      automation: {
        manualOverrideUsed: resolved.manualOverrideUsed,
        paymentStatusAutoManaged: resolved.ignoredManualPaymentChange,
        alreadyPaid: resolved.alreadyPaid
      },
      statusEmail
    });
  }));

  router.post('/orders/:orderId/refund', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'payments')) return;
    const orders = await readOrders();
    const order = orders.find((entry) => String(entry?.orderId || '').trim() === String(req.params.orderId || '').trim());
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const refundAmount = Math.min(toPositiveNumber(req.body?.amount, toPositiveNumber(order.total, 0)), toPositiveNumber(order.total, 0));
    const metadata = {
      ...(order.metadata && typeof order.metadata === 'object' ? order.metadata : {}),
      refunds: [
        ...(Array.isArray(order?.metadata?.refunds) ? order.metadata.refunds : []),
        {
          amount: refundAmount,
          reason: safeString(req.body?.reason || 'Refund recorded by admin.', 200),
          refundedAt: new Date().toISOString(),
          refundedBy: normalizeEmail(getAdminContext(req).current?.email)
        }
      ]
    };

    const refundedOrderStatus = deriveManagedOrderStatus(order.orderStatus || order.status, 'refunded');
    const updated = await updateOrderRecord(order.orderId, {
      paymentStatus: 'refunded',
      orderStatus: refundedOrderStatus,
      status: refundedOrderStatus,
      paidAt: order?.paidAt || null,
      estimatedDelivery: resolveManagedEstimatedDelivery(order, refundedOrderStatus, null),
      tracking: buildTracking(refundedOrderStatus, order.orderDate),
      metadata
    });

    await logAdminActivity(req, {
      action: 'refunded',
      area: 'payments',
      entityId: updated?.orderId || order.orderId,
      message: `Recorded refund on order ${updated?.orderId || order.orderId}.`,
      metadata: { amount: refundAmount }
    });

    res.json({ success: true, order: updated });
  }));

  const confirmOrderPayment = asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'payments')) return;
    const orders = await readOrders();
    const order = orders.find((entry) => String(entry?.orderId || '').trim() === String(req.params.orderId || '').trim());
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const resolved = resolveManagedOrderUpdate(order, { confirmBankTransfer: true }, getAdminContext(req).current?.email);
    if (resolved.error) {
      return res.status(409).json({ error: resolved.error });
    }
    const updated = await updateOrderRecord(String(req.params.orderId || '').trim(), {
      paymentStatus: resolved.paymentStatus,
      orderStatus: resolved.orderStatus,
      status: resolved.orderStatus,
      paidAt: resolved.paidAt,
      estimatedDelivery: resolved.estimatedDelivery,
      tracking: buildTracking(resolved.orderStatus, order.orderDate),
      metadata: resolved.metadata
    });
    await logAdminActivity(req, {
      action: 'confirmed',
      area: 'payments',
      entityId: updated?.orderId || String(req.params.orderId || '').trim(),
      message: resolved.alreadyPaid
        ? `Skipped duplicate payment confirmation for ${updated?.orderId || String(req.params.orderId || '').trim()}.`
        : `Confirmed payment for ${updated?.orderId || String(req.params.orderId || '').trim()}.`
    });
    res.json({
      success: true,
      order: updated,
      alreadyPaid: resolved.alreadyPaid,
      message: resolved.alreadyPaid ? 'Order payment was already confirmed.' : 'Bank transfer confirmed.'
    });
  });

  router.post('/orders/:orderId/confirm-payment', confirmOrderPayment);
  router.patch('/orders/:orderId/confirm-payment', confirmOrderPayment);

  router.get('/customers', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'customers')) return;
    const [orders, users] = await Promise.all([readOrders(), readUsers()]);
    const customers = buildCustomerStats(users, orders).filter((customer) => customer.role === 'resident');
    res.json({
      success: true,
      customers: customers.sort((left, right) => right.totalSpent - left.totalSpent)
    });
  }));

  router.patch('/customers/:id', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'customers')) return;
    const users = await readUsers();
    const index = users.findIndex((entry) => String(entry?.id) === String(req.params.id || ''));
    if (index < 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const current = users[index];
    current.name = safeString(req.body?.name || current.name, 120) || current.name;
    current.phone = safeString(req.body?.phone || current.phone || '', 40);
    current.isBanned = toBoolean(req.body?.isBanned, current.isBanned === true);
    current.banReason = current.isBanned ? safeString(req.body?.banReason || current?.banReason || '', 200) : '';

    users[index] = current;
    await writeUsers(users);
    await logAdminActivity(req, {
      action: current.isBanned ? 'banned' : 'updated',
      area: 'customers',
      entityId: String(current.id),
      message: `${current.isBanned ? 'Updated ban status for' : 'Updated'} customer ${current.email}.`
    });

    res.json({ success: true, customer: current });
  }));

  router.post('/customers/:id/reset-password', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'customers')) return;
    const users = await readUsers();
    const index = users.findIndex((entry) => String(entry?.id) === String(req.params.id || ''));
    if (index < 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const tempPassword = `${crypto.randomBytes(3).toString('hex')}-${Math.floor(Math.random() * 9000) + 1000}`;
    users[index].passwordHash = await bcrypt.hash(tempPassword, 10);
    users[index].passwordResetIssuedAt = new Date().toISOString();
    users[index].passwordResetIssuedBy = normalizeEmail(getAdminContext(req).current?.email);
    await writeUsers(users);

    let emailed = false;
    try {
      await sendPasswordResetEmail(users[index].email, users[index].name, {
        resetCode: tempPassword,
        expiresIn: 'Use this temporary password at your next sign in.'
      });
      emailed = true;
    } catch (error) {
      console.error('Admin password reset email failed:', error);
    }

    await logAdminActivity(req, {
      action: 'reset_password',
      area: 'customers',
      entityId: String(users[index].id),
      message: `Issued a password reset for ${users[index].email}.`
    });

    res.json({
      success: true,
      temporaryPassword: tempPassword,
      emailed,
      user: users[index]
    });
  }));

  router.get('/messages', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'messages')) return;
    const data = await getContactMessagesData();
    res.json({
      success: true,
      messages: data.messages,
      summary: data.summary
    });
  }));

  router.patch('/messages/:messageId', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'messages')) return;
    const messageId = safeString(req.params.messageId || '', 120);
    if (!messageId) {
      return res.status(400).json({ error: 'Message id is required.' });
    }

    const collection = await getCollection('contact_messages');
    const existing = await collection.findOne({ _id: messageId });
    if (!existing) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    const nextInternalNote = safeMultiline(req.body?.internalNote ?? existing.internalNote ?? '', 800);
    const previousStatus = normalizeContactMessageStatus(existing.status);
    const workflow = buildContactWorkflow(existing, {
      status: req.body?.status,
      internalNote: nextInternalNote
    });
    const updatedAt = new Date().toISOString();
    let resolvedNotification = existing?.delivery?.resolved && typeof existing.delivery.resolved === 'object'
      ? existing.delivery.resolved
      : null;

    if (workflow.status === 'resolved' && previousStatus !== 'resolved' && !resolvedNotification?.resolvedNotifiedAt) {
      const users = await readUsers();
      resolvedNotification = await sendContactResolvedNotifications(
        {
          ...existing,
          messageId,
          internalNote: nextInternalNote,
          status: workflow.status,
          updatedAt
        },
        users,
        getAdminContext(req).current?.email
      );
    }

    await collection.updateOne(
      { _id: messageId },
      {
        $set: {
          status: workflow.status,
          internalNote: nextInternalNote,
          updatedAt,
          ...(resolvedNotification ? { 'delivery.resolved': resolvedNotification } : {})
        }
      }
    );

    await logAdminActivity(req, {
      action: 'updated',
      area: 'messages',
      entityId: messageId,
      message: `Updated contact message ${messageId}.`,
      metadata: {
        status: workflow.status,
        workflowMode: workflow.mode,
        resolvedNotification
      }
    });

    const refreshed = await collection.findOne({ _id: messageId }, { projection: { _id: 0 } });
    res.json({
      success: true,
      messageRecord: mapContactMessage({
        ...(existing || {}),
        ...(refreshed || {}),
        status: workflow.status,
        internalNote: nextInternalNote,
        updatedAt
      })
    });
  }));

  router.get('/payments', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'payments')) return;
    const [orders, users] = await Promise.all([readOrders(), readUsers()]);
    const payments = buildPaymentRecords(orders, users);
    res.json({
      success: true,
      payments,
      summary: {
        verifiedPayments: payments.filter((entry) => entry.status === 'paid').length,
        failedPayments: payments.filter((entry) => entry.status === 'failed').length,
        bankTransferConfirmations: payments.filter((entry) => entry.method.toLowerCase().includes('bank')).length,
        walletPayments: payments.filter((entry) => entry.type === 'wallet' || entry.provider === 'wallet').length,
        refundRecords: payments.reduce((sum, entry) => sum + (Array.isArray(entry.refunds) ? entry.refunds.length : 0), 0)
      }
    });
  }));

  router.get('/coupons', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'coupons')) return;
    const coupons = await Coupon.find({}).sort({ createdAt: -1 }).lean();
    const records = coupons.map(mapAdminCoupon);
    res.json({
      success: true,
      coupons: records,
      summary: buildCouponSummary(records)
    });
  }));

  router.post('/coupons', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'coupons')) return;
    const code = safeString(req.body?.code || '', 80).toUpperCase();
    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required.' });
    }

    const existing = await Coupon.findOne({ code }).select({ _id: 1 }).lean();
    if (existing) {
      return res.status(409).json({ error: 'A coupon with that code already exists.' });
    }

    const nextCoupon = resolveCouponMutation(req.body);
    if (nextCoupon.error) {
      return res.status(400).json({ error: nextCoupon.error });
    }
    nextCoupon.value.applicableProductIds = await resolveCouponProductTargets(nextCoupon.value.applicableProductIds);

    const created = await Coupon.create({
      code,
      ...nextCoupon.value
    });

    await logAdminActivity(req, {
      action: 'created',
      area: 'coupons',
      entityId: code,
      message: `Created coupon ${code}.`
    });

    res.status(201).json({ success: true, coupon: mapAdminCoupon(created.toObject()) });
  }));

  router.patch('/coupons/:code', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'coupons')) return;
    const coupon = await Coupon.findOne({ code: String(req.params.code || '').trim().toUpperCase() });
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found.' });
    }

    const nextCoupon = resolveCouponMutation(req.body, coupon.toObject());
    if (nextCoupon.error) {
      return res.status(400).json({ error: nextCoupon.error });
    }
    nextCoupon.value.applicableProductIds = await resolveCouponProductTargets(nextCoupon.value.applicableProductIds);

    coupon.discountType = nextCoupon.value.discountType;
    coupon.discountValue = nextCoupon.value.discountValue;
    coupon.minimumOrderAmount = nextCoupon.value.minimumOrderAmount;
    coupon.maximumDiscountAmount = nextCoupon.value.maximumDiscountAmount;
    coupon.expiresAt = nextCoupon.value.expiresAt;
    coupon.isActive = nextCoupon.value.isActive;
    coupon.usageLimit = nextCoupon.value.usageLimit;
    coupon.perUserLimit = nextCoupon.value.perUserLimit;
    coupon.applicableProductIds = nextCoupon.value.applicableProductIds;
    coupon.applicableCategoryIds = nextCoupon.value.applicableCategoryIds;
    coupon.excludedProductIds = nextCoupon.value.excludedProductIds;
    coupon.freeShipping = nextCoupon.value.freeShipping;
    await coupon.save();

    await logAdminActivity(req, {
      action: 'updated',
      area: 'coupons',
      entityId: coupon.code,
      message: `Updated coupon ${coupon.code}.`
    });

    res.json({ success: true, coupon: mapAdminCoupon(coupon.toObject()) });
  }));

  async function deleteCouponByCode(req, res) {
    if (!requirePermission(req, res, 'coupons')) return;
    const code = String(req.params.code || '').trim().toUpperCase();
    const coupon = await Coupon.findOneAndDelete({ code }).lean();
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found.' });
    }

    await logAdminActivity(req, {
      action: 'deleted',
      area: 'coupons',
      entityId: code,
      message: `Deleted coupon ${code}.`
    });

    res.json({ success: true });
  }

  router.delete('/coupons/:code', asyncHandler(deleteCouponByCode));
  router.post('/coupons/:code/delete', asyncHandler(deleteCouponByCode));

  router.get('/settings', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'settings')) return;
    const settings = await readSettings();
    res.json({ success: true, settings });
  }));

  router.patch('/settings', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'settings')) return;
    const current = await readSettings();
    const requested = req.body && typeof req.body === 'object' ? clone(req.body) : {};
    if (!isSuperAdmin(getAdminContext(req).current)) {
      delete requested.security;
      requested.shipping = requested.shipping && typeof requested.shipping === 'object' ? requested.shipping : {};
      if (requested.shippingFeeNgn !== undefined) {
        requested.shipping.defaultDomesticFeeNgn = requested.shippingFeeNgn;
      }
    }
    const next = deepMerge(current, requested);
    await writeSettings(next);
    await logAdminActivity(req, {
      action: 'updated',
      area: 'settings',
      entityId: 'app',
      message: isSuperAdmin(getAdminContext(req).current)
        ? 'Updated admin settings.'
        : 'Updated shipping operations settings.'
    });
    res.json({ success: true, settings: next });
  }));

  router.get('/content', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'content')) return;
    const content = await getContentDocument();
    res.json({ success: true, content });
  }));

  router.patch('/content', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'content')) return;
    const current = await getContentDocument();
    const next = deepMerge(current, req.body || {});
    await saveContentDocument(next);
    await logAdminActivity(req, {
      action: 'updated',
      area: 'content',
      entityId: 'main',
      message: 'Updated website content.'
    });
    res.json({ success: true, content: next });
  }));

  router.get('/newsletter', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'newsletter')) return;
    const subscribers = await readSubscribers();
    const sourceSummary = subscribers.reduce((summary, subscriber) => {
      const source = safeString(subscriber?.source || 'unknown', 80).toLowerCase();
      summary[source] = (summary[source] || 0) + 1;
      return summary;
    }, {});
    const brevoConfig = getBrevoConfig();

    res.json({
      success: true,
      subscribers,
      summary: {
        total: subscribers.length,
        active: subscribers.filter((entry) => entry?.marketingOptOut !== true).length,
        optedOut: subscribers.filter((entry) => entry?.marketingOptOut === true).length,
        usedDiscounts: subscribers.filter((entry) => entry?.discountUsed).length,
        sourceSummary
      },
      brevo: {
        configured: isBrevoConfigured(),
        senderEmail: brevoConfig.senderEmail || '',
        senderName: brevoConfig.senderName || '',
        lists: {
          newsletter: brevoConfig.lists?.newsletter || null,
          customers: brevoConfig.lists?.customers || null,
          vip: brevoConfig.lists?.vip || null,
          abandonedCart: brevoConfig.lists?.abandoned_cart || null,
          giveaway: brevoConfig.lists?.giveaway || null,
          influencers: brevoConfig.lists?.influencers || null,
          wholesale: brevoConfig.lists?.wholesale || null,
          support: brevoConfig.lists?.support || null,
          preorder: brevoConfig.lists?.preorder || null,
          events: brevoConfig.lists?.events || null
        }
      }
    });
  }));

  router.post('/newsletter/announce', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'newsletter')) return;
    const subscribers = await readSubscribers();
    const subject = safeString(req.body?.subject || '', 120);
    const body = safeMultiline(req.body?.body || '', 5000);
    if (!subject || !body) {
      return res.status(400).json({ error: 'Announcement subject and body are required.' });
    }

    const activeSubscribers = subscribers.filter((subscriber) => subscriber?.marketingOptOut !== true);
    if (!activeSubscribers.length) {
      return res.status(400).json({ error: 'There are no subscribers to contact yet.' });
    }

    const results = [];
    for (const subscriber of activeSubscribers.slice(0, 100)) {
      const unsubscribeUrl = typeof buildNewsletterUnsubscribeUrl === 'function'
        ? buildNewsletterUnsubscribeUrl(subscriber)
        : '';
      const footerHtml = unsubscribeUrl
        ? `<p style="margin:22px 0 0;font-size:12px;line-height:1.7;color:#6b5a4d;">You are receiving this because you subscribed to Benzy Luxury updates. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b5a4d;text-decoration:underline;">Unsubscribe</a>.</p>`
        : '';
      const footerText = unsubscribeUrl ? `\n\nUnsubscribe: ${unsubscribeUrl}` : '';
      try {
        await sendTransactionalEmail({
          toEmail: subscriber.email,
          subject,
          htmlContent: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#231711;"><p>${escapeHtml(body).replace(/\n/g, '<br>')}</p>${footerHtml}</div>`,
          textContent: `${body}${footerText}`,
          tags: ['newsletter', 'announcement']
        });
        results.push({ email: subscriber.email, sent: true });
      } catch (error) {
        results.push({ email: subscriber.email, sent: false, error: error.message || 'Unable to send.' });
      }
    }

    await logAdminActivity(req, {
      action: 'sent',
      area: 'newsletter',
      entityId: subject,
      message: `Sent newsletter announcement "${subject}".`,
      metadata: {
        sentCount: results.filter((entry) => entry.sent).length,
        failedCount: results.filter((entry) => !entry.sent).length
      }
    });

    res.json({
      success: true,
      sentCount: results.filter((entry) => entry.sent).length,
      failedCount: results.filter((entry) => !entry.sent).length,
      results
    });
  }));

  router.get('/reviews', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'reviews')) return;
    const reviews = await getReviews();
    res.json({ success: true, reviews });
  }));

  router.post('/reviews', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'reviews')) return;
    const collection = await getCollection('reviews');
    const review = {
      reviewId: `review-${Date.now().toString(36)}`,
      customerName: safeString(req.body?.customerName || 'Anonymous', 120),
      productName: safeString(req.body?.productName || '', 120),
      rating: Math.min(5, Math.max(1, toInteger(req.body?.rating, 5))),
      comment: safeString(req.body?.comment || '', 400),
      status: safeString(req.body?.status || 'approved', 40).toLowerCase(),
      featured: toBoolean(req.body?.featured, false),
      createdAt: new Date().toISOString()
    };
    await collection.insertOne({ _id: review.reviewId, ...review });
    await logAdminActivity(req, {
      action: 'created',
      area: 'reviews',
      entityId: review.reviewId,
      message: `Created testimonial for ${review.customerName}.`
    });
    res.status(201).json({ success: true, review });
  }));

  router.patch('/reviews/:reviewId', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'reviews')) return;
    const collection = await getCollection('reviews');
    const reviewId = String(req.params.reviewId || '').trim();
    const existing = await collection.findOne({ _id: reviewId });
    if (!existing) {
      return res.status(404).json({ error: 'Review not found.' });
    }

    const next = {
      ...existing,
      customerName: safeString(req.body?.customerName || existing.customerName || 'Anonymous', 120),
      productName: safeString(req.body?.productName || existing.productName || '', 120),
      rating: Math.min(5, Math.max(1, toInteger(req.body?.rating, existing.rating || 5))),
      comment: safeString(req.body?.comment || existing.comment || '', 400),
      status: safeString(req.body?.status || existing.status || 'approved', 40).toLowerCase(),
      featured: toBoolean(req.body?.featured, existing.featured === true),
      updatedAt: new Date().toISOString()
    };
    delete next._id;

    await collection.replaceOne({ _id: reviewId }, { _id: reviewId, ...next }, { upsert: true });
    await logAdminActivity(req, {
      action: 'updated',
      area: 'reviews',
      entityId: reviewId,
      message: `Updated review ${reviewId}.`
    });
    res.json({ success: true, review: next });
  }));

  router.get('/users', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'users')) return;
    const [orders, users] = await Promise.all([readOrders(), readUsers()]);
    const customers = buildCustomerStats(users, orders);
    res.json({
      success: true,
      users: customers.map((user) => ({
        ...user,
        adminRole: normalizeAdminRole(user)
      }))
    });
  }));

  router.post('/users', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'users')) return;
    const name = safeString(req.body?.name || '', 120);
    const email = normalizeEmail(req.body?.email || '');
    const phone = safeString(req.body?.phone || '', 40);
    const adminRole = String(req.body?.adminRole || 'operations_manager').trim().toLowerCase();
    const password = String(req.body?.password || '').trim();

    if (!name || name.length < 2) return res.status(400).json({ error: 'Name is required.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });
    if (!ADMIN_ROLES.includes(adminRole)) return res.status(400).json({ error: 'Invalid admin role.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const users = await readUsers();
    if (users.some((user) => normalizeEmail(user?.email) === email)) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const user = {
      id: Date.now(),
      name,
      email,
      phone,
      role: 'host',
      adminRole,
      isBanned: false,
      banReason: '',
      addresses: [],
      wishlist: [],
      profilePicture: '',
      customerSegment: 'staff',
      emailVerified: true,
      emailVerification: null,
      passwordReset: null,
      loginOtp: null,
      loginHistory: [],
      notifications: normalizeNotificationSettings(),
      passwordHash: await bcrypt.hash(password, 10),
      createdAt: new Date().toISOString(),
      createdBy: normalizeEmail(getAdminContext(req).current?.email)
    };

    users.push(user);
    await writeUsers(users);
    await logAdminActivity(req, {
      action: 'created',
      area: 'users',
      entityId: String(user.id),
      message: `Created ${adminRole} account for ${email}.`,
      metadata: { role: user.role, adminRole }
    });

    res.status(201).json({
      success: true,
      user: toPublicUser ? { ...toPublicUser(user), adminRole: normalizeAdminRole(user), isBanned: false } : user
    });
  }));

  router.patch('/users/:id', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'users')) return;
    const users = await readUsers();
    const index = users.findIndex((entry) => String(entry?.id) === String(req.params.id || ''));
    if (index < 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const current = users[index];
    current.name = safeString(req.body?.name || current.name, 120) || current.name;
    current.phone = safeString(req.body?.phone || current.phone || '', 40);

    if (req.body?.role) {
      current.role = safeString(req.body.role, 40).toLowerCase() === 'host' ? 'host' : 'resident';
    }

    current.adminRole = current.role === 'host'
      ? (ADMIN_ROLES.includes(String(req.body?.adminRole || current.adminRole || '').trim().toLowerCase())
          ? String(req.body?.adminRole || current.adminRole).trim().toLowerCase()
          : normalizeAdminRole(current))
      : '';
    current.isBanned = toBoolean(req.body?.isBanned, current.isBanned === true);
    current.banReason = current.isBanned ? safeString(req.body?.banReason || current?.banReason || '', 200) : '';

    const nextPassword = String(req.body?.password || '').trim();
    if (nextPassword) {
      if (nextPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }
      current.passwordHash = await bcrypt.hash(nextPassword, 10);
      current.passwordUpdatedAt = new Date().toISOString();
      current.passwordUpdatedBy = normalizeEmail(getAdminContext(req).current?.email);
    }

    users[index] = current;
    await writeUsers(users);

    await logAdminActivity(req, {
      action: 'updated',
      area: 'users',
      entityId: String(current.id),
      message: `Updated user ${current.email}.`,
      metadata: {
        role: current.role,
        adminRole: current.adminRole,
        passwordChanged: Boolean(nextPassword)
      }
    });

    const token = String(getAdminContext(req).current?.id) === String(current.id)
      ? signToken(current)
      : null;

    res.json({
      success: true,
      user: toPublicUser ? { ...toPublicUser(current), adminRole: normalizeAdminRole(current), isBanned: current.isBanned === true } : current,
      token
    });
  }));

  router.delete('/users/:id', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'users')) return;
    const ctx = getAdminContext(req);
    const targetId = String(req.params.id || '').trim();
    if (!targetId) {
      return res.status(400).json({ error: 'User id is required.' });
    }
    if (String(ctx.current?.id) === targetId) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const users = await readUsers();
    const targetUser = users.find((user) => String(user?.id) === targetId);
    if (targetUser && normalizeAdminRole(targetUser) === 'super_admin') {
      return res.status(403).json({ error: 'CEO and super admin accounts cannot be deleted.' });
    }
    const nextUsers = users.filter((user) => String(user?.id) !== targetId);
    if (nextUsers.length === users.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await writeUsers(nextUsers);
    await logAdminActivity(req, {
      action: 'deleted',
      area: 'users',
      entityId: targetId,
      message: `Deleted user ${targetId}.`
    });
    res.json({ success: true });
  }));

  router.get('/logs', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'logs')) return;
    const collection = await getCollection('admin_activity_logs');
    const logs = await collection
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(80)
      .toArray();
    res.json({ success: true, logs });
  }));

  router.get('/logs/export', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'logs')) return;
    const statement = await buildActivityLogStatement(req.query?.period || 'retention');
    const format = safeString(req.query?.format || 'csv', 20).toLowerCase() === 'pdf' ? 'pdf' : 'csv';
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${statement.pdfFilename}"`);
      res.send(statement.pdf);
      return;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${statement.filename}"`);
    res.send(statement.csv);
  }));

  router.post('/logs/email', asyncHandler(async (req, res) => {
    if (!requirePermission(req, res, 'logs')) return;
    const currentUser = getAdminContext(req).current || {};
    const toEmail = normalizeEmail(currentUser.email);
    if (!toEmail) {
      return res.status(400).json({ error: 'Current admin email is required.' });
    }

    const statement = await buildActivityLogStatement(req.body?.period || 'retention');
    const format = safeString(req.body?.format || 'csv', 20).toLowerCase() === 'pdf' ? 'pdf' : 'csv';
    const attachmentName = format === 'pdf' ? statement.pdfFilename : statement.filename;
    const attachmentContent = format === 'pdf'
      ? statement.pdf.toString('base64')
      : Buffer.from(statement.csv, 'utf8').toString('base64');
    await sendTransactionalEmail({
      toEmail,
      toName: currentUser.name || 'Admin',
      subject: `Benzy Luxury admin activity statement - ${statement.label}`,
      htmlContent: `
        <div style="margin:0;padding:28px;background:#f8f1eb;font-family:Arial,sans-serif;color:#231711;">
          <div style="max-width:640px;margin:0 auto;background:#fffaf5;border:1px solid #e6d8ca;border-radius:18px;overflow:hidden;">
            <div style="padding:26px 28px;background:#231711;color:#fffaf5;">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#ddb36a;">Benzy Luxury</p>
              <h2 style="margin:0;font-size:26px;line-height:1.2;">Admin activity statement</h2>
              <p style="margin:10px 0 0;color:#eaded2;line-height:1.6;">Attached is the ${statement.label} archive for the admin control room.</p>
            </div>
            <div style="padding:24px 28px;">
              <div style="display:block;margin:0 0 18px;padding:16px;border-radius:14px;background:#f8f1eb;border:1px solid #eaded2;">
                <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#9f6536;">Statement range</p>
                <p style="margin:0;color:#4e3a2c;line-height:1.7;">From ${statement.start.toISOString()}<br>To ${statement.end.toISOString()}</p>
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:12px;border:1px solid #eaded2;border-radius:12px;background:#ffffff;">
                    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#9f6536;">Records</p>
                    <strong style="font-size:22px;">${statement.logs.length}</strong>
                  </td>
                  <td width="12"></td>
                  <td style="padding:12px;border:1px solid #eaded2;border-radius:12px;background:#ffffff;">
                    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#9f6536;">Retention</p>
                    <strong style="font-size:22px;">${statement.retentionDays} days</strong>
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0;color:#6b5a4d;line-height:1.7;">Open the attached ${format.toUpperCase()} file to review the separated admin sections, including orders, products, customers, payments, messages, settings, and audit exports where records exist.</p>
            </div>
          </div>
        </div>
      `,
      textContent: `Attached is the ${statement.label} admin activity archive. Records included: ${statement.logs.length}. Retention setting: ${statement.retentionDays} day(s).`,
      attachments: [{
        name: attachmentName,
        content: attachmentContent
      }],
      tags: ['admin', 'activity-logs']
    });

    await logAdminActivity(req, {
      action: 'exported',
      area: 'logs',
      entityId: statement.label,
      message: `Emailed admin activity statement ${statement.label}.`
    });

    res.json({ success: true, sentTo: toEmail, count: statement.logs.length });
  }));

  return router;
}

module.exports = {
  ADMIN_PERMISSION_MAP,
  ADMIN_ROLES,
  DEFAULT_CONTENT,
  createAdminRouter
};
