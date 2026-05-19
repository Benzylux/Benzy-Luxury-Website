// Benzy Luxury Backend Server
const { loadEnvironment } = require('./loadEnv');

const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { closeMongo, getCollection, getMongoConfig, getMongoStatus, initializeMongo } = require('./mongo');
const { clearUserCart } = require('./src/cart/services/cartService');
const { ngnToUsd, usdToNgn } = require('./src/cart/utils/money');
const {
  buildCheckoutPricingFromNgn,
  buildPaystackVerificationResult,
  getExchangeRates,
  getCurrencyConfigSnapshot,
  getDefaultCheckoutCurrency,
  getSupportedDisplayCurrencies,     
  normalizeCurrencyCode: normalizeSupportedCurrencyCode,
  resolveCheckoutCurrency: resolveConfiguredCheckoutCurrency
} = require('./services/exchangeRates');
const {
  BrevoError,
  addSupportContact,
  addCustomerContact,
  addGiveawayContact,
  isBrevoConfigured,
  addNewsletterContact,
  addWalletTopUpContact,
  addVipContact,
  sendOrderConfirmation,
  sendTransactionalEmail,
  sendWalletTopUpReceiptEmail,
  sendWelcomeEmail
} = require('./src/services/brevoService');
const {
  isWatiConfigured,
  isWatiTemplateConfigured,
  sendWatiSessionMessage,
  sendWatiTemplateMessage
} = require('./src/services/watiService');
const {
  closeCartSystem,
  createCartRouter,
  initializeCartSystem,
  recordCouponRedemption,
  validateCheckoutCartForUser
} = require('./src/cart');
const { DEFAULT_CONTENT, createAdminRouter } = require('./src/admin/adminRoutes');
const Product = require('./src/cart/models/Product');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

// Paystack Configuration
// IMPORTANT: Set your Paystack secret key as environment variable: PAYSTACK_SECRET_KEY
// Example: PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxx
// Optional: set PAYSTACK_CALLBACK_BASE_URL if your frontend is hosted on a different public URL.
// Example: https://benzyluxury.com

// Flutterwave Configuration  
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || 'FLWSECK_YOUR_SECRET_KEY_HERE';
const USERS_FILE = path.join(__dirname, 'users.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const SUBSCRIBERS_FILE = path.join(__dirname, 'subscribers.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const FRONTEND_DIR = path.resolve(__dirname, '..', '..', 'frontend');
const ROOT_WELL_KNOWN_DIR = path.resolve(__dirname, '..', '..', '.well-known');
const FRONTEND_WELL_KNOWN_DIR = path.join(FRONTEND_DIR, '.well-known');
const NEWSLETTER_SOURCE = 'footer';
const NEWSLETTER_DISCOUNT_PERCENT = 10;
const NEWSLETTER_DISCOUNT_RATIO = NEWSLETTER_DISCOUNT_PERCENT / 100;
const ORDER_TAX_RATE = 0.075;
const WALLET_CURRENCY = 'NGN';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const COUNTRY_HEADER_KEYS = [
  'x-vercel-ip-country',
  'cf-ipcountry',
  'cloudfront-viewer-country',
  'x-country-code',
  'x-appengine-country',
  'fastly-client-country-code'
];
const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || '2347011547813@host.local,benzyluxury@gmail.com')
  .split(',')
  .map((email) => String(email || '').trim().toLowerCase())
  .filter(Boolean);
const CONTACT_INFO_DEFAULTS = Object.freeze({
  email: 'benzyluxury@gmail.com',
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

// Middleware
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use((req, res, next) => {
  if (!shouldRedirectToHttps(req)) {
    next();
    return;
  }

  const targetUrl = buildHttpsUrl(req);
  if (['GET', 'HEAD'].includes(String(req.method || '').toUpperCase())) {
    res.redirect(301, targetUrl);
    return;
  }

  res.status(400).json({
    success: false,
    message: 'HTTPS is required for Apple Pay and secure checkout.',
    redirectUrl: targetUrl
  });
});
app.get('/.well-known/:fileName', (req, res, next) => {
  const safeFileName = path.basename(String(req.params.fileName || '').trim());
  if (!safeFileName) {
    next();
    return;
  }

  const resolvedPath = resolveWellKnownFilePath(safeFileName);
  if (!resolvedPath) {
    next();
    return;
  }

  res.setHeader('Content-Type', 'application/text');
  res.sendFile(resolvedPath);
});
app.use(express.static(FRONTEND_DIR));

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = Number(status) || 500;
  return error;
}

function readRuntimeEnvValue(key) {
  const currentValue = String(process.env[key] || '').trim();
  if (currentValue) return currentValue;

  loadEnvironment();
  return String(process.env[key] || '').trim();
}

function getPaystackSecretKey() {
  return readRuntimeEnvValue('PAYSTACK_SECRET_KEY');
}

function getPaystackPublicKey() {
  return readRuntimeEnvValue('PAYSTACK_PUBLIC_KEY');
}

function getPaystackCallbackBaseUrl() {
  return readRuntimeEnvValue('PAYSTACK_CALLBACK_BASE_URL');
}

function getBrevoWebhookSecret() {
  return readRuntimeEnvValue('BREVO_WEBHOOK_SECRET');
}

function requirePaystackSecretKey() {
  if (!getPaystackSecretKey()) {
    throw httpError(500, 'PAYSTACK_SECRET_KEY is not configured on the server.');
  }
}

function requirePaystackPublicKey() {
  if (!getPaystackPublicKey()) {
    throw httpError(500, 'PAYSTACK_PUBLIC_KEY is not configured on the server.');
  }
}

function requireBrevoWebhookSecret() {
  if (!getBrevoWebhookSecret()) {
    throw httpError(500, 'BREVO_WEBHOOK_SECRET is not configured on the server.');
  }
}

function normalizeCurrencyCode(value, fallback = 'NGN') {
  return normalizeSupportedCurrencyCode(value, fallback || 'NGN', getSupportedDisplayCurrencies()) || 'NGN';
}

function resolveCheckoutCurrency(preferredCurrency, fallbackCurrency = '') {
  return resolveConfiguredCheckoutCurrency(preferredCurrency, fallbackCurrency || getDefaultCheckoutCurrency());
}

function getDetectedCheckoutCurrencyForCountryCode(countryCode) {
  return resolveCheckoutCurrency(countryCode === 'NG' ? 'NGN' : 'USD', getDefaultCheckoutCurrency());
}

function extractRequestHostname(req) {
  return String(req?.headers?.host || req?.get?.('host') || '')
    .trim()
    .split(':')[0]
    .toLowerCase();
}

function isLocalHostname(hostname) {
  const safeHostname = String(hostname || '').trim().toLowerCase();
  return LOCAL_HOSTNAMES.has(safeHostname);
}

function isHttpsRequest(req) {
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (req?.secure || req?.protocol === 'https' || forwardedProto === 'https') return true;
  return false;
}

function shouldRedirectToHttps(req) {
  const hostname = extractRequestHostname(req);
  if (!hostname || isLocalHostname(hostname)) return false;
  return !isHttpsRequest(req);
}

function buildHttpsUrl(req) {
  const host = String(req?.headers?.host || req?.get?.('host') || '').trim();
  return `https://${host}${req?.originalUrl || '/'}`;
}

function isPlaceholderPublicBaseUrl(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  return normalized.includes('your-frontend-domain.com') || normalized.includes('example.com');
}

function extractCountryCodeFromAcceptLanguage(value) {
  const safeValue = String(value || '').trim();
  if (!safeValue) return '';

  const match = safeValue.match(/(?:^|,)\s*[a-z]{2,3}-([A-Z]{2})\b/);
  return match ? String(match[1]).trim().toUpperCase() : '';
}

function getRequestCountryCode(req, fallbackCountry = '') {
  for (const headerName of COUNTRY_HEADER_KEYS) {
    const value = String(req?.headers?.[headerName] || '').trim().toUpperCase();
    if (value && value !== 'XX') return value;
  }

  const acceptLanguageCountry = extractCountryCodeFromAcceptLanguage(req?.headers?.['accept-language']);
  if (acceptLanguageCountry) return acceptLanguageCountry;

  const fallback = String(fallbackCountry || '').trim().toUpperCase();
  if (fallback) {
    if (fallback.length === 2 || fallback.length === 3) return fallback;
    if (fallback === 'NIGERIA') return 'NG';
  }

  return '';
}

function resolveWellKnownFilePath(fileName) {
  const safeFileName = path.basename(String(fileName || '').trim());
  if (!safeFileName) return '';

  const candidates = [
    path.join(ROOT_WELL_KNOWN_DIR, safeFileName),
    path.join(FRONTEND_WELL_KNOWN_DIR, safeFileName)
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function readJsonSeed(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw || 'null');
  } catch {
    return fallback;
  }
}

async function readCollectionRecords(collectionName) {
  const collection = await getCollection(collectionName);
  return collection.find({}, { projection: { _id: 0 } }).toArray();
}

async function replaceCollectionRecords(collectionName, records, getId) {
  const collection = await getCollection(collectionName);
  const safeRecords = Array.isArray(records) ? records.filter(Boolean) : [];

  await collection.deleteMany({});

  if (!safeRecords.length) return;

  await collection.insertMany(
    safeRecords.map((record, index) => ({
      ...record,
      _id: String(getId(record, index))
    }))
  );
}

async function collectionHasDocuments(collectionName) {
  const collection = await getCollection(collectionName);
  const existing = await collection.findOne({}, { projection: { _id: 1 } });
  return Boolean(existing);
}

function deepClone(value) {
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
      output[key] = deepMerge(
        output[key] && typeof output[key] === 'object' ? output[key] : {},
        value
      );
      return;
    }

    output[key] = value;
  });

  return output;
}

function normalizeContactPhoneValue(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function normalizeSiteContentPayload(payload) {
  const next = payload && typeof payload === 'object'
    ? deepClone(payload)
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

async function readSingletonDocument(collectionName, id, defaults) {
  const collection = await getCollection(collectionName);
  const existing = await collection.findOne({ _id: id });

  if (!existing) {
    const next = deepClone(defaults);
    await collection.insertOne({ _id: id, ...next });
    return next;
  }

  const merged = deepMerge(deepClone(defaults), existing);
  const normalized = collectionName === 'site_content' && id === 'main'
    ? normalizeSiteContentPayload(merged)
    : merged;
  delete normalized._id;

  const comparableExisting = deepClone(existing);
  delete comparableExisting._id;

  if (JSON.stringify(normalized) !== JSON.stringify(comparableExisting)) {
    await collection.replaceOne({ _id: id }, { _id: id, ...normalized }, { upsert: true });
  }

  return normalized;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({
  email: true,
  marketing: false,
  sms: true
});

function normalizeNotificationSettings(source) {
  const settings = source && typeof source === 'object' ? source : {};
  return {
    email: settings.email === undefined ? DEFAULT_NOTIFICATION_SETTINGS.email : Boolean(settings.email),
    marketing: settings.marketing === undefined ? DEFAULT_NOTIFICATION_SETTINGS.marketing : Boolean(settings.marketing),
    sms: settings.sms === undefined ? DEFAULT_NOTIFICATION_SETTINGS.sms : Boolean(settings.sms)
  };
}

function mergeNotificationSettings(current, updates) {
  const base = normalizeNotificationSettings(current);
  const patch = updates && typeof updates === 'object' ? updates : {};
  return normalizeNotificationSettings({
    ...base,
    ...(Object.prototype.hasOwnProperty.call(patch, 'email') ? { email: patch.email } : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'marketing') ? { marketing: patch.marketing } : {}),
    ...(Object.prototype.hasOwnProperty.call(patch, 'sms') ? { sms: patch.sms } : {})
  });
}

function sanitizePlainText(value, maxLength = 160) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeMultilineText(value, maxLength = 2400) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
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

function normalizePublicBaseUrl(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  const candidate = /^[a-z]+:\/\//i.test(rawValue)
    ? rawValue
    : `https://${rawValue.replace(/^\/+/, '')}`;

  try {
    const url = new URL(candidate);
    return url.origin;
  } catch {
    return '';
  }
}

function buildPublicUrl(pathname = '') {
  const baseUrl = normalizePublicBaseUrl(
    readRuntimeEnvValue('BREVO_PUBLIC_BASE_URL')
    || readRuntimeEnvValue('PUBLIC_SITE_URL')
    || readRuntimeEnvValue('SITE_URL')
    || getPaystackCallbackBaseUrl()
  );

  if (!baseUrl) return '';

  const safePath = String(pathname || '').trim();
  if (!safePath) return baseUrl;

  try {
    const normalizedPath = safePath.startsWith('/') ? safePath : `/${safePath}`;
    return new URL(normalizedPath, `${baseUrl}/`).toString();
  } catch {
    return baseUrl;
  }
}

function formatContactTimestamp(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'To be confirmed';

  try {
    return new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function buildMailtoLink(email, subject = '') {
  const safeEmail = normalizeEmail(email);
  if (!isValidEmail(safeEmail)) return '';

  const safeSubject = sanitizePlainText(subject, 160);
  return safeSubject
    ? `mailto:${safeEmail}?subject=${encodeURIComponent(safeSubject)}`
    : `mailto:${safeEmail}`;
}

function normalizeWhatsAppPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('00') ? digits.slice(2) : digits;
}

function buildContactSupportRecipients(contactInfo) {
  const recipients = new Set();
  const primary = normalizeEmail(contactInfo?.email || CONTACT_INFO_DEFAULTS.email);
  if (isValidEmail(primary)) recipients.add(primary);

  ADMIN_EMAILS.forEach((email) => {
    const normalized = normalizeEmail(email);
    if (!normalized || normalized.endsWith('@host.local')) return;
    if (isValidEmail(normalized)) recipients.add(normalized);
  });

  return Array.from(recipients);
}

function buildAdminNotificationRecipients() {
  return buildContactSupportRecipients(CONTACT_INFO_DEFAULTS);
}

function buildAdminNotificationHtml(title, intro, rows = []) {
  const safeRows = (Array.isArray(rows) ? rows : [])
    .map(([label, value]) => {
      const safeLabel = escapeHtml(label);
      const safeValue = escapeHtml(value || 'Not provided').replace(/\n/g, '<br>');
      return `
        <tr>
          <td style="padding:13px 0;border-bottom:1px solid #e5e5e5;color:#777777;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;vertical-align:top;">${safeLabel}</td>
          <td style="padding:13px 0;border-bottom:1px solid #e5e5e5;color:#111111;text-align:right;font-weight:700;line-height:1.55;vertical-align:top;">${safeValue}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111111;">
      <div style="max-width:680px;margin:0 auto;padding:32px 18px;">
        <div style="margin:0 0 28px;">
          <div style="display:inline-block;width:22px;height:22px;background:#009e49;border-radius:4px;color:#ffffff;text-align:center;line-height:22px;font-weight:800;">✓</div>
          <span style="margin-left:8px;font-size:28px;font-weight:800;vertical-align:middle;">Benzy Luxury</span>
        </div>
        <div>
          <h1 style="margin:0 0 20px;font-size:28px;line-height:1.2;color:#000000;">${escapeHtml(title)}</h1>
          <p style="margin:0 0 22px;font-size:16px;line-height:1.7;color:#222222;">${escapeHtml(intro)}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tbody>${safeRows}</tbody>
          </table>
          <div style="margin-top:28px;text-align:center;">
            <a href="https://benzyluxury.com.ng/AdminDashboard.html" style="display:block;padding:14px 18px;border:1px solid #009e49;color:#009e49;text-decoration:none;font-size:16px;font-weight:700;">Open Admin Dashboard</a>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function sendAdminNotificationEmail({ subject, title, intro, rows, textLines, tags }) {
  const recipients = buildAdminNotificationRecipients();
  const summary = { configured: isBrevoConfigured(), recipients, delivered: [], errors: [] };
  if (!summary.configured) {
    summary.errors.push('Brevo email service is not configured.');
    return summary;
  }

  for (const recipient of recipients) {
    try {
      await sendTransactionalEmail({
        toEmail: recipient,
        subject,
        htmlContent: buildAdminNotificationHtml(title, intro, rows),
        textContent: (Array.isArray(textLines) ? textLines : []).filter(Boolean).join('\n'),
        tags: ['admin-alert', ...(Array.isArray(tags) ? tags : [])]
      });
      summary.delivered.push(recipient);
    } catch (error) {
      summary.errors.push(`${recipient}: ${error.message || 'Unable to send.'}`);
    }
  }

  return summary;
}

function buildOrderItemsSummary(items) {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) return 'No items listed';
  return safeItems
    .map((item) => {
      const name = sanitizePlainText(item?.title || item?.name || 'Item', 80);
      const quantity = Math.max(1, Number.parseInt(String(item?.quantity || item?.qty || 1), 10) || 1);
      const price = Number(item?.price || item?.priceNgn || item?.priceUsd || 0);
      const options = [
        item?.size ? `size ${sanitizePlainText(item.size, 30)}` : '',
        item?.color ? `color ${sanitizePlainText(item.color, 40)}` : ''
      ].filter(Boolean).join(', ');
      const image = sanitizePlainText(item?.image || '', 180);
      return [
        `${name} x${quantity}`,
        options ? `(${options})` : '',
        price ? `unit ${price.toLocaleString('en-US')}` : '',
        image ? `image: ${image}` : ''
      ].filter(Boolean).join(' ');
    })
    .join('\n');
}

function buildOrderProductRows(items, currency) {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) return [['Products ordered', 'No items listed']];

  return safeItems.slice(0, 12).map((item, index) => {
    const name = sanitizePlainText(item?.title || item?.name || 'Item', 100);
    const quantity = Math.max(1, Number.parseInt(String(item?.quantity || item?.qty || 1), 10) || 1);
    const unitPrice = Number(item?.price || item?.priceNgn || item?.priceUsd || 0);
    const lineTotal = unitPrice * quantity;
    const optionText = [
      item?.size ? `Size: ${sanitizePlainText(item.size, 30)}` : '',
      item?.color ? `Color: ${sanitizePlainText(item.color, 40)}` : '',
      item?.variantId ? `Variant: ${sanitizePlainText(item.variantId, 60)}` : ''
    ].filter(Boolean).join(' | ');
    const image = sanitizePlainText(item?.image || '', 180);
    const value = [
      `${name} x${quantity}`,
      optionText,
      unitPrice ? `Unit: ${sanitizePlainText(currency || 'NGN', 12)} ${unitPrice.toLocaleString('en-US')}` : '',
      lineTotal ? `Line total: ${sanitizePlainText(currency || 'NGN', 12)} ${lineTotal.toLocaleString('en-US')}` : '',
      image ? `Image: ${image}` : ''
    ].filter(Boolean).join('\n');

    return [`Product ${index + 1}`, value];
  });
}

async function maybeSendAdminOrderPlacedEmail(order, triggerSource = 'order-created') {
  if (!order?.orderId || order?.metadata?.adminOrderPlacedEmailSentAt) return order;

  try {
    const orderId = sanitizePlainText(order.orderId, 80);
    const customerName = sanitizePlainText(order?.customer?.name || order?.customerName || 'Customer', 120);
    const customerEmail = normalizeEmail(order?.customerEmail || order?.customer?.email || '');
    const total = `${sanitizePlainText(order?.currency || 'NGN', 12)} ${Number(order?.total || 0).toLocaleString('en-US')}`;
    const placedAt = formatContactTimestamp(order?.createdAt || order?.orderDate || new Date().toISOString());
    const currency = sanitizePlainText(order?.currency || 'NGN', 12);
    const rows = [
      ['Order ID', orderId],
      ['Customer', customerName],
      ['Email', customerEmail],
      ['Total', total],
      ['Payment', `${sanitizePlainText(order?.paymentMethod || 'Not selected', 80)} | ${sanitizePlainText(order?.paymentStatus || 'pending', 40)}`],
      ['Status', sanitizePlainText(order?.orderStatus || order?.status || 'pending', 40)],
      ...buildOrderProductRows(order?.items, currency),
      ['Placed', placedAt],
      ['Source', triggerSource]
    ];
    const result = await sendAdminNotificationEmail({
      subject: `New order placed | ${orderId}`,
      title: 'New customer order',
      intro: `${customerName} has placed an order. Open the admin dashboard to review fulfilment and payment status.`,
      rows,
      textLines: rows.map(([label, value]) => `${label}: ${value}`),
      tags: ['orders', 'order-placed']
    });

    const updated = await updateOrderRecord(order.orderId, {
      metadata: {
        ...(order.metadata || {}),
        adminOrderPlacedEmailSentAt: new Date().toISOString(),
        adminOrderPlacedEmailTrigger: sanitizePlainText(triggerSource, 80),
        adminOrderPlacedEmailDeliveredTo: result.delivered,
        adminOrderPlacedEmailErrors: result.errors
      }
    });
    return updated || order;
  } catch (error) {
    console.error(`Admin order notification failed for ${order?.orderId || 'unknown-order'}:`, error);
    return order;
  }
}

async function sendAdminCustomerActivityEmail(user, activity, details = {}) {
  if (!user || String(user.role || '').trim().toLowerCase() === 'host') return;

  try {
    const customerName = sanitizePlainText(user?.name || 'Customer', 120);
    const customerEmail = normalizeEmail(user?.email || '');
    const rows = [
      ['Customer', customerName],
      ['Email', customerEmail],
      ['Activity', activity],
      ['When', formatContactTimestamp(new Date().toISOString())],
      ...Object.entries(details || {}).map(([key, value]) => [
        key.replace(/([a-z])([A-Z])/g, '$1 $2'),
        Array.isArray(value) ? value.join(', ') : String(value || '')
      ])
    ];

    await sendAdminNotificationEmail({
      subject: `Customer activity | ${customerName} ${activity}`,
      title: 'Customer account activity',
      intro: `${customerName} ${activity}.`,
      rows,
      textLines: rows.map(([label, value]) => `${label}: ${value}`),
      tags: ['customers', 'account-activity']
    });
  } catch (error) {
    console.error(`Admin customer activity notification failed for ${user?.email || 'unknown-user'}:`, error);
  }
}

function buildContactWhatsAppText(messageRecord) {
  return [
    'New Benzy Luxury contact message',
    `Name: ${messageRecord.name}`,
    `Email: ${messageRecord.email}`,
    messageRecord.phone ? `Phone: ${messageRecord.phone}` : '',
    `Subject: ${messageRecord.subject}`,
    '',
    messageRecord.message
  ]
    .filter(Boolean)
    .join('\n');
}

function buildContactManualWhatsAppUrl(messageRecord, contactInfo) {
  const supportPhone = normalizeWhatsAppPhone(contactInfo?.phone || CONTACT_INFO_DEFAULTS.phone);
  if (!supportPhone) return '';
  return `https://wa.me/${supportPhone}?text=${encodeURIComponent(buildContactWhatsAppText(messageRecord))}`;
}

function buildContactFollowUpWhatsAppUrl(messageRecord, contactInfo) {
  const supportPhone = normalizeWhatsAppPhone(contactInfo?.phone || CONTACT_INFO_DEFAULTS.phone);
  if (!supportPhone) return '';

  const subject = sanitizePlainText(messageRecord?.subject || 'my message', 120) || 'my message';
  const submittedBy = sanitizePlainText(messageRecord?.email || '', 120);
  const followUpText = [
    'Hello Benzy Luxury,',
    '',
    `I am following up on my message about "${subject}".`,
    submittedBy ? `Submitted under: ${submittedBy}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  return `https://wa.me/${supportPhone}?text=${encodeURIComponent(followUpText)}`;
}

function buildCustomerReplyWhatsAppUrl(messageRecord) {
  const customerPhone = normalizeWhatsAppPhone(messageRecord?.phone || '');
  if (!customerPhone) return '';

  const customerName = sanitizePlainText(messageRecord?.name || 'there', 80) || 'there';
  const subject = sanitizePlainText(messageRecord?.subject || 'your message', 120) || 'your message';
  const followUpText = [
    `Hi ${customerName},`,
    '',
    `Thanks for contacting Benzy Luxury about "${subject}".`,
    'We are following up on your message now.'
  ].join('\n');

  return `https://wa.me/${customerPhone}?text=${encodeURIComponent(followUpText)}`;
}

function buildContactNotificationEmail(messageRecord) {
  const safeMessageHtml = escapeHtml(messageRecord.message).replace(/\n/g, '<br>');
  const safeName = escapeHtml(messageRecord.name);
  const safeEmail = escapeHtml(messageRecord.email);
  const safePhone = escapeHtml(messageRecord.phone || 'Not provided');
  const safeSubject = escapeHtml(messageRecord.subject);
  const safeSubmittedAt = escapeHtml(formatContactTimestamp(messageRecord.createdAt));
  const replyLink = buildMailtoLink(messageRecord.email, `Re: ${messageRecord.subject || 'Benzy Luxury'}`);
  const customerWhatsAppUrl = buildCustomerReplyWhatsAppUrl(messageRecord);

  return {
    html: `
      <div style="margin:0;padding:32px 16px;background:#f6f0ea;font-family:Arial,sans-serif;color:#231711;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #eadfd3;">
          <div style="padding:28px 32px;background:#231711;color:#f6efe5;">
            <div style="font-size:12px;letter-spacing:0.26em;text-transform:uppercase;opacity:0.78;">Benzy Luxury</div>
            <h1 style="margin:12px 0 0;font-size:30px;line-height:1.2;">New contact message</h1>
          </div>
          <div style="padding:32px;">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">A new inquiry just came in through the Benzy Luxury contact form.</p>
            <div style="margin:0 0 24px;padding:18px 20px;border-radius:14px;background:#f8f1eb;border:1px solid #eadfd3;">
              <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7a5c43;">Message summary</div>
              <div style="margin-top:6px;font-size:16px;font-weight:600;">${safeSubmittedAt}</div>
              <div style="margin-top:14px;font-size:15px;line-height:1.8;color:#231711;">
                Name: ${safeName}<br>
                Email: ${safeEmail}<br>
                Phone: ${safePhone}<br>
                Subject: ${safeSubject}
              </div>
            </div>
            ${(replyLink || customerWhatsAppUrl) ? `
              <div style="margin:0 0 24px;">
                ${replyLink ? `<a href="${escapeHtml(replyLink)}" style="display:inline-block;margin:0 10px 10px 0;padding:12px 18px;border-radius:999px;background:#231711;color:#f6efe5;text-decoration:none;font-weight:700;">Reply by email</a>` : ''}
                ${customerWhatsAppUrl ? `<a href="${escapeHtml(customerWhatsAppUrl)}" style="display:inline-block;margin:0 10px 10px 0;padding:12px 18px;border-radius:999px;border:1px solid #d8c4b3;color:#231711;text-decoration:none;font-weight:700;">Open WhatsApp</a>` : ''}
              </div>
            ` : ''}
            <div style="padding:18px 20px;border-radius:14px;background:#fcf8f3;border:1px solid #eadfd3;font-size:15px;line-height:1.8;color:#231711;">
              ${safeMessageHtml}
            </div>
          </div>
        </div>
      </div>
    `,
      text: [
        'New Benzy Luxury contact message',
        '',
        `Submitted: ${formatContactTimestamp(messageRecord.createdAt)}`,
        `Name: ${messageRecord.name}`,
        `Email: ${messageRecord.email}`,
        `Phone: ${messageRecord.phone || 'Not provided'}`,
        `Subject: ${messageRecord.subject}`,
        replyLink ? `Reply by email: ${replyLink}` : '',
        customerWhatsAppUrl ? `Open WhatsApp: ${customerWhatsAppUrl}` : '',
        '',
        messageRecord.message
      ].filter(Boolean).join('\n')
    };
}

function buildContactAutoReplyEmail(messageRecord, contactInfo) {
  const greetingName = escapeHtml(messageRecord.name || 'there');
  const safeSubject = escapeHtml(messageRecord.subject);
  const safeSupportEmail = escapeHtml(contactInfo?.email || CONTACT_INFO_DEFAULTS.email);
  const safeSupportPhone = escapeHtml(contactInfo?.phone || CONTACT_INFO_DEFAULTS.phone);
  const safeSubmittedAt = escapeHtml(formatContactTimestamp(messageRecord.createdAt));
  const supportMailtoLink = buildMailtoLink(contactInfo?.email || CONTACT_INFO_DEFAULTS.email, `Re: ${messageRecord.subject || 'Benzy Luxury'}`);
  const supportWhatsAppUrl = buildContactFollowUpWhatsAppUrl(messageRecord, contactInfo);
  const shopUrl = buildPublicUrl('/Shop.html?cat=all');

  return {
    html: `
      <div style="margin:0;padding:32px 16px;background:#f6f0ea;font-family:Arial,sans-serif;color:#231711;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #eadfd3;">
          <div style="padding:28px 32px;background:#231711;color:#f6efe5;">
            <div style="font-size:12px;letter-spacing:0.26em;text-transform:uppercase;opacity:0.78;">Benzy Luxury</div>
            <h1 style="margin:12px 0 0;font-size:30px;line-height:1.2;">We received your message</h1>
          </div>
          <div style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hi ${greetingName},</p>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Thanks for reaching out to Benzy Luxury. Your message about <strong>${safeSubject}</strong> has been received and saved in our support inbox.</p>
            <div style="margin:0 0 24px;padding:18px 20px;border-radius:14px;background:#fcf8f3;border:1px solid #eadfd3;">
              <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7a5c43;">Your request</div>
              <p style="margin:10px 0 0;font-size:15px;line-height:1.7;color:#231711;">Subject: ${safeSubject}</p>
              <p style="margin:8px 0 0;font-size:15px;line-height:1.7;color:#231711;">Received: ${safeSubmittedAt}</p>
            </div>
            <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">If you need to follow up quickly, use any of the options below and our team will pick it up.</p>
            ${(supportMailtoLink || supportWhatsAppUrl || shopUrl) ? `
              <div style="margin:0 0 24px;">
                ${supportMailtoLink ? `<a href="${escapeHtml(supportMailtoLink)}" style="display:inline-block;margin:0 10px 10px 0;padding:12px 18px;border-radius:999px;background:#231711;color:#f6efe5;text-decoration:none;font-weight:700;">Reply by email</a>` : ''}
                ${supportWhatsAppUrl ? `<a href="${escapeHtml(supportWhatsAppUrl)}" style="display:inline-block;margin:0 10px 10px 0;padding:12px 18px;border-radius:999px;border:1px solid #d8c4b3;color:#231711;text-decoration:none;font-weight:700;">Message on WhatsApp</a>` : ''}
                ${shopUrl ? `<a href="${escapeHtml(shopUrl)}" style="display:inline-block;margin:0 10px 10px 0;padding:12px 18px;border-radius:999px;border:1px solid #d8c4b3;color:#231711;text-decoration:none;font-weight:700;">Visit the store</a>` : ''} 
              </div>
            ` : ''}
            <p style="margin:0 0 12px;font-size:16px;line-height:1.7;">You can also reach us directly at <a href="mailto:${safeSupportEmail}" style="color:#231711;font-weight:700;text-decoration:none;">${safeSupportEmail}</a> or on ${safeSupportPhone}.</p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#6b5a4d;">We will get back to you as soon as possible.</p>
          </div>
        </div>
      </div>
    `,
    text: [
      `Hi ${messageRecord.name || 'there'},`,
      '',
      `We received your Benzy Luxury message about "${messageRecord.subject}".`,
      `Received: ${formatContactTimestamp(messageRecord.createdAt)}`,
      `You can follow up via ${contactInfo?.email || CONTACT_INFO_DEFAULTS.email} or ${contactInfo?.phone || CONTACT_INFO_DEFAULTS.phone}.`,
      supportMailtoLink ? `Reply by email: ${supportMailtoLink}` : '',
      supportWhatsAppUrl ? `Message on WhatsApp: ${supportWhatsAppUrl}` : '',
      shopUrl ? `Visit the store: ${shopUrl}` : '',
      '',
      'We will get back to you as soon as possible.'
    ].filter(Boolean).join('\n')
  };
}

async function sendContactMessageNotifications(messageRecord, contactInfo) {
  const summary = {
    configured: isBrevoConfigured(),
    contactSynced: false,
    supportRecipients: buildContactSupportRecipients(contactInfo),
    supportDelivered: [],
    senderAcknowledged: false,
    errors: []
  };

  if (!summary.configured) {
    summary.errors.push('Brevo email service is not configured.');
    return summary;
  }

  try {
    await addSupportContact(messageRecord.email, {
      attributes: {
        ...buildBrevoContactAttributes({
          source: 'contact-form',
          signup_location: 'contact-page',
          customer_status: 'support'
        }),
        phone: messageRecord.phone,
        subject: messageRecord.subject
      },
      tags: ['support', 'contact-form']
    });
    summary.contactSynced = true;
  } catch (error) {
    summary.errors.push(`Brevo contact sync failed: ${error.message || 'Unknown error.'}`);
  }

  const supportEmailContent = buildContactNotificationEmail(messageRecord);
  for (const recipient of summary.supportRecipients) {
    try {
      await sendTransactionalEmail({
        toEmail: recipient,
        subject: `New contact message: ${messageRecord.subject}`,
        htmlContent: supportEmailContent.html,
        textContent: supportEmailContent.text,
        tags: ['support', 'contact-form', 'notification']
      });
      summary.supportDelivered.push(recipient);
    } catch (error) {
      summary.errors.push(`Support email failed for ${recipient}: ${error.message || 'Unknown error.'}`);
    }
  }

  const autoReplyContent = buildContactAutoReplyEmail(messageRecord, contactInfo);
  try {
    await sendTransactionalEmail({
      toEmail: messageRecord.email,
      toName: messageRecord.name,
      subject: 'We received your message | Benzy Luxury',
      htmlContent: autoReplyContent.html,
      textContent: autoReplyContent.text,
      tags: ['support', 'contact-form', 'auto-reply']
    });
    summary.senderAcknowledged = true;
  } catch (error) {
    summary.errors.push(`Auto-reply failed: ${error.message || 'Unknown error.'}`);
  }

  return summary;
}

async function sendContactWhatsAppNotification(messageRecord, contactInfo) {
  const customerPhone = normalizeWhatsAppPhone(messageRecord.phone || '');
  const manualUrl = buildContactManualWhatsAppUrl(messageRecord, contactInfo);
  const summary = {
    configured: isWatiConfigured(),
    templateConfigured: isWatiTemplateConfigured(),
    provider: isWatiConfigured() ? 'wati' : 'browser-link',
    deliveryMethod: manualUrl ? 'browser-link' : 'unavailable',
    ready: Boolean(manualUrl),
    sent: false,
    targetPhone: sanitizePlainText(customerPhone || messageRecord.phone || '', 40),
    channelPhone: sanitizePlainText(contactInfo?.phone || CONTACT_INFO_DEFAULTS.phone, 40),
    url: manualUrl,
    manualUrl,
    messageId: '',
    error: ''
  };

  if (!customerPhone) {
    summary.error = 'Customer phone number is missing for WhatsApp delivery.';
    return summary;
  }

  if (!summary.configured || !summary.templateConfigured) {
    if (summary.configured && !summary.templateConfigured) {
      summary.error = 'WATI template delivery is not fully configured.';
    }
    return summary;
  }

  try {
    const result = await sendWatiTemplateMessage({
      phone: customerPhone,
      broadcastName: `${messageRecord.subject || 'contact'} ${messageRecord.messageId || ''}`,
      parameters: []
    });

    summary.provider = 'wati';
    summary.deliveryMethod = 'wati-template';
    summary.ready = true;
    summary.sent = true;
    summary.messageId = result.messageId || '';
    return summary;
  } catch (error) {
    summary.provider = 'wati';
    summary.deliveryMethod = 'wati-template';
    summary.error = error?.message || 'WATI WhatsApp delivery failed.';
    return summary;
  }
}

function isHostUser(user) {
  if (!user) return false;
  const role = String(user.role || '').trim().toLowerCase();
  if (role === 'host') return true;
  const normalized = normalizeEmail(user.email);
  return ADMIN_EMAILS.includes(normalized);
}

async function requireHost(req, res) {
  const users = await readUsers();
  const current = users.find((u) => String(u.id) === String(req.user?.id)) || {};
  const effectiveUser = {
    ...current,
    id: current.id || req.user?.id,
    email: current.email || req.user?.email,
    role: current.role || req.user?.role,
    adminRole: normalizeAdminRoleValue(current.adminRole, current),
    isBanned: Boolean(current.isBanned)
  };
  if (!isHostUser(effectiveUser)) {
    res.status(403).json({ error: 'Host access required.' });
    return null;
  }
  return { users, current: effectiveUser };
}

function inferRoleByEmail(email) {
  const normalized = normalizeEmail(email);
  return ADMIN_EMAILS.includes(normalized) ? 'host' : 'resident';
}

function normalizeAdminRoleValue(role, user) {
  const isHost = (user?.role || inferRoleByEmail(user?.email)) === 'host';
  if (!isHost) return '';
  const normalized = String(role || '').trim().toLowerCase();
  const allowedRoles = ['super_admin', 'product_manager', 'order_manager', 'customer_support_admin'];
  return allowedRoles.includes(normalized) ? normalized : 'super_admin';
}

const DEFAULT_SETTINGS = {
  shippingFeeNgn: 3000,
  shipping: {
    defaultDomesticFeeNgn: 3000,
    lagosFeeNgn: 3000,
    otherStatesFeeNgn: 4500,
    internationalFeeNgn: 15000,
    freeShippingThresholdNgn: 150000,
    deliveryTimes: {
      lagos: '1-2 business days',
      otherStates: '3-5 business days',
      international: '5-10 business days'
    }
  },
  security: {
    adminSessionTimeoutMinutes: 30,
    activityLogsRetentionDays: 30,
    twoFactorEnabled: false
  }
};

function normalizeSettingsObject(settings) {
  const source = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  const defaultDomesticFeeNgn = Number(
    source?.shipping?.defaultDomesticFeeNgn
    ?? source?.shippingFeeNgn
    ?? DEFAULT_SETTINGS.shipping.defaultDomesticFeeNgn
  );
  const safeDefaultDomesticFeeNgn = Number.isFinite(defaultDomesticFeeNgn) && defaultDomesticFeeNgn >= 0
    ? defaultDomesticFeeNgn
    : DEFAULT_SETTINGS.shipping.defaultDomesticFeeNgn;

  const lagosFeeNgn = Number(source?.shipping?.lagosFeeNgn);
  const otherStatesFeeNgn = Number(source?.shipping?.otherStatesFeeNgn);
  const internationalFeeNgn = Number(source?.shipping?.internationalFeeNgn);
  const freeShippingThresholdNgn = Number(source?.shipping?.freeShippingThresholdNgn);
  const adminSessionTimeoutMinutes = Number(source?.security?.adminSessionTimeoutMinutes);
  const activityLogsRetentionDays = Number(source?.security?.activityLogsRetentionDays);

  return {
    shippingFeeNgn: safeDefaultDomesticFeeNgn,
    shipping: {
      defaultDomesticFeeNgn: safeDefaultDomesticFeeNgn,
      lagosFeeNgn: Number.isFinite(lagosFeeNgn) && lagosFeeNgn >= 0 ? lagosFeeNgn : DEFAULT_SETTINGS.shipping.lagosFeeNgn,
      otherStatesFeeNgn: Number.isFinite(otherStatesFeeNgn) && otherStatesFeeNgn >= 0 ? otherStatesFeeNgn : DEFAULT_SETTINGS.shipping.otherStatesFeeNgn,
      internationalFeeNgn: Number.isFinite(internationalFeeNgn) && internationalFeeNgn >= 0 ? internationalFeeNgn : DEFAULT_SETTINGS.shipping.internationalFeeNgn,
      freeShippingThresholdNgn: Number.isFinite(freeShippingThresholdNgn) && freeShippingThresholdNgn >= 0 ? freeShippingThresholdNgn : DEFAULT_SETTINGS.shipping.freeShippingThresholdNgn,
      deliveryTimes: {
        lagos: String(source?.shipping?.deliveryTimes?.lagos || DEFAULT_SETTINGS.shipping.deliveryTimes.lagos).trim(),
        otherStates: String(source?.shipping?.deliveryTimes?.otherStates || DEFAULT_SETTINGS.shipping.deliveryTimes.otherStates).trim(),
        international: String(source?.shipping?.deliveryTimes?.international || DEFAULT_SETTINGS.shipping.deliveryTimes.international).trim()
      }
    },
    security: {
      adminSessionTimeoutMinutes: Number.isFinite(adminSessionTimeoutMinutes) && adminSessionTimeoutMinutes > 0
        ? Math.round(adminSessionTimeoutMinutes)
        : DEFAULT_SETTINGS.security.adminSessionTimeoutMinutes,
      activityLogsRetentionDays: Number.isFinite(activityLogsRetentionDays) && activityLogsRetentionDays > 0
        ? Math.round(activityLogsRetentionDays)
        : DEFAULT_SETTINGS.security.activityLogsRetentionDays,
      twoFactorEnabled: Boolean(source?.security?.twoFactorEnabled)
    }
  };
}

function normalizeCountryCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return '';
  if (['NIGERIA', 'NGA', 'NG'].includes(normalized)) return 'NG';
  return normalized;
}

function resolveShippingQuote(settings, options = {}) {
  const normalizedSettings = normalizeSettingsObject(settings);
  const shipping = normalizedSettings.shipping || DEFAULT_SETTINGS.shipping;
  const subtotalNgn = Number(options?.subtotalNgn);
  const safeSubtotalNgn = Number.isFinite(subtotalNgn) && subtotalNgn > 0 ? subtotalNgn : 0;
  const countryCode = normalizeCountryCode(options?.country);
  const normalizedState = String(options?.state || '').trim().toLowerCase();
  const freeShippingThresholdNgn = Number(shipping.freeShippingThresholdNgn) || 0;

  let zone = 'domestic';
  let feeNgn = Number(shipping.defaultDomesticFeeNgn) || DEFAULT_SETTINGS.shipping.defaultDomesticFeeNgn;
  let deliveryTime = String(shipping.deliveryTimes?.otherStates || DEFAULT_SETTINGS.shipping.deliveryTimes.otherStates).trim();

  if (countryCode && countryCode !== 'NG') {
    zone = 'international';
    feeNgn = Number(shipping.internationalFeeNgn) || DEFAULT_SETTINGS.shipping.internationalFeeNgn;
    deliveryTime = String(shipping.deliveryTimes?.international || DEFAULT_SETTINGS.shipping.deliveryTimes.international).trim();
  } else if (normalizedState.includes('lagos')) {
    zone = 'lagos';
    feeNgn = Number(shipping.lagosFeeNgn) || DEFAULT_SETTINGS.shipping.lagosFeeNgn;
    deliveryTime = String(shipping.deliveryTimes?.lagos || DEFAULT_SETTINGS.shipping.deliveryTimes.lagos).trim();
  } else if (normalizedState) {
    zone = 'other_states';
    feeNgn = Number(shipping.otherStatesFeeNgn) || Number(shipping.defaultDomesticFeeNgn) || DEFAULT_SETTINGS.shipping.otherStatesFeeNgn;
    deliveryTime = String(shipping.deliveryTimes?.otherStates || DEFAULT_SETTINGS.shipping.deliveryTimes.otherStates).trim();
  }

  const isFree = freeShippingThresholdNgn > 0 && safeSubtotalNgn >= freeShippingThresholdNgn;

  return {
    zone,
    feeNgn: isFree ? 0 : Math.max(0, Number.isFinite(feeNgn) ? feeNgn : DEFAULT_SETTINGS.shipping.defaultDomesticFeeNgn),
    baseFeeNgn: Math.max(0, Number.isFinite(feeNgn) ? feeNgn : DEFAULT_SETTINGS.shipping.defaultDomesticFeeNgn),
    deliveryTime,
    isFree,
    freeShippingThresholdNgn,
    subtotalNgn: safeSubtotalNgn,
    countryCode: countryCode || 'NG',
    state: String(options?.state || '').trim()
  };
}

async function readSettings() {
  const collection = await getCollection('settings');
  const parsed = await collection.findOne({ _id: 'app' }, { projection: { _id: 0 } });
  const settings = normalizeSettingsObject(parsed);

  if (!parsed || JSON.stringify(settings) !== JSON.stringify(parsed || {})) {
    await writeSettings(settings);
  }

  return settings;
}

async function writeSettings(settings) {
  const nextSettings = normalizeSettingsObject(settings);
  const collection = await getCollection('settings');

  await collection.replaceOne(
    { _id: 'app' },
    { _id: 'app', ...nextSettings },
    { upsert: true }
  );
}

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function roundMoney(value) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Number(amount.toFixed(2));
}

function formatCurrencyList(currencies) {
  return (Array.isArray(currencies) ? currencies : [])
    .map((entry) => String(entry || '').trim().toUpperCase())
    .filter(Boolean)
    .join(', ');
}

function createMemoryRateLimiter({ windowMs, maxRequests, message, keyGenerator }) {
  const buckets = new Map();

  return function rateLimiter(req, res, next) {
    const now = Date.now();

    for (const [key, entry] of buckets.entries()) {
      if (!entry || entry.resetAt <= now) {
        buckets.delete(key);
      }
    }

    const key = typeof keyGenerator === 'function'
      ? String(keyGenerator(req) || 'anonymous')
      : String(req.ip || 'anonymous');
    const existing = buckets.get(key);

    if (!existing) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (existing.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        success: false,
        message
      });
      return;
    }

    existing.count += 1;
    buckets.set(key, existing);
    next();
  };
}

const newsletterRateLimiter = createMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 6,
  message: 'Too many subscribe attempts. Please wait a few minutes and try again.',
  keyGenerator: (req) => {
    const forwardedFor = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    const ipAddress = sanitizePlainText(req.ip || forwardedFor || 'anonymous', 80);
    const email = normalizeEmail(req?.body?.email || '');
    return `${ipAddress}:${email || 'anonymous'}`;
  }
});

const giveawayRateLimiter = createMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 4,
  message: 'Too many giveaway attempts. Please wait a few minutes and try again.',
  keyGenerator: (req) => {
    const forwardedFor = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    const ipAddress = sanitizePlainText(req.ip || forwardedFor || 'anonymous', 80);
    const email = normalizeEmail(req?.body?.email || '');
    return `${ipAddress}:${email || 'anonymous'}`;
  }
});

const vipRateLimiter = createMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 4,
  message: 'Too many VIP upgrade attempts. Please wait a few minutes and try again.',
  keyGenerator: (req) => {
    const forwardedFor = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    const ipAddress = sanitizePlainText(req.ip || forwardedFor || 'anonymous', 80);
    const authUser = getAuthenticatedUser(req);
    const email = normalizeEmail(authUser?.email || req?.body?.email || '');
    return `${ipAddress}:${email || 'anonymous'}`;
  }
});

const contactMessageRateLimiter = createMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 4,
  message: 'Too many contact attempts. Please wait a few minutes and try again.',
  keyGenerator: (req) => {
    const forwardedFor = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    const ipAddress = sanitizePlainText(req.ip || forwardedFor || 'anonymous', 80);
    const email = normalizeEmail(req?.body?.email || '');
    return `${ipAddress}:${email || 'anonymous'}`;
  }
});

/**
 * JSON-backed subscriber schema:
 * {
 *   email: string,
 *   discountCode: string,
 *   discountUsed: boolean,
 *   subscribedAt: ISODateString,
 *   source: "footer",
 *   discountUsedAt?: ISODateString | null,
 *   discountUsedOrderId?: string | null,
 *   marketingOptOut?: boolean,
 *   unsubscribedAt?: ISODateString | null
 * }
 */
function normalizeSubscriberRecord(raw) {
  const email = normalizeEmail(raw?.email);
  if (!email) return null;
  const unsubscribedAt = raw?.unsubscribedAt ? String(raw.unsubscribedAt).trim() : null;

  return {
    email,
    discountCode: String(raw?.discountCode || '').trim().toUpperCase(),
    discountUsed: Boolean(raw?.discountUsed),
    subscribedAt: String(raw?.subscribedAt || new Date().toISOString()).trim(),
    source: NEWSLETTER_SOURCE,
    discountUsedAt: raw?.discountUsedAt ? String(raw.discountUsedAt).trim() : null,
    discountUsedOrderId: raw?.discountUsedOrderId ? String(raw.discountUsedOrderId).trim() : null,
    marketingOptOut: Boolean(raw?.marketingOptOut || unsubscribedAt),
    unsubscribedAt
  };
}

async function readSubscribers() {
  const parsed = await readCollectionRecords('subscribers');
  let changed = false;
  const normalized = parsed
    .map((entry) => normalizeSubscriberRecord(entry))
    .filter(Boolean)
    .map((entry, index) => {
      if (JSON.stringify(entry) !== JSON.stringify(parsed[index])) changed = true;
      return entry;
    });

  if (normalized.length !== parsed.length) changed = true;
  if (changed) await writeSubscribers(normalized);
  return normalized;
}

async function writeSubscribers(subscribers) {
  const normalized = (Array.isArray(subscribers) ? subscribers : [])
    .map((entry) => normalizeSubscriberRecord(entry))
    .filter(Boolean);

  await replaceCollectionRecords(
    'subscribers',
    normalized,
    (entry, index) => normalizeEmail(entry?.email) || `subscriber-${index}`
  );
}

function generateUniqueDiscountCode(subscribers) {
  const existingCodes = new Set(
    (Array.isArray(subscribers) ? subscribers : [])
      .map((entry) => String(entry?.discountCode || '').trim().toUpperCase())
      .filter(Boolean)
  );

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const random = Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()
      .replace(/[0O1I]/g, 'X');
    const code = `BLX10-${random}`;
    if (!existingCodes.has(code)) return code;
  }

  return `BLX10-${Date.now().toString(36).slice(-6).toUpperCase()}`;
}

function findSubscriberByEmail(subscribers, email) {
  const normalized = normalizeEmail(email);
  return (Array.isArray(subscribers) ? subscribers : []).find((entry) => normalizeEmail(entry?.email) === normalized) || null;
}

function findSubscriberByCode(subscribers, code) {
  const normalized = String(code || '').trim().toUpperCase();
  return (Array.isArray(subscribers) ? subscribers : []).find((entry) => String(entry?.discountCode || '').trim().toUpperCase() === normalized) || null;
}

function createSubscriberUnsubscribeToken(subscriber) {
  const email = normalizeEmail(subscriber?.email);
  const discountCode = String(subscriber?.discountCode || '').trim().toUpperCase();
  return crypto
    .createHash('sha256')
    .update(`${email}:${discountCode}:${JWT_SECRET}`)
    .digest('hex')
    .slice(0, 32);
}

function buildUrlWithParams(pathname, params = {}) {
  const base = buildPublicUrl(pathname);
  if (!base) return '';

  try {
    const url = new URL(base);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  } catch {
    return base;
  }
}

function buildNewsletterUnsubscribeUrl(subscriber) {
  const email = normalizeEmail(subscriber?.email);
  if (!email) return '';
  return buildUrlWithParams('/api/newsletter/unsubscribe', {
    email,
    token: createSubscriberUnsubscribeToken(subscriber)
  });
}

function hasExistingOrdersForEmail(email, orders, currentOrderId = '') {
  const normalizedEmail = normalizeEmail(email);
  const ignoredOrderId = String(currentOrderId || '').trim().toUpperCase();
  return (Array.isArray(orders) ? orders : []).some((order) => {
    const orderEmail = normalizeEmail(order?.customerEmail);
    const orderId = String(order?.orderId || '').trim().toUpperCase();
    if (ignoredOrderId && orderId === ignoredOrderId) return false;
    return orderEmail === normalizedEmail;
  });
}

function validateNewsletterDiscount({ email, couponCode, subscribers, orders, currentOrderId = '' }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = String(couponCode || '').trim().toUpperCase();

  if (!normalizedCode) {
    return { valid: false, status: 400, message: 'Coupon code is required.' };
  }

  if (!isValidEmail(normalizedEmail)) {
    return { valid: false, status: 400, message: 'A valid email address is required to apply this coupon.' };
  }

  const subscriber = findSubscriberByCode(subscribers, normalizedCode);
  if (!subscriber) {
    return { valid: false, status: 404, message: 'Coupon code not found.' };
  }

  if (normalizeEmail(subscriber.email) !== normalizedEmail) {
    return { valid: false, status: 403, message: 'This coupon is linked to a different email address.' };
  }

  if (subscriber.discountUsed) {
    return { valid: false, status: 409, message: 'This coupon has already been used.' };
  }

  if (hasExistingOrdersForEmail(normalizedEmail, orders, currentOrderId)) {
    return { valid: false, status: 409, message: 'This coupon is valid for first orders only.' };
  }

  return {
    valid: true,
    status: 200,
    message: 'Coupon applied successfully.',
    couponCode: normalizedCode,
    subscriber,
    discountPercent: NEWSLETTER_DISCOUNT_PERCENT
  };
}

async function markDiscountCodeUsed(subscribers, email, orderId) {
  const normalizedEmail = normalizeEmail(email);
  const usedAt = new Date().toISOString();
  const nextSubscribers = (Array.isArray(subscribers) ? subscribers : []).map((entry) => {
    if (normalizeEmail(entry?.email) !== normalizedEmail) return entry;
    return {
      ...entry,
      discountUsed: true,
      discountUsedAt: usedAt,
      discountUsedOrderId: String(orderId || '').trim() || null
    };
  });

  await writeSubscribers(nextSubscribers);
  return findSubscriberByEmail(nextSubscribers, normalizedEmail);
}

async function markOrderDiscountIfNeeded(order) {
  if (!order?.discountCode) return;
  const subscribers = await readSubscribers();
  const matched = findSubscriberByCode(subscribers, order.discountCode);
  if (matched && !matched.discountUsed) {
    await markDiscountCodeUsed(subscribers, order.customerEmail, order.orderId);
  }
}

async function sendNewsletterDiscountEmail(subscriber) {
  if (!subscriber) return { queued: false };

  return sendWelcomeEmail(subscriber.email, subscriber.name || '', {
    discountCode: subscriber.discountCode,
    subscribedAt: subscriber.subscribedAt,
    unsubscribeUrl: buildNewsletterUnsubscribeUrl(subscriber),
    preferenceUrl: buildNewsletterUnsubscribeUrl(subscriber)
  });
}

function buildBrevoContactAttributes(input = {}) {
  const source = sanitizePlainText(input.source || '', 80);
  const signupLocation = sanitizePlainText(input.signup_location || input.signupLocation || '', 80);
  const customerStatus = sanitizePlainText(input.customer_status || input.customerStatus || '', 80);
  const vipStatus = sanitizePlainText(input.vip_status || input.vipStatus || '', 80);
  const campaignName = sanitizePlainText(input.campaign_name || input.campaignName || '', 80);
  const lastOrderDate = sanitizePlainText(input.last_order_date || input.lastOrderDate || '', 80);
  const parsedOrderCount = Number(input.order_count ?? input.orderCount);

  return {
    source,
    signup_location: signupLocation,
    customer_status: customerStatus,
    vip_status: vipStatus,
    campaign_name: campaignName,
    order_count: Number.isFinite(parsedOrderCount) ? Math.max(0, parsedOrderCount) : undefined,
    last_order_date: lastOrderDate
  };
}

function buildSubscriberResponse(subscriber) {
  if (!subscriber) return null;

  return {
    email: subscriber.email,
    discountCode: subscriber.discountCode,
    discountUsed: subscriber.discountUsed,
    subscribedAt: subscriber.subscribedAt,
    source: subscriber.source,
    marketingOptOut: subscriber.marketingOptOut === true,
    unsubscribedAt: subscriber.unsubscribedAt || null
  };
}

function getBrevoNewsletterErrorStatus(error) {
  if (!(error instanceof BrevoError)) return 502;
  if ([400, 429, 503].includes(error.statusCode)) return error.statusCode;
  if ([401, 403].includes(error.statusCode)) return 503;
  return 502;
}

function getBrevoNewsletterErrorMessage(error) {
  if (!(error instanceof BrevoError)) {
    return 'Unable to subscribe right now. Please try again.';
  }

  if (error.statusCode === 400) {
    return error.message || 'Enter a valid email address.';
  }

  if ([401, 403, 503].includes(error.statusCode)) {
    return 'Newsletter email service is not configured on the server yet.';
  }

  if (error.statusCode === 429) {
    return 'Brevo is rate limiting requests right now. Please try again shortly.';
  }

  return 'Unable to sync your email with Brevo right now. Please try again.';
}

function timingSafeTextEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (!leftBuffer.length || leftBuffer.length !== rightBuffer.length) return false;

  try {
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function getBrevoWebhookRequestSecret(req) {
  const authHeader = String(req?.headers?.authorization || '').trim();
  if (/^bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^bearer\s+/i, '').trim();
  }

  return String(req?.headers?.['x-brevo-webhook-secret'] || '').trim();
}

function isBrevoWebhookAuthorized(req) {
  const configuredSecret = getBrevoWebhookSecret();
  const providedSecret = getBrevoWebhookRequestSecret(req);
  if (!configuredSecret || !providedSecret) return false;
  return timingSafeTextEqual(configuredSecret, providedSecret);
}

function normalizeBrevoWebhookPayloads(body) {
  if (Array.isArray(body)) {
    return body.filter((entry) => entry && typeof entry === 'object');
  }

  if (body && typeof body === 'object') {
    return [body];
  }

  return [];
}

function getBrevoWebhookOccurredAt(payload = {}) {
  const epochCandidates = [payload.ts_epoch, payload.tsEventEpoch, payload.timestamp];
  for (const candidate of epochCandidates) {
    const numeric = Number(candidate);
    if (!Number.isFinite(numeric) || numeric <= 0) continue;
    const millis = numeric > 1e12 ? numeric : numeric * 1000;
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const secondCandidates = [payload.ts_event, payload.ts];
  for (const candidate of secondCandidates) {
    const numeric = Number(candidate);
    if (!Number.isFinite(numeric) || numeric <= 0) continue;
    const date = new Date(numeric * 1000);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const stringCandidates = [payload.date, payload.occurredAt, payload.createdAt];
  for (const candidate of stringCandidates) {
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return new Date().toISOString();
}

function normalizeBrevoWebhookTags(payload = {}) {
  if (Array.isArray(payload.tags)) {
    return payload.tags
      .map((tag) => sanitizePlainText(tag, 80))
      .filter(Boolean);
  }

  if (typeof payload.tag === 'string' && payload.tag.trim()) {
    try {
      const parsed = JSON.parse(payload.tag);
      if (Array.isArray(parsed)) {
        return parsed
          .map((tag) => sanitizePlainText(tag, 80))
          .filter(Boolean);
      }
    } catch {
      const singleTag = sanitizePlainText(payload.tag, 80);
      return singleTag ? [singleTag] : [];
    }
  }

  return [];
}

function buildBrevoWebhookRecord(payload = {}, req) {
  const event = sanitizePlainText(payload.event || payload.type || 'unknown', 80) || 'unknown';
  const email = normalizeEmail(payload.email || payload.recipient || '');
  const messageId = sanitizePlainText(payload['message-id'] || payload.messageId || '', 220);
  const occurredAt = getBrevoWebhookOccurredAt(payload);
  const receivedAt = new Date().toISOString();
  const payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload || {}))
    .digest('hex');

  return {
    id: `brevo-${payloadHash.slice(0, 24)}`,
    event,
    email,
    messageId,
    occurredAt,
    receivedAt,
    tags: normalizeBrevoWebhookTags(payload),
    sourceIp: String(req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '').split(',')[0].trim(),
    payload
  };
}

async function recordBrevoWebhookEvent(payload, req) {
  const record = buildBrevoWebhookRecord(payload, req);
  const collection = await getCollection('brevo_webhook_events');
  await collection.updateOne(
    { _id: record.id },
    { $set: { _id: record.id, ...record } },
    { upsert: true }
  );
  return record;
}

function deriveBrevoEmailLifecycleStatus(eventName) {
  const normalized = String(eventName || '').trim().toLowerCase();
  if (!normalized) return 'unknown';
  if (normalized === 'request') return 'queued';
  if (normalized === 'uniqueopened') return 'opened';
  if (normalized === 'hardbounce') return 'hardBounce';
  if (normalized === 'softbounce') return 'softBounce';
  return normalized;
}

async function applyBrevoWebhookToOrder(record) {
  if (!record?.messageId) return null;
  const orders = await readOrders();
  const matchedOrder = orders.find((entry) => {
    return String(entry?.metadata?.orderConfirmationMessageId || '').trim() === record.messageId;
  });
  if (!matchedOrder) return null;

  const nextMetadata = {
    ...(matchedOrder.metadata || {}),
    orderConfirmationDeliveryStatus: deriveBrevoEmailLifecycleStatus(record.event),
    orderConfirmationWebhookLastEvent: record.event,
    orderConfirmationWebhookLastEventAt: record.occurredAt,
    orderConfirmationWebhookReceivedAt: record.receivedAt,
    orderConfirmationWebhookEmail: record.email || matchedOrder.customerEmail || '',
    orderConfirmationWebhookTags: record.tags,
    orderConfirmationWebhookEvents: {
      ...((matchedOrder.metadata && matchedOrder.metadata.orderConfirmationWebhookEvents) || {}),
      [record.event]: record.occurredAt
    }
  };

  return updateOrderRecord(matchedOrder.orderId, {
    metadata: nextMetadata
  });
}

async function applyBrevoWebhookToWalletTopUp(record) {
  if (!record?.messageId) return null;
  const users = await readUsers();

  for (let userIndex = 0; userIndex < users.length; userIndex += 1) {
    const wallet = normalizeWallet(users[userIndex]?.wallet);
    const transactionIndex = wallet.transactions.findIndex((entry) => {
      return String(entry?.metadata?.walletTopUpEmailMessageId || '').trim() === record.messageId;
    });
    if (transactionIndex < 0) continue;

    const transaction = wallet.transactions[transactionIndex];
    wallet.transactions[transactionIndex] = normalizeWalletTransaction({
      ...transaction,
      metadata: {
        ...(transaction.metadata || {}),
        walletTopUpEmailDeliveryStatus: deriveBrevoEmailLifecycleStatus(record.event),
        walletTopUpEmailLastEvent: record.event,
        walletTopUpEmailLastEventAt: record.occurredAt,
        walletTopUpEmailWebhookReceivedAt: record.receivedAt,
        walletTopUpEmailWebhookTags: record.tags,
        walletTopUpEmailWebhookEvents: {
          ...((transaction.metadata && transaction.metadata.walletTopUpEmailWebhookEvents) || {}),
          [record.event]: record.occurredAt
        }
      }
    });
    wallet.updatedAt = new Date().toISOString();
    users[userIndex].wallet = wallet;
    await writeUsers(users);

    return {
      userId: users[userIndex]?.id || '',
      email: users[userIndex]?.email || '',
      reference: wallet.transactions[transactionIndex]?.reference || ''
    };
  }

  return null;
}

async function maybeSendOrderConfirmationEmail(order, triggerSource = 'payment-confirmed') {
  if (!order || String(order.paymentStatus || '').trim().toLowerCase() !== 'paid') {
    return order;
  }

  if (!isValidEmail(order.customerEmail)) {
    return order;
  }

  let updatedOrder = order;
  const users = await readUsers();
  const customerUser = users.find((user) => normalizeEmail(user?.email) === normalizeEmail(order.customerEmail));
  const notifications = normalizeNotificationSettings(customerUser?.notifications);

  if (!order?.metadata?.customerBrevoSyncedAt) {
    try {
      const paidOrders = await readOrders();
      const orderCount = paidOrders.filter((entry) => {
        return normalizeEmail(entry?.customerEmail) === normalizeEmail(order.customerEmail)
          && String(entry?.paymentStatus || '').trim().toLowerCase() === 'paid';
      }).length || 1;

      await addCustomerContact(order.customerEmail, {
        attributes: buildBrevoContactAttributes({
          source: 'checkout',
          signup_location: triggerSource,
          customer_status: 'customer',
          campaign_name: 'successful-checkout',
          order_count: orderCount,
          last_order_date: order?.paidAt || order?.createdAt || new Date().toISOString()
        }),
        tags: ['customer', 'paid-order']
      });
      updatedOrder = await updateOrderRecord(order.orderId, {
        metadata: {
          ...(order.metadata || {}),
          customerBrevoSyncedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error(`Brevo customer sync failed for ${order?.orderId || 'unknown-order'}:`, error);
    }
  }

  if (!updatedOrder?.metadata?.orderConfirmationEmailSentAt && notifications.email) {
    try {
      const result = await sendOrderConfirmation(updatedOrder.customerEmail, updatedOrder);
      updatedOrder = await updateOrderRecord(updatedOrder.orderId, {
        metadata: {
          ...(updatedOrder.metadata || {}),
          orderConfirmationEmailSentAt: new Date().toISOString(),
          orderConfirmationEmailTrigger: sanitizePlainText(triggerSource, 80) || 'payment-confirmed',
          orderConfirmationMessageId: String(result?.messageId || '').trim() || null
        }
      });
    } catch (error) {
      console.error(`Order confirmation email failed for ${order?.orderId || 'unknown-order'}:`, error);
    }
  }

  if (!updatedOrder?.metadata?.orderConfirmationSmsSentAt && notifications.sms) {
    updatedOrder = await maybeSendOrderSmsNotification(updatedOrder, triggerSource);
  }

  return updatedOrder;
}

function buildOrderSmsText(order) {
  const orderId = sanitizePlainText(order?.orderId || '', 80);
  const total = Number(order?.total || 0);
  const currency = sanitizePlainText(order?.currency || 'NGN', 12);
  const status = sanitizePlainText(order?.orderStatus || order?.status || 'placed', 40);
  return `Benzy Luxury: your order ${orderId} is ${status}. Total ${currency} ${total.toLocaleString('en-US')}. We will update you as it moves.`;
}

async function maybeSendOrderSmsNotification(order, triggerSource = 'payment-confirmed') {
  const phone = normalizeWhatsAppPhone(order?.customerPhone || order?.customer?.phone || '');
  if (!phone || !isWatiConfigured()) {
    return order;
  }

  try {
    const result = await sendWatiSessionMessage({
      phone,
      messageText: buildOrderSmsText(order),
      localMessageId: `${sanitizePlainText(order?.orderId || 'order', 80)}-${Date.now()}`
    });
    return await updateOrderRecord(order.orderId, {
      metadata: {
        ...(order.metadata || {}),
        orderConfirmationSmsSentAt: new Date().toISOString(),
        orderConfirmationSmsTrigger: sanitizePlainText(triggerSource, 80) || 'payment-confirmed',
        orderConfirmationSmsProvider: 'wati',
        orderConfirmationSmsMessageId: String(result?.messageId || '').trim() || null
      }
    });
  } catch (error) {
    console.error(`Order confirmation SMS/WhatsApp failed for ${order?.orderId || 'unknown-order'}:`, error);
    return order;
  }
}

async function maybeSendWalletTopUpEmail(users, userIndex, reference, triggerSource = 'wallet-topup-verified') {
  if (!Array.isArray(users) || userIndex < 0) {
    return {
      wallet: normalizeWallet(users?.[userIndex]?.wallet),
      transaction: null
    };
  }

  const currentUser = users[userIndex];
  const wallet = normalizeWallet(currentUser?.wallet);
  const transactionIndex = getWalletTransactionIndex(wallet, reference);
  if (transactionIndex < 0) {
    return { wallet, transaction: null };
  }

  let transaction = wallet.transactions[transactionIndex];
  if (!transaction
    || transaction.status !== 'successful'
    || transaction.type !== 'credit'
    || transaction.category !== 'topup'
    || !isValidEmail(currentUser?.email)) {
    return { wallet, transaction };
  }

  const safeTriggerSource = sanitizePlainText(triggerSource, 80) || 'wallet-topup-verified';
  let changed = false;

  if (!transaction?.metadata?.walletTopUpBrevoSyncedAt) {
    try {
      await addWalletTopUpContact(currentUser.email, {
        attributes: buildBrevoContactAttributes({
          source: 'wallet',
          signup_location: safeTriggerSource,
          customer_status: 'customer',
          campaign_name: 'wallet-top-up'
        }),
        tags: ['wallet-topup', 'customer']
      });
      transaction = normalizeWalletTransaction({
        ...transaction,
        metadata: {
          ...(transaction.metadata || {}),
          walletTopUpBrevoSyncedAt: new Date().toISOString(),
          walletTopUpBrevoSyncSource: safeTriggerSource
        }
      });
      wallet.transactions[transactionIndex] = transaction;
      changed = true;
    } catch (error) {
      console.error(`Brevo wallet top-up sync failed for ${currentUser?.email || 'unknown-user'}:`, error);
    }
  }

  if (!transaction?.metadata?.walletTopUpEmailSentAt) {
    try {
      const result = await sendWalletTopUpReceiptEmail(currentUser.email, currentUser.name, {
        amount: Math.abs(Number(transaction.amount || 0)),
        balance: wallet.balance,
        currency: transaction.currency || wallet.currency || WALLET_CURRENCY,
        reference: transaction.reference,
        paymentMethod: transaction.paymentMethod || 'Paystack',
        completedAt: transaction.completedAt || transaction.updatedAt || new Date().toISOString()
      });
      transaction = normalizeWalletTransaction({
        ...transaction,
        metadata: {
          ...(transaction.metadata || {}),
          walletTopUpEmailSentAt: new Date().toISOString(),
          walletTopUpEmailTrigger: safeTriggerSource,
          walletTopUpEmailMessageId: String(result?.messageId || '').trim() || null
        }
      });
      wallet.transactions[transactionIndex] = transaction;
      changed = true;
    } catch (error) {
      console.error(`Wallet top-up receipt email failed for ${currentUser?.email || 'unknown-user'}:`, error);
    }
  }

  if (changed) {
    wallet.updatedAt = new Date().toISOString();
    users[userIndex].wallet = wallet;
    await writeUsers(users);
  }

  const normalizedWallet = normalizeWallet(users[userIndex].wallet);
  return {
    wallet: normalizedWallet,
    transaction: normalizedWallet.transactions[getWalletTransactionIndex(normalizedWallet, reference)] || null
  };
}

function normalizeAddressItem(raw) {
  const typeRaw = String(raw?.type || 'shipping').trim().toLowerCase();
  const type = typeRaw === 'billing' ? 'billing' : 'shipping';
  const line1 = String(raw?.line1 || '').trim();
  const city = String(raw?.city || '').trim();
  const state = String(raw?.state || '').trim();
  const country = String(raw?.country || '').trim();
  const phone = String(raw?.phone || '').trim();
  const isDefault = Boolean(raw?.isDefault);

  if (line1.length < 5) throw new Error('Address line is too short.');
  if (city.length < 2 || state.length < 2 || country.length < 2) {
    throw new Error('City, state, and country must be at least 2 characters.');
  }
  if (phone.replace(/\D/g, '').length < 7) throw new Error('Enter a valid phone number.');

  return { type, line1, city, state, country, phone, isDefault };
}

function normalizeAddressList(input) {
  const list = Array.isArray(input) ? input : [];
  const normalized = list.map((item) => normalizeAddressItem(item));
  if (!normalized.length) return [];
  const byType = {
    shipping: normalized.filter((item) => item.type === 'shipping'),
    billing: normalized.filter((item) => item.type === 'billing')
  };

  function normalizeTypeDefaults(items) {
    if (!items.length) return [];
    const firstDefaultIndex = items.findIndex((item) => item.isDefault);
    const safeDefaultIndex = firstDefaultIndex >= 0 ? firstDefaultIndex : 0;
    return items.map((item, idx) => ({ ...item, isDefault: idx === safeDefaultIndex }));
  }

  return [...normalizeTypeDefaults(byType.shipping), ...normalizeTypeDefaults(byType.billing)];
}

function normalizeWalletTransaction(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const type = String(source.type || (Number(source.amount || 0) < 0 ? 'debit' : 'credit')).trim().toLowerCase() === 'debit'
    ? 'debit'
    : 'credit';
  const absoluteAmount = Math.abs(roundMoney(source.amount ?? source.absoluteAmount ?? source.value ?? 0));
  const amount = type === 'debit' ? -absoluteAmount : absoluteAmount;
  const statusRaw = String(source.status || (absoluteAmount > 0 ? 'successful' : 'pending')).trim().toLowerCase();
  const status = ['pending', 'successful', 'failed', 'reversed'].includes(statusRaw) ? statusRaw : 'pending';
  const reference = String(source.reference || source.paymentReference || source.transactionId || '').trim();
  const createdAt = String(source.createdAt || source.date || new Date().toISOString()).trim();
  const updatedAt = String(source.updatedAt || createdAt).trim();
  const completedAt = source.completedAt
    ? String(source.completedAt).trim()
    : (status === 'successful' ? String(source.paidAt || updatedAt).trim() : null);
  return {
    id: String(source.id || reference || `${type}-${createdAt}`).trim(),
    reference,
    type,
    category: String(source.category || source.source || (type === 'credit' ? 'topup' : 'order_payment')).trim().toLowerCase(),
    amount,
    currency: String(source.currency || WALLET_CURRENCY).trim().toUpperCase(),
    status,
    provider: normalizePaymentProvider(source.provider || source.paymentProvider || (type === 'credit' ? 'paystack' : 'wallet')) || (type === 'credit' ? 'paystack' : 'wallet'),
    paymentMethod: String(source.paymentMethod || (type === 'credit' ? 'Paystack' : 'Wallet')).trim(),
    note: String(source.note || source.description || '').trim(),
    orderId: String(source.orderId || '').trim(),
    createdAt,
    updatedAt,
    completedAt: completedAt || null,
    metadata: source.metadata && typeof source.metadata === 'object' ? source.metadata : {}
  };
}

function normalizeWallet(wallet) {
  const source = wallet && typeof wallet === 'object' ? wallet : {};
  const sourceTransactions = Array.isArray(source.transactions)
    ? source.transactions
    : (Array.isArray(source.tx) ? source.tx : []);
  const transactions = sourceTransactions
    .map((entry) => normalizeWalletTransaction(entry))
    .filter(Boolean)
    .sort((a, b) => {
      const left = new Date(a.completedAt || a.updatedAt || a.createdAt || 0).getTime();
      const right = new Date(b.completedAt || b.updatedAt || b.createdAt || 0).getTime();
      return right - left;
    });
  const storedBalance = Number(source.balance);
  const computedBalance = roundMoney(
    transactions
      .filter((entry) => entry.status === 'successful')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  );
  const balance = Number.isFinite(storedBalance) ? roundMoney(storedBalance) : computedBalance;
  return {
    currency: WALLET_CURRENCY,
    balance,
    transactions,
    updatedAt: String(source.updatedAt || source.modifiedAt || '').trim() || null
  };
}

async function readUsers() {
  const parsed = await readCollectionRecords('users');
  let changed = false;
  const normalized = parsed.map((user) => {
    const role = user?.role === 'host' || user?.role === 'resident' ? user.role : inferRoleByEmail(user?.email);
    const addresses = Array.isArray(user?.addresses) ? user.addresses : [];
    const wallet = normalizeWallet(user?.wallet);
    const adminRole = normalizeAdminRoleValue(user?.adminRole, { ...user, role });
    const isBanned = Boolean(user?.isBanned);
    const banReason = isBanned ? String(user?.banReason || '').trim() : '';
    const notifications = normalizeNotificationSettings(user?.notifications);
    if (role !== user?.role) changed = true;
    if (!Array.isArray(user?.addresses)) changed = true;
    if (JSON.stringify(wallet) !== JSON.stringify(user?.wallet || {})) changed = true;
    if (adminRole !== (user?.adminRole || '')) changed = true;
    if (isBanned !== Boolean(user?.isBanned)) changed = true;
    if (banReason !== String(user?.banReason || '')) changed = true;
    if (JSON.stringify(notifications) !== JSON.stringify(user?.notifications || {})) changed = true;
    return { ...user, role, adminRole, isBanned, banReason, addresses, wallet, notifications };
  });

  if (changed) await writeUsers(normalized);
  return normalized;
}

async function writeUsers(users) {
  const normalized = (Array.isArray(users) ? users : []).map((user) => {
    const role = user?.role === 'host' || user?.role === 'resident' ? user.role : inferRoleByEmail(user?.email);
    const addresses = Array.isArray(user?.addresses) ? user.addresses : [];
    const wallet = normalizeWallet(user?.wallet);
    const adminRole = normalizeAdminRoleValue(user?.adminRole, { ...user, role });
    const isBanned = Boolean(user?.isBanned);
    const banReason = isBanned ? String(user?.banReason || '').trim() : '';
    const notifications = normalizeNotificationSettings(user?.notifications);
    return { ...user, role, adminRole, isBanned, banReason, addresses, wallet, notifications };
  });

  await replaceCollectionRecords(
    'users',
    normalized,
    (user, index) => user?.id ?? normalizeEmail(user?.email) ?? `user-${index}`
  );
}

function findUserIndexById(users, userId) {
  return (Array.isArray(users) ? users : []).findIndex((user) => String(user?.id) === String(userId));
}

function getWalletTransactionIndex(wallet, reference) {
  const safeReference = String(reference || '').trim();
  if (!safeReference) return -1;
  const transactions = Array.isArray(wallet?.transactions) ? wallet.transactions : [];
  return transactions.findIndex((entry) => String(entry?.reference || '').trim() === safeReference);
}

function createWalletTransaction(details) {
  return normalizeWalletTransaction({
    ...details,
    createdAt: details?.createdAt || new Date().toISOString(),
    updatedAt: details?.updatedAt || details?.createdAt || new Date().toISOString()
  });
}

function toPublicUser(user) {
  const wallet = normalizeWallet(user?.wallet);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: String(user.phone || ''),
    role: user.role === 'host' ? 'host' : 'resident',
    adminRole: normalizeAdminRoleValue(user?.adminRole, user),
    isBanned: Boolean(user?.isBanned),
    notifications: normalizeNotificationSettings(user?.notifications),
    walletBalance: wallet.balance,
    walletCurrency: wallet.currency
  };
}

function signToken(user) {
  return jwt.sign({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === 'host' ? 'host' : 'resident',
    adminRole: normalizeAdminRoleValue(user?.adminRole, user)
  }, JWT_SECRET, {
    expiresIn: '7d'
  });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Unauthorized.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

function getAuthenticatedUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ============ CART API ============

app.use('/api', createCartRouter());
app.use('/api/admin', createAdminRouter({
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
  writeSettings,
  writeUsers
}));

function normalizeProductSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeProductPayload(payload, existing = {}) {
  const name = sanitizePlainText(payload?.name || existing.name || '', 140);
  if (!name) throw httpError(400, 'Product name is required.');

  const productId = sanitizePlainText(payload?.productId || existing.productId || crypto.randomUUID(), 80);
  const categoryName = sanitizePlainText(payload?.categoryName || payload?.category || existing.categoryName || 'Collection', 80);
  const categoryId = normalizeProductSlug(payload?.categoryId || categoryName) || 'collection';
  const price = Number(payload?.price ?? existing.price ?? 0);
  const stockQuantity = Number(payload?.stockQuantity ?? existing.stockQuantity ?? 0);
  const images = Array.isArray(payload?.images)
    ? payload.images.map((image) => sanitizePlainText(image, 260)).filter(Boolean)
    : Array.isArray(existing.images) ? existing.images : [];
  const image = sanitizePlainText(payload?.image || images[0] || existing.image || '', 260);

  return {
    productId,
    normalizedName: name.toLowerCase().replace(/\s+/g, ' ').trim(),
    name,
    slug: normalizeProductSlug(payload?.slug || existing.slug || name),
    categoryId,
    categoryName,
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    currency: sanitizePlainText(payload?.currency || existing.currency || 'NGN', 12),
    image,
    images: images.length ? images : image ? [image] : [],
    stockQuantity: Number.isFinite(stockQuantity) && stockQuantity >= 0 ? Math.round(stockQuantity) : 0,
    isActive: payload?.isActive === undefined ? existing.isActive !== false : Boolean(payload.isActive),
    variants: Array.isArray(payload?.variants) ? payload.variants : Array.isArray(existing.variants) ? existing.variants : [],
    metadata: {
      ...(existing.metadata || {}),
      ...(payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
      updatedFrom: 'api'
    }
  };
}

function serializeProduct(product) {
  const source = typeof product?.toObject === 'function' ? product.toObject() : product;
  if (!source) return null;
  const { _id, __v, ...rest } = source;
  return {
    ...rest,
    id: String(_id || rest.productId || ''),
    productId: String(rest.productId || _id || ''),
    slug: rest.slug || normalizeProductSlug(rest.name || rest.productId)
  };
}

app.get('/api/products', asyncHandler(async (req, res) => {
  const category = String(req.query?.category || '').trim().toLowerCase();
  const search = String(req.query?.q || '').trim();
  const filter = { isActive: true };
  if (category && category !== 'all') filter.categoryId = category;
  if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const products = await Product.find(filter).sort({ categoryName: 1, name: 1 }).lean();
  res.json({ success: true, products: products.map(serializeProduct) });
}));

app.get('/api/products/:slug', asyncHandler(async (req, res) => {
  const key = String(req.params.slug || '').trim();
  const product = await Product.findOne({
    isActive: true,
    $or: [{ slug: key }, { productId: key }]
  }).lean();

  if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
  res.json({ success: true, product: serializeProduct(product) });
}));

app.get('/api/admin/products', authMiddleware, asyncHandler(async (req, res) => {
  const ctx = await requireHost(req, res);
  if (!ctx) return;
  const products = await Product.find({}).sort({ updatedAt: -1, name: 1 }).lean();
  res.json({ success: true, products: products.map(serializeProduct) });
}));

app.post('/api/admin/products', authMiddleware, asyncHandler(async (req, res) => {
  const ctx = await requireHost(req, res);
  if (!ctx) return;
  const normalized = normalizeProductPayload(req.body || {});
  const product = await Product.create(normalized);
  res.status(201).json({ success: true, product: serializeProduct(product) });
}));

app.patch('/api/admin/products/:productId', authMiddleware, asyncHandler(async (req, res) => {
  const ctx = await requireHost(req, res);
  if (!ctx) return;
  const existing = await Product.findOne({ productId: String(req.params.productId || '').trim() });
  if (!existing) return res.status(404).json({ success: false, message: 'Product not found.' });
  const normalized = normalizeProductPayload(req.body || {}, existing.toObject());
  Object.assign(existing, normalized);
  await existing.save();
  res.json({ success: true, product: serializeProduct(existing) });
}));

app.delete('/api/admin/products/:productId', authMiddleware, asyncHandler(async (req, res) => {
  const ctx = await requireHost(req, res);
  if (!ctx) return;
  const product = await Product.findOneAndUpdate(
    { productId: String(req.params.productId || '').trim() },
    { $set: { isActive: false } },
    { new: true }
  );
  if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
  res.json({ success: true, product: serializeProduct(product) });
}));

const GEO_CACHE_TTL = 24 * 60 * 60 * 1000;
let countryStatesCache = null;
let countryStatesFetchedAt = 0;
const CSC_API_KEY = process.env.CSC_API_KEY || "";
const CSC_BASE_URL = process.env.CSC_BASE_URL || "https://api.countrystatecity.in/v1";
const CSC_CACHE_TTL = 24 * 60 * 60 * 1000;
let cscCountriesCache = null;
let cscCountriesFetchedAt = 0;
const cscStatesCache = new Map();

const CSC_KNOWN_COUNTRIES = {
  "united states": "US",
  "united kingdom": "GB",
  nigeria: "NG"
};

const STATE_ALIASES = {
  nigeria: {
    fct: "federal capital territory",
    abuja: "federal capital territory"
  }
};

const LOCAL_CITY_FALLBACKS = {
  nigeria: {
    "federal capital territory": ["Abuja", "Gwagwalada", "Kuje", "Kwali", "Bwari"],
    lagos: ["Lagos", "Ikeja", "Ikorodu", "Lekki", "Epe", "Badagry"],
    oyo: ["Ibadan", "Ogbomosho", "Oyo", "Iseyin", "Saki"],
    rivers: ["Port Harcourt", "Obio-Akpor", "Bonny", "Eleme"],
    kano: ["Kano", "Wudil", "Gaya", "Bichi"],
    kaduna: ["Kaduna", "Zaria", "Kafanchan"],
    ogun: ["Abeokuta", "Sagamu", "Ijebu Ode", "Ilaro"],
    anambra: ["Awka", "Onitsha", "Nnewi"],
    delta: ["Asaba", "Warri", "Sapele"],
    edo: ["Benin City", "Auchi", "Ekpoma"]
  },
  "united states": {
    california: ["Los Angeles", "San Diego", "San Jose", "San Francisco", "Sacramento"],
    texas: ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth"],
    "new york": ["New York City", "Buffalo", "Rochester", "Albany", "Syracuse"],
    florida: ["Miami", "Orlando", "Tampa", "Jacksonville", "Tallahassee"],
    illinois: ["Chicago", "Aurora", "Naperville", "Springfield", "Peoria"],
    georgia: ["Atlanta", "Augusta", "Savannah", "Athens", "Macon"],
    washington: ["Seattle", "Spokane", "Tacoma", "Vancouver", "Olympia"]
  },
  "united kingdom": {
    england: ["London", "Manchester", "Birmingham", "Liverpool", "Leeds", "Bristol"],
    scotland: ["Edinburgh", "Glasgow", "Aberdeen", "Dundee"],
    wales: ["Cardiff", "Swansea", "Newport"],
    "northern ireland": ["Belfast", "Derry", "Lisburn"]
  }
};

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { method = 'GET', headers = {}, body } = options;
    const parsed = new URL(url);
    const requestOptions = {
      method,
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      headers
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, json });
        } catch (error) {
          reject(new Error('Invalid JSON response from geo provider.'));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function getCountryStates() {
  const now = Date.now();
  if (countryStatesCache && (now - countryStatesFetchedAt) < GEO_CACHE_TTL) {
    return countryStatesCache;
  }

  const response = await fetchJson('https://countriesnow.space/api/v0.1/countries/states');
  if (!response?.json?.data) {
    throw new Error('Geo provider returned invalid data.');
  }

  countryStatesCache = response.json.data;
  countryStatesFetchedAt = now;
  return countryStatesCache;
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

async function fetchCscJson(path) {
  if (!CSC_API_KEY) {
    throw new Error("CSC_API_KEY is not configured.");
  }
  const response = await fetchJson(`${CSC_BASE_URL}${path}`, {
    method: "GET",
    headers: { "X-CSCAPI-KEY": CSC_API_KEY }
  });
  if (!response || response.status < 200 || response.status >= 300) {
    throw new Error("CSC provider request failed.");
  }
  return response.json;
}

async function getCscCountries() {
  if (!CSC_API_KEY) return null;
  const now = Date.now();
  if (cscCountriesCache && (now - cscCountriesFetchedAt) < CSC_CACHE_TTL) {
    return cscCountriesCache;
  }
  const data = await fetchCscJson("/countries");
  if (!Array.isArray(data)) return null;
  cscCountriesCache = data;
  cscCountriesFetchedAt = now;
  return cscCountriesCache;
}

async function getCscCountryIso2(country) {
  const normalized = normalizeKey(country);
  if (!normalized) return "";
  if (CSC_KNOWN_COUNTRIES[normalized]) return CSC_KNOWN_COUNTRIES[normalized];
  const countries = await getCscCountries();
  if (!Array.isArray(countries)) return "";
  const match = countries.find((item) => normalizeKey(item?.name) === normalized);
  return String(match?.iso2 || "").trim();
}

async function getCscStates(countryIso2) {
  if (!CSC_API_KEY || !countryIso2) return null;
  const now = Date.now();
  const cached = cscStatesCache.get(countryIso2);
  if (cached && (now - cached.fetchedAt) < CSC_CACHE_TTL) {
    return cached.data;
  }
  const data = await fetchCscJson(`/countries/${countryIso2}/states`);
  if (!Array.isArray(data)) return null;
  cscStatesCache.set(countryIso2, { data, fetchedAt: now });
  return data;
}

async function getCscStateIso2(countryIso2, state, countryName) {
  const states = await getCscStates(countryIso2);
  if (!Array.isArray(states)) return "";
  const normalized = normalizeKey(state);
  const aliasMap = STATE_ALIASES[normalizeKey(countryName)] || {};
  const resolved = aliasMap[normalized] || normalized;
  const match = states.find((item) => normalizeKey(item?.name) === resolved);
  return String(match?.iso2 || "").trim();
}

async function fetchCitiesFromCsc(country, state) {
  if (!CSC_API_KEY) return [];
  const countryIso2 = await getCscCountryIso2(country);
  if (!countryIso2) return [];
  const stateIso2 = await getCscStateIso2(countryIso2, state, country);
  if (!stateIso2) return [];
  const data = await fetchCscJson(`/countries/${countryIso2}/states/${stateIso2}/cities`);
  if (!Array.isArray(data)) return [];
  return data.map((item) => String(item?.name || "").trim()).filter(Boolean);
}

async function fetchCitiesFromCountriesNow(country, state) {
  const payload = JSON.stringify({ country, state });
  const response = await fetchJson("https://countriesnow.space/api/v0.1/countries/state/cities", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload)
    },
    body: payload
  });
  const cities = Array.isArray(response?.json?.data) ? response.json.data : [];
  return cities.filter(Boolean);
}

function getLocalCityFallback(country, state) {
  const countryKey = normalizeKey(country);
  const stateKey = normalizeKey(state);
  const countryMap = LOCAL_CITY_FALLBACKS[countryKey];
  if (!countryMap) return [];
  const aliasMap = STATE_ALIASES[countryKey] || {};
  const resolvedStateKey = aliasMap[stateKey] || stateKey;
  const byState = countryMap[resolvedStateKey];
  if (Array.isArray(byState) && byState.length) return byState;
  const all = Object.values(countryMap).flat().filter(Boolean);
  return Array.from(new Set(all));
}

async function getCitiesWithFallback(country, state) {
  try {
    const cscCities = await fetchCitiesFromCsc(country, state);
    if (cscCities.length) return { cities: cscCities, source: "csc" };
  } catch {
    // ignore and fall through
  }

  try {
    const countriesNowCities = await fetchCitiesFromCountriesNow(country, state);
    if (countriesNowCities.length) return { cities: countriesNowCities, source: "countriesnow" };
  } catch {
    // ignore and fall through
  }

  const localCities = getLocalCityFallback(country, state);
  if (localCities.length) return { cities: localCities, source: "local" };

  return { cities: [], source: "empty" };
}

// Orders are created from real checkout/admin activity only.
const ORDER_SEED = [];
const DEMO_ORDER_IDS = new Set(['BLX-12345', 'BLX-12346', 'BLX-12347']);

function cloneSeedOrders() {
  return JSON.parse(JSON.stringify(ORDER_SEED));
}

function isDemoOrderRecord(order) {
  return DEMO_ORDER_IDS.has(String(order?.orderId || order?.id || '').trim().toUpperCase());
}

function normalizeOrderStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (['pending', 'pending verification', 'pending_verification', 'awaiting_confirmation'].includes(value)) return 'pending';
  if (value === 'placed') return 'placed';
  if (value === 'confirmed') return 'confirmed';
  if (['processing', 'shipped', 'delivered', 'cancelled', 'failed'].includes(value)) return value;
  return 'pending';
}

function canCancelOrderStatus(status) {
  return ['pending', 'placed', 'confirmed'].includes(normalizeOrderStatus(status));
}

function normalizePaymentMethod(method) {
  const value = String(method || '').trim().toLowerCase();
  if (['card', 'card payment'].includes(value)) return 'card';
  if (['apple pay', 'apple_pay', 'applepay'].includes(value)) return 'apple_pay';
  if (value === 'paystack') return 'paystack';
  if (['bank', 'bank transfer', 'bank_transfer'].includes(value)) return 'bank_transfer';
  if (value === 'wallet') return 'wallet';
  if (value === 'flutterwave') return 'flutterwave';
  return 'unknown';
}

function formatPaymentMethodLabel(method, fallback) {
  const normalized = normalizePaymentMethod(method || fallback);
  const labels = {
    apple_pay: 'Apple Pay',
    card: 'Card Payment',
    paystack: 'Paystack',
    bank_transfer: 'Bank Transfer',
    wallet: 'Wallet',
    flutterwave: 'Flutterwave'
  };
  if (labels[normalized]) return labels[normalized];
  const raw = String(method || fallback || 'Not selected').trim();
  return raw || 'Not selected';
}

function normalizePaymentProvider(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (['paystack', 'flutterwave', 'wallet', 'manual'].includes(raw)) return raw;
  const method = normalizePaymentMethod(value);
  if (method === 'apple_pay' || method === 'card' || method === 'paystack') return 'paystack';
  if (method === 'bank_transfer') return 'manual';
  if (method === 'wallet') return 'wallet';
  if (method === 'flutterwave') return 'flutterwave';
  return '';
}

function normalizeStoredPaymentMethod(method, provider) {
  const paymentProvider = normalizePaymentProvider(provider || method);
  const normalizedMethod = normalizePaymentMethod(method);
  if (normalizedMethod === 'apple_pay') return 'apple_pay';
  if (normalizedMethod === 'card') return 'card';
  if (normalizedMethod === 'paystack' || paymentProvider === 'paystack') return 'paystack';
  if (normalizedMethod === 'bank_transfer') return 'bank_transfer';
  if (normalizedMethod === 'wallet') return 'wallet';
  if (normalizedMethod === 'flutterwave') return 'flutterwave';
  const raw = String(method || '').trim().toLowerCase();
  return raw || 'unknown';
}

function normalizePaymentStatus(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (['paid', 'success', 'successful'].includes(raw)) return 'paid';
  if (['failed', 'error', 'abandoned'].includes(raw)) return 'failed';
  if (['pending', 'pending verification', 'pending_verification', 'manual review', 'manual_review', 'awaiting_confirmation', 'processing'].includes(raw)) {
    return 'pending';
  }
  return 'pending';
}

function normalizeTransferProof(proof) {
  const candidate = proof && typeof proof === 'object' ? proof : null;
  const dataUrl = String(candidate?.dataUrl || candidate?.content || candidate?.receipt || '').trim();
  if (!dataUrl) return null;
  return {
    fileName: String(candidate?.fileName || candidate?.name || 'transfer-proof').trim(),
    contentType: String(candidate?.contentType || candidate?.type || '').trim(),
    dataUrl,
    uploadedAt: String(candidate?.uploadedAt || new Date().toISOString()).trim()
  };
}

function normalizeCustomerDetails(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    name: String(source.name || source.fullName || '').trim(),
    email: normalizeEmail(source.email || ''),
    phone: String(source.phone || '').trim(),
    address: String(source.address || source.line1 || source.shippingAddress || '').trim(),
    city: String(source.city || '').trim(),
    state: String(source.state || '').trim(),
    postalCode: String(source.postalCode || source.zip || '').trim(),
    country: String(source.country || 'Nigeria').trim()
  };
}

function buildShippingAddressText(customer) {
  return [
    customer?.address,
    customer?.city,
    customer?.state,
    customer?.postalCode,
    customer?.country
  ].filter(Boolean).join(', ');
}

function addDaysISO(dateString, days) {
  let base = dateString ? new Date(dateString) : new Date();
  if (Number.isNaN(base.getTime())) {
    base = new Date();
  }
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function generateOrderId() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `BLX-${stamp}-${rand}`;
}

function buildTracking(status, orderDate) {
  const normalized = normalizeOrderStatus(status);
  const steps = ['placed', 'confirmed', 'processing', 'shipped', 'delivered'];
  const statusToStep = {
    placed: 'placed',
    confirmed: 'confirmed',
    processing: 'processing',
    shipped: 'shipped',
    delivered: 'delivered'
  };
  const activeStep = statusToStep[normalized] || 'placed';
  const activeIndex = Math.max(0, steps.indexOf(activeStep));
  const date = orderDate || new Date().toISOString().slice(0, 10);
  return steps.reduce((acc, step, idx) => {
    acc[step] = { date: idx <= activeIndex ? date : null, completed: idx <= activeIndex };
    return acc;
  }, {});
}

function normalizeOrderRecord(order) {
  try {
    return buildOrderFromPayload(order || {});
  } catch {
    return null;
  }
}

async function readOrders() {
  const parsed = await readCollectionRecords('orders');
  return parsed
    .map((order) => normalizeOrderRecord(order))
    .filter((order) => !isDemoOrderRecord(order))
    .filter(Boolean);
}

async function writeOrders(orders) {
  const normalized = (Array.isArray(orders) ? orders : [])
    .map((order) => normalizeOrderRecord(order))
    .filter((order) => !isDemoOrderRecord(order))
    .filter(Boolean);

  await replaceCollectionRecords(
    'orders',
    normalized,
    (order, index) => String(order?.orderId || `order-${index}`).trim()
  );
}

async function getOrderRecordByOrderId(orderId) {
  const safeOrderId = String(orderId || '').trim();
  if (!safeOrderId) return null;
  if (DEMO_ORDER_IDS.has(safeOrderId.toUpperCase())) return null;
  const collection = await getCollection('orders');
  const found = await collection.findOne({
    $or: [{ _id: safeOrderId }, { orderId: safeOrderId }]
  }, { projection: { _id: 0 } });
  const normalized = normalizeOrderRecord(found);
  return normalized && !isDemoOrderRecord(normalized) ? normalized : null;
}

async function getOrderRecordByPaymentReference(reference) {
  const safeReference = String(reference || '').trim();
  if (!safeReference) return null;
  const collection = await getCollection('orders');
  const found = await collection.findOne(
    { paymentReference: safeReference },
    { projection: { _id: 0 } }
  );
  const normalized = normalizeOrderRecord(found);
  return normalized && !isDemoOrderRecord(normalized) ? normalized : null;
}

async function insertOrderRecord(order) {
  const normalized = normalizeOrderRecord(order);
  if (!normalized) throw httpError(400, 'Invalid order payload.');
  const collection = await getCollection('orders');
  await collection.insertOne({ _id: normalized.orderId, ...normalized });
  return normalized;
}

async function updateOrderRecord(orderId, updates) {
  const safeOrderId = String(orderId || '').trim();
  if (!safeOrderId) throw httpError(400, 'Order ID is required.');
  const collection = await getCollection('orders');
  const nextUpdates = {
    ...(updates && typeof updates === 'object' ? updates : {}),
    updatedAt: new Date().toISOString()
  };
  await collection.updateOne(
    { $or: [{ _id: safeOrderId }, { orderId: safeOrderId }] },
    { $set: nextUpdates }
  );
  return getOrderRecordByOrderId(safeOrderId);
}

function createPaymentReference(prefix = 'BLX') {
  const safePrefix = String(prefix || 'BLX').trim().toUpperCase() || 'BLX';
  const stamp = Date.now().toString();
  const random = Math.floor(Math.random() * 900000) + 100000;
  return `${safePrefix}-${stamp.slice(-8)}-${random}`;
}

function buildPublicPageUrl(req, pageName, params) {
  const configuredBaseUrl = getPaystackCallbackBaseUrl();
  const configuredBase = isPlaceholderPublicBaseUrl(configuredBaseUrl) ? '' : configuredBaseUrl;
  const protocol = isHttpsRequest(req) ? 'https' : req.protocol;
  const base = configuredBase || `${protocol}://${req.get('host')}`;
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const url = new URL(String(pageName || '').replace(/^\/+/, ''), normalizedBase);
  const entries = params && typeof params === 'object' ? Object.entries(params) : [];
  entries.forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function sendHttpsJsonRequest(options, body) {
  return new Promise((resolve, reject) => {
    const request = https.request(options, (apiRes) => {
      let responseBody = '';
      apiRes.on('data', (chunk) => { responseBody += chunk; });
      apiRes.on('end', () => {
        try {
          const parsed = responseBody ? JSON.parse(responseBody) : {};
          resolve({ statusCode: apiRes.statusCode || 500, data: parsed });
        } catch (error) {
          reject(httpError(502, 'Unable to parse payment provider response.'));
        }
      });
    });

    request.on('error', (error) => {
      reject(httpError(502, error.message || 'Unable to reach payment provider.'));
    });

    if (body) {
      request.write(JSON.stringify(body));
    }

    request.end();
  });
}

function getFirstFiniteNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return NaN;
}

async function prepareCheckoutOrderDraft(req, payload, requestedMethod, options = {}) {
  const authUser = getAuthenticatedUser(req);
  const authenticatedEmail = normalizeEmail(authUser?.email || '');
  if (!authenticatedEmail) {
    throw httpError(401, 'Log in to continue checkout.');
  }

  const users = await readUsers();
  const currentUser = users.find((user) => String(user.id) === String(authUser?.id)) || null;
  const customer = normalizeCustomerDetails(payload?.customer || payload?.delivery || {});
  customer.email = normalizeEmail(payload?.customerEmail || payload?.email || customer.email || authenticatedEmail);

  if (customer.email !== authenticatedEmail) {
    throw httpError(403, 'Checkout email must match the logged-in account.');
  }

  if (!customer.name) customer.name = String(currentUser?.name || '').trim();
  if (!customer.phone) customer.phone = String(payload?.phone || currentUser?.phone || '').trim();

  if (!customer.name) throw httpError(400, 'Customer name is required.');
  if (!customer.phone) throw httpError(400, 'Customer phone number is required.');
  if (!customer.address || !customer.city || !customer.state) {
    throw httpError(400, 'A saved delivery address is required to continue checkout.');
  }

  let validatedServerCart = null;
  try {
    validatedServerCart = await validateCheckoutCartForUser({
      id: authUser?.id,
      email: authenticatedEmail
    });
  } catch (error) {
    throw httpError(error?.statusCode || error?.status || 400, error?.message || 'Unable to validate your cart.');
  }

  const items = normalizeOrderItems(validatedServerCart.items || []);
  if (!items.length) throw httpError(400, 'Your cart is empty.');

  const paymentMethodCode = normalizePaymentMethod(requestedMethod || payload?.paymentMethod);
  const allowedPaymentMethods = (Array.isArray(options.allowedPaymentMethods) && options.allowedPaymentMethods.length
    ? options.allowedPaymentMethods
    : ['card', 'paystack'])
    .map((entry) => normalizePaymentMethod(entry))
    .filter((entry) => entry !== 'unknown');
  if (!allowedPaymentMethods.includes(paymentMethodCode)) {
    if (paymentMethodCode === 'wallet') throw httpError(400, 'Wallet payments are not live yet.');
    if (paymentMethodCode === 'flutterwave') throw httpError(400, 'Flutterwave is not live yet.');
    throw httpError(400, 'Unsupported payment method.');
  }

  const itemsSubtotal = roundMoney(
    items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0)
  );
  const subtotal = roundMoney(Number(validatedServerCart.summary?.subtotal || 0) || itemsSubtotal);
  if (!subtotal || subtotal <= 0) throw httpError(400, 'Subtotal must be greater than zero.');

  const shipping = roundMoney(validatedServerCart.summary?.shippingFee || 0);
  const orders = await readOrders();
  const subscribers = await readSubscribers();
  const cartCoupon = validatedServerCart.summary?.appliedCoupon || null;
  const discountCode = String(
    cartCoupon?.code
    || payload?.discountCode
    || payload?.couponCode
    || ''
  ).trim().toUpperCase();
  let discountAmount = roundMoney(validatedServerCart.summary?.discount || 0);
  let discountPercent = cartCoupon?.discountType === 'percent'
    ? Number(cartCoupon?.discountValue || 0)
    : 0;
  let couponValidation = null;

  if (cartCoupon?.code) {
    couponValidation = { valid: true, source: 'server-cart' };
  } else if (discountCode) {
    couponValidation = validateNewsletterDiscount({
      email: authenticatedEmail,
      couponCode: discountCode,
      subscribers,
      orders
    });

    if (!couponValidation.valid) {
      throw httpError(couponValidation.status, couponValidation.message);
    }

    discountPercent = couponValidation.discountPercent;
    discountAmount = roundMoney(subtotal * NEWSLETTER_DISCOUNT_RATIO);
  }

  const discountedSubtotal = roundMoney(Math.max(0, subtotal - discountAmount));
  const tax = roundMoney(discountedSubtotal * ORDER_TAX_RATE);
  const total = roundMoney(discountedSubtotal + tax + shipping);
  const requestCountryCode = getRequestCountryCode(req, customer.country);
  const detectedCheckoutCurrency = getDetectedCheckoutCurrencyForCountryCode(requestCountryCode);
  const displayCurrency = normalizeCurrencyCode(
    payload?.selectedDisplayCurrency
    || payload?.displayCurrency
    || payload?.metadata?.selectedDisplayCurrency
    || payload?.metadata?.selectedCurrency
    || payload?.currency
    || 'NGN',
    'NGN'
  );
  const exchangeRates = await getExchangeRates();
  let checkoutPricing = null;
  try {
    checkoutPricing = buildCheckoutPricingFromNgn({
      subtotalNgn: subtotal,
      discountNgn: discountAmount,
      discountedSubtotalNgn: discountedSubtotal,
      taxNgn: tax,
      shippingNgn: shipping,
      totalNgn: total
    }, {
      exchangeRates,
      displayCurrency,
      checkoutCurrency: payload?.checkoutCurrency,
      settlementCurrency: payload?.settlementCurrency,
      currency: payload?.currency,
      paymentMethodCode,
      fallbackCurrency: detectedCheckoutCurrency
    });
  } catch (error) {
    throw httpError(409, error?.message || 'Unable to resolve checkout currency.');
  }

  const chargeTotalSubunit = checkoutPricing.chargeTotalSubunit;
  if (chargeTotalSubunit <= 0) {
    throw httpError(400, 'Checkout total must be greater than zero.');
  }

  return {
    authUser,
    authenticatedEmail,
    currentUser,
    customer,
    cartId: String(validatedServerCart?._id || validatedServerCart?.id || '').trim(),
    items,
    paymentMethodCode,
    subtotal,
    discountAmount,
    discountPercent,
    discountCode,
    discountedSubtotal,
    tax,
    shipping,
    total,
    displayCurrency: checkoutPricing.displayCurrency,
    requestedCheckoutCurrency: checkoutPricing.requestedCheckoutCurrency,
    chargeCurrency: checkoutPricing.chargeCurrency,
    chargeCurrencyForced: checkoutPricing.chargeCurrencyForced,
    chargeCurrencyMessage: checkoutPricing.chargeCurrencyMessage,
    chargeSubtotal: checkoutPricing.chargeSubtotal,
    chargeDiscount: checkoutPricing.chargeDiscount,
    chargeDiscountedSubtotal: checkoutPricing.chargeDiscountedSubtotal,
    chargeTax: checkoutPricing.chargeTax,
    chargeShipping: checkoutPricing.chargeShipping,
    chargeTotal: checkoutPricing.chargeTotal,
    chargeTotalSubunit,
    totalNgn: checkoutPricing.convertedTotals.totalNgn,
    totalUsd: checkoutPricing.convertedTotals.totalUsd,
    convertedTotals: checkoutPricing.convertedTotals,
    detectedCheckoutCurrency,
    requestCountryCode,
    subscribers,
    couponValidation
  };
}

async function initializeMongoSeedData() {
  if (!(await collectionHasDocuments('users'))) {
    const seedUsers = readJsonSeed(USERS_FILE, []);
    if (Array.isArray(seedUsers) && seedUsers.length) {
      await writeUsers(seedUsers);
    }
  }

  if (!(await collectionHasDocuments('subscribers'))) {
    const seedSubscribers = readJsonSeed(SUBSCRIBERS_FILE, []);
    if (Array.isArray(seedSubscribers) && seedSubscribers.length) {
      await writeSubscribers(seedSubscribers);
    }
  }

  if (!(await collectionHasDocuments('orders'))) {
    const orderSeed = readJsonSeed(ORDERS_FILE, null);
    if (Array.isArray(orderSeed) && orderSeed.length) {
      await writeOrders(orderSeed);
    } else if (ORDER_SEED.length) {
      await writeOrders(cloneSeedOrders());
    }
  }

  if (!(await collectionHasDocuments('settings'))) {
    const seedSettings = readJsonSeed(SETTINGS_FILE, null);
    const safeSettings = seedSettings && typeof seedSettings === 'object' && !Array.isArray(seedSettings)
      ? seedSettings
      : DEFAULT_SETTINGS;
    await writeSettings(safeSettings);
  }
}

function normalizeOrderItems(items) {
  const list = Array.isArray(items) ? items : [];
  return list.map((item) => {
    const name = String(item?.name || item?.title || 'Item').trim();
    const quantity = Math.max(1, parseInt(String(item?.quantity || item?.qty || 1), 10));
    const priceNgn = roundMoney(
      item?.unitPriceNGN
      ?? item?.unitPriceNgn
      ?? item?.basePriceNGN
      ?? item?.basePriceNgn
      ?? item?.priceNgn
      ?? item?.price
      ?? (item?.priceUsd != null ? usdToNgn(item?.priceUsd) : 0)
    );
    const priceUsd = roundMoney(item?.priceUsd ?? ngnToUsd(priceNgn));
    return {
      productId: String(item?.productId || item?.id || '').trim(),
      name,
      title: String(item?.title || name).trim(),
      quantity,
      qty: quantity,
      price: priceNgn,
      unitPriceNGN: priceNgn,
      unitPriceNgn: priceNgn,
      priceNgn,
      priceUsd,
      image: String(item?.image || '').trim(),
      color: String(item?.color || '').trim(),
      size: String(item?.size || '').trim()
    };
  });
}

function buildOrderFromPayload(payload) {
  const customer = normalizeCustomerDetails(payload?.customer || payload?.delivery || payload);
  const customerEmail = normalizeEmail(payload?.customerEmail || payload?.email || customer.email);
  if (!customerEmail) throw new Error('Customer email is required.');
  customer.email = customerEmail;
  if (!customer.address && payload?.shippingAddress) {
    customer.address = String(payload.shippingAddress).trim();
  }

  const orderId = String(payload?.orderId || payload?.id || generateOrderId()).trim();
  const createdAt = String(
    payload?.createdAt
    || (payload?.orderDate ? new Date(String(payload.orderDate)).toISOString() : new Date().toISOString())
  ).trim();
  const orderStatus = normalizeOrderStatus(payload?.orderStatus || payload?.status || 'placed');
  const orderDate = String(payload?.orderDate || payload?.date || createdAt.slice(0, 10)).trim();
  const estimatedDelivery = String(payload?.estimatedDelivery || addDaysISO(orderDate, 7)).trim();
  const items = normalizeOrderItems(payload?.items || []);
  const totalFromItems = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  const total = roundMoney(payload?.total ?? payload?.totalUsd ?? totalFromItems);
  const subtotal = roundMoney(payload?.subtotal ?? payload?.subtotalUsd ?? totalFromItems);
  const discountAmount = roundMoney(payload?.discount ?? payload?.discountAmount ?? payload?.discountUsd ?? 0);
  const discountedSubtotal = roundMoney(payload?.discountedSubtotal ?? Math.max(0, subtotal - discountAmount));
  const discountPercent = Number(payload?.discountPercent ?? 0);
  const tax = roundMoney(payload?.tax ?? payload?.taxUsd ?? 0);
  const shipping = roundMoney(payload?.shipping ?? payload?.shippingUsd ?? 0);
  const shippingAddress = buildShippingAddressText(customer) || String(payload?.shippingAddress || payload?.address || 'Delivery details pending').trim();
  const currency = String(payload?.currency || payload?.currencyCode || 'NGN').trim().toUpperCase();
  const requestedPaymentMethodCode = normalizePaymentMethod(payload?.paymentMethodCode || payload?.paymentMethod);
  const paymentProvider = normalizePaymentProvider(payload?.paymentProvider || requestedPaymentMethodCode);
  const paymentMethodCode = normalizeStoredPaymentMethod(payload?.paymentMethodCode || payload?.paymentMethod, paymentProvider);
  const paymentMethod = formatPaymentMethodLabel(payload?.paymentMethod || payload?.paymentMethodCode, paymentMethodCode);
  const paymentStatus = normalizePaymentStatus(payload?.paymentStatus);
  const paymentReference = String(payload?.paymentReference || payload?.transactionId || '').trim();
  const discountCode = String(payload?.discountCode || payload?.couponCode || '').trim().toUpperCase();
  const tracking = payload?.tracking && typeof payload.tracking === 'object'
    ? payload.tracking
    : buildTracking(orderStatus, orderDate);
  const paidAt = payload?.paidAt
    ? String(payload.paidAt).trim()
    : (paymentStatus === 'paid' ? new Date().toISOString() : null);
  const transferProof = normalizeTransferProof(payload?.transferProof || payload?.receipt);
  const totalNaira = roundMoney(payload?.totalNaira ?? payload?.totalNgn ?? (currency === 'NGN' ? total : 0));

  return {
    orderId,
    customerId: payload?.customerId || '',
    customerEmail,
    customer,
    customerName: customer.name,
    customerPhone: customer.phone,
    status: orderStatus,
    orderStatus,
    orderDate,
    createdAt,
    updatedAt: String(payload?.updatedAt || createdAt).trim(),
    paidAt,
    estimatedDelivery,
    items,
    subtotal,
    discountedSubtotal,
    discount: discountAmount,
    discountAmount,
    discountPercent,
    tax,
    shipping,
    total,
    shippingAddress,
    tracking,
    paymentMethod,
    paymentMethodCode,
    paymentProvider,
    paymentStatus,
    transactionId: paymentReference,
    paymentReference,
    currency,
    settlementCurrency: String(payload?.settlementCurrency || currency).trim().toUpperCase(),
    totalNaira,
    transferProof,
    discountCode,
    metadata: payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
  };
}

// ============ ORDER TRACKING API ============

// Track order by order ID
app.get('/api/track-order/:orderId', asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const orders = await readOrders();
  const order = orders.find(o => String(o.orderId || '').toUpperCase() === String(orderId || '').toUpperCase());

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found. Please check your order number and try again.'
    });
  }
  
  res.json({
    success: true,
    order: {
      orderId: order.orderId,
      status: order.status,
      orderStatus: order.orderStatus || order.status,
      paymentStatus: order.paymentStatus || 'pending',
      paymentReference: order.paymentReference || order.transactionId || '',
      paidAt: order.paidAt || null,
      orderDate: order.orderDate,
      createdAt: order.createdAt || null,
      estimatedDelivery: order.estimatedDelivery,
      items: order.items,
      subtotal: order.subtotal,
      discount: order.discount ?? order.discountAmount ?? 0,
      tax: order.tax,
      shipping: order.shipping,
      total: order.total,
      shippingAddress: order.shippingAddress,
      tracking: order.tracking,
      currency: order.currency || 'NGN',
      paymentMethod: order.paymentMethod || 'Not selected',
      customer: order.customer || null
    }
  });
}));

// Alternative: Track order with email
app.post('/api/track-order', asyncHandler(async (req, res) => {
  const { orderId, email } = req.body;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'Order ID is required'
    });
  }

  const orders = await readOrders();
  let order = orders.find(o => String(o.orderId || '').toUpperCase() === String(orderId || '').toUpperCase());

  // If email provided, verify it matches
  if (email && order && order.customerEmail.toLowerCase() !== email.toLowerCase()) {
    return res.status(404).json({
      success: false,
      message: 'Order not found. Email does not match our records.'
    });
  }
  
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found. Please check your order number and try again.'
    });
  }
  
  res.json({
    success: true,
    order: {
      orderId: order.orderId,
      status: order.status,
      orderStatus: order.orderStatus || order.status,
      paymentStatus: order.paymentStatus || 'pending',
      paymentReference: order.paymentReference || order.transactionId || '',
      paidAt: order.paidAt || null,
      orderDate: order.orderDate,
      createdAt: order.createdAt || null,
      estimatedDelivery: order.estimatedDelivery,
      items: order.items,
      subtotal: order.subtotal,
      discount: order.discount ?? order.discountAmount ?? 0,
      tax: order.tax,
      shipping: order.shipping,
      total: order.total,
      shippingAddress: order.shippingAddress,
      tracking: order.tracking,
      currency: order.currency || 'NGN',
      paymentMethod: order.paymentMethod || 'Not selected',
      customer: order.customer || null
    }
  });
}));

// ============ ORDERS API ============

app.post('/api/newsletter/subscribe', newsletterRateLimiter, asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email || '');
  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Enter a valid email address.'
    });
  }

  const subscribers = await readSubscribers();
  const existingSubscriber = findSubscriberByEmail(subscribers, email);

  if (existingSubscriber) {
    const reactivatedSubscriber = existingSubscriber.marketingOptOut
      ? {
          ...existingSubscriber,
          marketingOptOut: false,
          unsubscribedAt: null,
          resubscribedAt: new Date().toISOString()
        }
      : existingSubscriber;

    try {
      await addNewsletterContact(reactivatedSubscriber.email, {
        attributes: buildBrevoContactAttributes({
          source: 'newsletter',
          signup_location: NEWSLETTER_SOURCE,
          customer_status: 'subscriber',
          campaign_name: 'footer-newsletter'
        }),
        tags: ['newsletter', NEWSLETTER_SOURCE]
      });
    } catch (error) {
      console.error(`Brevo contact resync failed for existing subscriber ${email}:`, error);
    }

    if (reactivatedSubscriber !== existingSubscriber) {
      const nextSubscribers = subscribers.map((entry) => (
        normalizeEmail(entry?.email) === email ? reactivatedSubscriber : entry
      ));
      await writeSubscribers(nextSubscribers);
    }

    return res.status(200).json({
      success: true,
      alreadySubscribed: true,
      message: reactivatedSubscriber.marketingOptOut
        ? 'Your subscription exists, but marketing emails are currently paused.'
        : `You are already subscribed. Your 10% off code is: ${reactivatedSubscriber.discountCode}`,
      discountCode: reactivatedSubscriber.discountCode,
      subscriber: buildSubscriberResponse(reactivatedSubscriber)
    });
  }

  try {
    await addNewsletterContact(email, {
      attributes: buildBrevoContactAttributes({
        source: 'newsletter',
        signup_location: NEWSLETTER_SOURCE,
        customer_status: 'subscriber',
        campaign_name: 'footer-newsletter'
      }),
      tags: ['newsletter', NEWSLETTER_SOURCE]
    });
  } catch (error) {
    console.error(`Brevo contact sync failed for newsletter signup ${email}:`, error);
    return res.status(getBrevoNewsletterErrorStatus(error)).json({
      success: false,
      message: getBrevoNewsletterErrorMessage(error)
    });
  }

  const subscriber = {
    email,
    discountCode: generateUniqueDiscountCode(subscribers),
    discountUsed: false,
    subscribedAt: new Date().toISOString(),
    source: NEWSLETTER_SOURCE,
    discountUsedAt: null,
    discountUsedOrderId: null,
    marketingOptOut: false,
    unsubscribedAt: null
  };

  subscribers.push(subscriber);
  await writeSubscribers(subscribers);

  let message = `Thanks for subscribing! Your 10% off code is: ${subscriber.discountCode}`;
  let welcomeEmailSent = false;

  try {
    const emailResult = await sendNewsletterDiscountEmail(subscriber);
    welcomeEmailSent = Boolean(emailResult?.messageId);
  } catch (emailError) {
    console.error(`Brevo welcome email failed for newsletter signup ${email}:`, emailError);
    message = `Thanks for subscribing! Your 10% off code is: ${subscriber.discountCode}. We saved your signup, but we could not send the welcome email right now.`;
  }

  return res.status(201).json({
    success: true,
    message,
    discountCode: subscriber.discountCode,
    welcomeEmailSent,
    subscriber: buildSubscriberResponse(subscriber)
  });
}));

app.get('/api/newsletter/unsubscribe', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.query?.email || '');
  const token = String(req.query?.token || '').trim();
  const subscribers = await readSubscribers();
  const subscriber = findSubscriberByEmail(subscribers, email);

  if (!subscriber || token !== createSubscriberUnsubscribeToken(subscriber)) {
    return res.status(400).send(`
      <main style="font-family:Arial,sans-serif;max-width:620px;margin:48px auto;padding:24px;line-height:1.6;color:#231711;">
        <h1>Unsubscribe link expired</h1>
        <p>This unsubscribe link is invalid or expired. Please contact Benzy Luxury support if you need help.</p>
      </main>
    `);
  }

  const unsubscribedAt = new Date().toISOString();
  const nextSubscribers = subscribers.map((entry) => (
    normalizeEmail(entry?.email) === email
      ? { ...entry, marketingOptOut: true, unsubscribedAt }
      : entry
  ));
  await writeSubscribers(nextSubscribers);

  return res.send(`
    <main style="font-family:Arial,sans-serif;max-width:620px;margin:48px auto;padding:24px;line-height:1.6;color:#231711;">
      <h1>You are unsubscribed</h1>
      <p>${escapeHtml(email)} will no longer receive Benzy Luxury marketing announcements.</p>
      <p>You can subscribe again from the website footer whenever you want updates again.</p>
    </main>
  `);
}));

app.post('/api/giveaway/enter', giveawayRateLimiter, asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email || '');
  const source = sanitizePlainText(req.body?.source || 'giveaway', 80);

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Enter a valid email address.'
    });
  }

  try {
    await addGiveawayContact(email, {
      attributes: buildBrevoContactAttributes({
        source,
        signup_location: 'giveaway-form',
        campaign_name: source
      }),
      tags: ['giveaway', source].filter(Boolean)
    });
  } catch (error) {
    console.error(`Brevo giveaway sync failed for ${email}:`, error);
    return res.status(getBrevoNewsletterErrorStatus(error)).json({
      success: false,
      message: getBrevoNewsletterErrorMessage(error)
    });
  }

  return res.status(201).json({
    success: true,
    message: 'Thanks! You are entered into the giveaway.',
    email
  });
}));

app.post('/api/vip/upgrade', vipRateLimiter, asyncHandler(async (req, res) => {
  const authUser = getAuthenticatedUser(req);
  const email = normalizeEmail(authUser?.email || req.body?.email || '');
  const source = sanitizePlainText(req.body?.source || 'vip-upgrade', 80);
  const signupLocation = sanitizePlainText(req.body?.signupLocation || 'vip-flow', 80);
  const campaignName = sanitizePlainText(req.body?.campaignName || 'vip-upgrade', 80);

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Enter a valid email address.'
    });
  }

  try {
    await addVipContact(email, {
      attributes: buildBrevoContactAttributes({
        source,
        signup_location: signupLocation,
        customer_status: 'vip',
        vip_status: 'active',
        campaign_name: campaignName
      }),
      tags: ['vip', source, campaignName].filter(Boolean)
    });
  } catch (error) {
    console.error(`Brevo VIP sync failed for ${email}:`, error);
    return res.status(getBrevoNewsletterErrorStatus(error)).json({
      success: false,
      message: getBrevoNewsletterErrorMessage(error)
    });
  }

  return res.status(200).json({
    success: true,
    message: 'VIP contact updated successfully.',
    email
  });
}));

app.post('/api/contact-messages', contactMessageRateLimiter, asyncHandler(async (req, res) => {
  const name = sanitizePlainText(req.body?.name || '', 120);
  const email = normalizeEmail(req.body?.email || '');
  const phone = sanitizePlainText(req.body?.phone || '', 40);
  const customerWhatsAppPhone = normalizeWhatsAppPhone(phone);
  const subject = sanitizePlainText(req.body?.subject || '', 140);
  const message = sanitizeMultilineText(req.body?.message || '', 3000);

  if (name.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Enter your name.'
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Enter a valid email address.'
    });
  }

  if (customerWhatsAppPhone.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Enter a valid phone or WhatsApp number.'
    });
  }

  if (subject.length < 3) {
    return res.status(400).json({
      success: false,
      message: 'Add a short subject for your message.'
    });
  }

  if (message.length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Message is too short.'
    });
  }

  const content = await readSingletonDocument('site_content', 'main', DEFAULT_CONTENT);
  const contactInfo = content?.contactInfo || CONTACT_INFO_DEFAULTS;
  const createdAt = new Date().toISOString();
  const messageId = `msg-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const manualWhatsappUrl = buildContactManualWhatsAppUrl({ name, email, phone, subject, message }, contactInfo);

  const messageRecord = {
    messageId,
    source: 'contact-page',
    status: 'new',
    name,
    email,
    phone,
    subject,
    message,
    internalNote: '',
    createdAt,
    updatedAt: createdAt,
    submittedFrom: sanitizePlainText(req.headers.origin || req.headers.referer || '', 200),
    ipAddress: sanitizePlainText(req.ip || '', 80),
    userAgent: sanitizePlainText(req.headers['user-agent'] || '', 240),
    delivery: {
      dashboard: {
        savedAt: createdAt
      },
      email: {
        configured: false,
        contactSynced: false,
        supportRecipients: [],
        supportDelivered: [],
        senderAcknowledged: false,
        errors: []
      },
      whatsapp: {
        configured: isWatiConfigured(),
        templateConfigured: isWatiTemplateConfigured(),
        provider: isWatiConfigured() ? 'wati' : 'browser-link',
        deliveryMethod: manualWhatsappUrl ? 'browser-link' : 'unavailable',
        ready: Boolean(manualWhatsappUrl),
        sent: false,
        targetPhone: sanitizePlainText(customerWhatsAppPhone || phone, 40),
        channelPhone: sanitizePlainText(contactInfo?.phone || CONTACT_INFO_DEFAULTS.phone, 40),
        url: manualWhatsappUrl,
        manualUrl: manualWhatsappUrl,
        messageId: '',
        error: ''
      }
    }
  };

  const contactCollection = await getCollection('contact_messages');
  await contactCollection.insertOne({
    _id: messageId,
    ...messageRecord
  });

  const emailDelivery = await sendContactMessageNotifications(messageRecord, contactInfo);
  const whatsappDelivery = await sendContactWhatsAppNotification(messageRecord, contactInfo);
  messageRecord.delivery.email = emailDelivery;
  messageRecord.delivery.whatsapp = whatsappDelivery;
  messageRecord.updatedAt = new Date().toISOString();

  await contactCollection.updateOne(
    { _id: messageId },
    {
      $set: {
        delivery: messageRecord.delivery,
        updatedAt: messageRecord.updatedAt
      }
    }
  );

  res.status(201).json({
    success: true,
    message: 'Your message has been saved. We will get back to you soon.',
    contactMessage: {
      messageId,
      status: messageRecord.status,
      createdAt,
      source: messageRecord.source
    },
    email: emailDelivery,
    whatsapp: messageRecord.delivery.whatsapp,
    dashboardSaved: true
  });
}));

app.post('/api/webhooks/brevo', asyncHandler(async (req, res) => {
  requireBrevoWebhookSecret();
  if (!isBrevoWebhookAuthorized(req)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid Brevo webhook secret.'
    });
  }

  const payloads = normalizeBrevoWebhookPayloads(req.body);
  if (!payloads.length) {
    return res.status(400).json({
      success: false,
      message: 'A Brevo webhook payload is required.'
    });
  }

  let matchedOrders = 0;
  let matchedWalletTopUps = 0;

  for (const payload of payloads) {
    const record = await recordBrevoWebhookEvent(payload, req);
    if (await applyBrevoWebhookToOrder(record)) {
      matchedOrders += 1;
    }
    if (await applyBrevoWebhookToWalletTopUp(record)) {
      matchedWalletTopUps += 1;
    }
  }

  return res.status(202).json({
    success: true,
    received: payloads.length,
    matchedOrders,
    matchedWalletTopUps
  });
}));

app.post('/api/coupons/validate', asyncHandler(async (req, res) => {
  const authUser = getAuthenticatedUser(req);
  if (!authUser?.email) {
    return res.status(401).json({
      success: false,
      valid: false,
      message: 'Log in to apply your subscriber discount.'
    });
  }

  const requestEmail = normalizeEmail(req.body?.email || '');
  const email = normalizeEmail(authUser.email);
  if (requestEmail && requestEmail !== email) {
    return res.status(403).json({
      success: false,
      valid: false,
      message: 'Your coupon can only be used on the logged-in account email.'
    });
  }

  const couponCode = String(req.body?.couponCode || req.body?.discountCode || '').trim().toUpperCase();
  const validation = validateNewsletterDiscount({
    email,
    couponCode,
    subscribers: await readSubscribers(),
    orders: await readOrders()
  });

  if (!validation.valid) {
    return res.status(validation.status).json({
      success: false,
      valid: false,
      message: validation.message
    });
  }

  return res.json({
    success: true,
    valid: true,
    message: validation.message,
    couponCode: validation.couponCode,
    discountPercent: validation.discountPercent,
    source: NEWSLETTER_SOURCE,
    email: validation.subscriber.email
  });
}));

// ============ LIVE CHECKOUT API ============

app.get('/api/currency/rates', asyncHandler(async (_req, res) => {
  const exchangeRates = await getExchangeRates();
  const currencyConfig = getCurrencyConfigSnapshot();

  res.json({
    success: true,
    base: 'NGN',
    rates: exchangeRates.rates,
    fetchedAt: exchangeRates.fetchedAt,
    source: exchangeRates.source,
    ...currencyConfig
  });
}));

app.get('/api/checkout/context', asyncHandler(async (req, res) => {
  const countryCode = getRequestCountryCode(req);
  const exchangeRates = await getExchangeRates();
  const detectedCheckoutCurrency = getDetectedCheckoutCurrencyForCountryCode(countryCode);
  const currencyConfig = getCurrencyConfigSnapshot();
  const paystackSecretKey = getPaystackSecretKey();
  const paystackPublicKey = getPaystackPublicKey();

  res.json({
    success: true,
    countryCode,
    currency: detectedCheckoutCurrency,
    checkoutCurrency: detectedCheckoutCurrency,
    baseCurrency: 'NGN',
    ...currencyConfig,
    rates: exchangeRates.rates,
    ratesFetchedAt: exchangeRates.fetchedAt,
    ratesSource: exchangeRates.source,
    httpsRequired: true,
    httpsDetected: isHttpsRequest(req),
    paystackConfigured: Boolean(paystackSecretKey && paystackPublicKey),
    paystackPublicKeyConfigured: Boolean(paystackPublicKey)
  });
}));

app.post('/api/checkout/paystack/initialize', asyncHandler(async (req, res) => {
  requirePaystackSecretKey();
  requirePaystackPublicKey();
  const paystackPublicKey = getPaystackPublicKey();
  const payload = req.body || {};
  const requestedMethod = normalizePaymentMethod(payload?.paymentMethod);
  if (!['card', 'paystack'].includes(requestedMethod)) {
    throw httpError(400, 'Use the Paystack route for Card Payment or Paystack only.');
  }

  const draft = await prepareCheckoutOrderDraft(req, payload, requestedMethod);
  const now = new Date().toISOString();
  const requestedOrderId = String(payload?.orderId || '').trim();
  const existingOrder = requestedOrderId ? await getOrderRecordByOrderId(requestedOrderId) : null;
  const canReuseOrder = Boolean(
    existingOrder
    && String(existingOrder.customerId || '').trim() === String(draft.authUser?.id || '').trim()
    && existingOrder.paymentStatus !== 'paid'
  );
  const paymentReference = canReuseOrder
    ? String(existingOrder.paymentReference || createPaymentReference('BLX')).trim()
    : createPaymentReference('BLX');
  const orderPayload = {
    customerId: String(draft.authUser?.id || '').trim(),
    customerEmail: draft.authenticatedEmail,
    customer: draft.customer,
    items: draft.items,
    subtotal: draft.subtotal,
    discountedSubtotal: draft.discountedSubtotal,
    discount: draft.discountAmount,
    discountAmount: draft.discountAmount,
    discountPercent: draft.discountPercent,
    discountCode: draft.discountCode,
    tax: draft.chargeTax,
    shipping: draft.chargeShipping,
    total: draft.chargeTotal,
    totalNaira: draft.totalNgn,
    currency: draft.chargeCurrency,
    settlementCurrency: draft.chargeCurrency,
    shippingAddress: buildShippingAddressText(draft.customer),
    paymentMethod: 'Paystack',
    paymentMethodCode: requestedMethod === 'card' ? 'card' : 'paystack',
    paymentProvider: 'paystack',
    paymentStatus: 'pending',
    orderStatus: 'pending',
    status: 'pending',
    paymentReference,
    createdAt: canReuseOrder ? existingOrder.createdAt || now : now,
    updatedAt: now,
    paidAt: null,
    metadata: {
      checkoutSource: 'checkout-page',
      initiatedVia: requestedMethod,
      requestCountryCode: draft.requestCountryCode,
      totals: draft.convertedTotals,
      selectedCurrency: draft.displayCurrency,
      selectedDisplayCurrency: draft.displayCurrency,
      requestedCheckoutCurrency: draft.requestedCheckoutCurrency,
      chargeCurrency: draft.chargeCurrency,
      chargeCurrencyForced: draft.chargeCurrencyForced,
      chargeCurrencyMessage: draft.chargeCurrencyMessage
    }
  };
  const order = canReuseOrder
    ? await updateOrderRecord(existingOrder.orderId, orderPayload)
    : await insertOrderRecord({
      orderId: generateOrderId(),
      ...orderPayload
    });
  const notifiedOrder = await maybeSendAdminOrderPlacedEmail(order, 'paystack-checkout-started');
  const callbackUrl = buildPublicPageUrl(req, 'PaymentSuccess.html', {
    mode: 'paystack',
    orderId: notifiedOrder.orderId,
    reference: paymentReference
  });

  res.status(201).json({
    success: true,
    mode: 'inlinejs_v2',
    orderId: notifiedOrder.orderId,
    reference: paymentReference,
    key: paystackPublicKey || null,
    publicKey: paystackPublicKey || null,
    email: draft.authenticatedEmail,
    amount: draft.chargeTotalSubunit,
    displayAmount: draft.chargeTotal,
    displayCurrency: draft.displayCurrency,
    checkoutCurrency: draft.requestedCheckoutCurrency,
    currency: draft.chargeCurrency,
    chargeCurrency: draft.chargeCurrency,
    chargeCurrencyForced: draft.chargeCurrencyForced,
    chargeCurrencyMessage: draft.chargeCurrencyMessage,
    callbackUrl
  });
}));

app.post('/api/checkout/bank-transfer', asyncHandler(async (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Bank transfer checkout is disabled. Please use Paystack.'
  });
}));

app.post('/api/checkout/wallet', authMiddleware, asyncHandler(async (req, res) => {
  const payload = req.body || {};
  const draft = await prepareCheckoutOrderDraft(req, payload, 'wallet', {
    allowedPaymentMethods: ['wallet']
  });
  const users = await readUsers();
  const userIndex = findUserIndexById(users, draft.authUser?.id || req.user?.id);
  if (userIndex < 0) {
    throw httpError(404, 'User not found.');
  }

  const now = new Date().toISOString();
  const wallet = normalizeWallet(users[userIndex].wallet);
  if (wallet.balance + 0.0001 < draft.total) {
    return res.status(409).json({
      success: false,
      message: 'Insufficient wallet balance for this order.',
      wallet: {
        balance: wallet.balance,
        currency: wallet.currency
      }
    });
  }

  const paymentReference = createPaymentReference('WALPAY');
  const order = await insertOrderRecord({
    orderId: generateOrderId(),
    customerId: String(draft.authUser?.id || '').trim(),
    customerEmail: draft.authenticatedEmail,
    customer: draft.customer,
    items: draft.items,
    subtotal: draft.subtotal,
    discountedSubtotal: draft.discountedSubtotal,
    discount: draft.discountAmount,
    discountAmount: draft.discountAmount,
    discountPercent: draft.discountPercent,
    discountCode: draft.discountCode,
    tax: draft.tax,
    shipping: draft.shipping,
    total: draft.total,
    totalNaira: draft.total,
    currency: WALLET_CURRENCY,
    settlementCurrency: WALLET_CURRENCY,
    shippingAddress: buildShippingAddressText(draft.customer),
    paymentMethod: 'Wallet',
    paymentProvider: 'wallet',
    paymentStatus: 'paid',
    orderStatus: 'confirmed',
    status: 'confirmed',
    paymentReference,
    transactionId: paymentReference,
    createdAt: now,
    updatedAt: now,
    paidAt: now,
    metadata: {
      checkoutSource: 'checkout-page',
      initiatedVia: 'wallet'
    }
  });
  const adminNotifiedOrder = await maybeSendAdminOrderPlacedEmail(order, 'wallet-checkout');

  wallet.balance = roundMoney(wallet.balance - draft.total);
  wallet.transactions = [
    createWalletTransaction({
      reference: paymentReference,
      type: 'debit',
      category: 'order_payment',
      amount: draft.total,
      currency: WALLET_CURRENCY,
      status: 'successful',
      provider: 'wallet',
      paymentMethod: 'Wallet',
      note: `Wallet payment for order ${order.orderId}`,
      orderId: order.orderId,
      createdAt: now,
      updatedAt: now,
      completedAt: now
    }),
    ...(Array.isArray(wallet.transactions) ? wallet.transactions : [])
  ];
  wallet.updatedAt = now;
  users[userIndex].wallet = wallet;
  await writeUsers(users);

  await markOrderDiscountIfNeeded(order);
  await recordCouponRedemption({
    code: order.discountCode,
    userId: draft.authUser?.id || req.user?.id,
    email: draft.authenticatedEmail
  });
  await clearUserCart({ id: draft.authUser?.id || req.user?.id, email: draft.authenticatedEmail });
  const confirmedOrder = await maybeSendOrderConfirmationEmail(adminNotifiedOrder, 'wallet-checkout');

  res.status(201).json({
    success: true,
    order: confirmedOrder,
    wallet: normalizeWallet(users[userIndex].wallet)
  });
}));

app.post('/api/profile/wallet/topup/paystack/initialize', authMiddleware, asyncHandler(async (req, res) => {
  requirePaystackSecretKey();
  const paystackSecretKey = getPaystackSecretKey();
  const amount = roundMoney(req.body?.amountNgn ?? req.body?.amount ?? 0);
  if (!Number.isFinite(amount) || amount < 100) {
    throw httpError(400, 'Top-up amount must be at least NGN 100.');
  }

  const users = await readUsers();
  const userIndex = findUserIndexById(users, req.user?.id);
  if (userIndex < 0) {
    throw httpError(404, 'User not found.');
  }

  const now = new Date().toISOString();
  const currentUser = users[userIndex];
  const wallet = normalizeWallet(currentUser.wallet);
  const paymentReference = createPaymentReference('WLT');
  const pendingTransaction = createWalletTransaction({
    reference: paymentReference,
    type: 'credit',
    category: 'topup',
    amount,
    currency: WALLET_CURRENCY,
    status: 'pending',
    provider: 'paystack',
    paymentMethod: 'Paystack',
    note: 'Wallet top-up via Paystack',
    createdAt: now,
    updatedAt: now
  });

  wallet.transactions = [pendingTransaction, ...(Array.isArray(wallet.transactions) ? wallet.transactions : [])];
  wallet.updatedAt = now;
  users[userIndex].wallet = wallet;
  await writeUsers(users);

  const callbackUrl = buildPublicPageUrl(req, 'PaymentSuccess.html', {
    mode: 'wallet-topup',
    reference: paymentReference
  });

  const paystackResponse = await sendHttpsJsonRequest({
    hostname: 'api.paystack.co',
    path: '/transaction/initialize',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      'Content-Type': 'application/json'
    }
  }, {
    email: normalizeEmail(currentUser.email),
    amount: Math.round(amount * 100),
    currency: WALLET_CURRENCY,
    reference: paymentReference,
    callback_url: callbackUrl,
    metadata: {
      flow: 'wallet_topup',
      userId: String(currentUser.id || ''),
      customerEmail: normalizeEmail(currentUser.email),
      amount
    }
  });

  const initialized = Boolean(paystackResponse.data?.status) && Boolean(paystackResponse.data?.data?.authorization_url);
  if (!initialized) {
    const failedWallet = normalizeWallet(users[userIndex].wallet);
    const transactionIndex = getWalletTransactionIndex(failedWallet, paymentReference);
    if (transactionIndex >= 0) {
      failedWallet.transactions[transactionIndex] = normalizeWalletTransaction({
        ...failedWallet.transactions[transactionIndex],
        status: 'failed',
        updatedAt: new Date().toISOString(),
        metadata: {
          ...(failedWallet.transactions[transactionIndex]?.metadata || {}),
          paystackInitialize: paystackResponse.data || null
        }
      });
      failedWallet.updatedAt = new Date().toISOString();
      users[userIndex].wallet = failedWallet;
      await writeUsers(users);
    }

    return res.status(502).json({
      success: false,
      message: String(paystackResponse.data?.message || 'Unable to initialize wallet top-up.')
    });
  }

  res.status(201).json({
    success: true,
    reference: paymentReference,
    authorizationUrl: paystackResponse.data.data.authorization_url,
    accessCode: paystackResponse.data.data.access_code
  });
}));

app.post('/api/payments/paystack/verify', asyncHandler(async (req, res) => {
  requirePaystackSecretKey();
  const paystackSecretKey = getPaystackSecretKey();
  const reference = String(req.body?.reference || req.query?.reference || '').trim();
  const orderId = String(req.body?.orderId || req.query?.orderId || '').trim();
  if (!reference && !orderId) {
    throw httpError(400, 'A payment reference or order ID is required.');
  }

  let order = orderId ? await getOrderRecordByOrderId(orderId) : await getOrderRecordByPaymentReference(reference);
  if (!order && reference) {
    order = await getOrderRecordByPaymentReference(reference);
  }
  if (!order) {
    throw httpError(404, 'Order not found.');
  }

  const paymentReference = reference || order.paymentReference;
  if (!paymentReference) {
    throw httpError(400, 'Payment reference is missing for this order.');
  }

  if (order.paymentStatus === 'paid') {
    const confirmedOrder = await maybeSendOrderConfirmationEmail(order, 'paystack-verify-repeat');
    return res.json({ success: true, verified: true, order: confirmedOrder });
  }

  const paystackResponse = await sendHttpsJsonRequest({
    hostname: 'api.paystack.co',
    path: `/transaction/verify/${encodeURIComponent(paymentReference)}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`
    }
  });

  const verification = paystackResponse.data?.data || {};
  const verificationStatus = String(verification.status || '').trim().toLowerCase();
  const verified = Boolean(paystackResponse.data?.status) && verificationStatus === 'success';
  if (!verified) {
    const failureStatus = ['failed', 'abandoned', 'reversed'].includes(verificationStatus) ? 'failed' : 'pending';
    const failedOrder = await updateOrderRecord(order.orderId, {
      paymentStatus: failureStatus,
      orderStatus: failureStatus === 'failed' ? 'failed' : order.orderStatus || 'pending',
      status: failureStatus === 'failed' ? 'failed' : order.status || 'pending',
      metadata: {
        ...(order.metadata || {}),
        paystackVerification: verification || paystackResponse.data || null
      }
    });
    return res.status(failureStatus === 'failed' ? 400 : 409).json({
      success: false,
      verified: false,
      message: String(paystackResponse.data?.message || 'Payment was not verified.'),
      order: failedOrder
    });
  }

  const paystackVerification = buildPaystackVerificationResult({
    expectedAmountMajor: order.total || 0,
    expectedCurrency: order.currency || 'NGN',
    verifiedAmountSubunit: verification.amount,
    verifiedCurrency: verification.currency || order.currency || 'NGN'
  });
  if (!paystackVerification.matchesCurrency) {
    return res.status(409).json({
      success: false,
      verified: false,
      message: 'Verified currency does not match the order currency.'
    });
  }

  if (!paystackVerification.matchesAmount) {
    return res.status(409).json({
      success: false,
      verified: false,
      message: 'Verified amount does not match the order total.'
    });
  }

  const paidAt = new Date().toISOString();
  const chargedAmount = paystackVerification.verifiedAmountMajor;
  const verificationCurrency = paystackVerification.verifiedCurrency;
  const verifiedMethodCode = normalizePaymentMethod(verification.channel || 'paystack');
  const updatedOrder = await updateOrderRecord(order.orderId, {
    paymentMethod: formatPaymentMethodLabel(verification.channel || 'paystack', 'paystack'),
    paymentMethodCode: verifiedMethodCode === 'unknown' ? 'paystack' : verifiedMethodCode,
    paymentProvider: 'paystack',
    paymentStatus: 'paid',
    orderStatus: 'processing',
    status: 'processing',
    paidAt,
    currency: verificationCurrency,
    settlementCurrency: verificationCurrency,
    paymentReference,
    transactionId: paymentReference,
    metadata: {
      ...(order.metadata || {}),
      paystackVerification: {
        id: verification.id || null,
        channel: verification.channel || '',
        gatewayResponse: verification.gateway_response || '',
        paidAt: verification.paid_at || paidAt,
        currency: verificationCurrency,
        amount: chargedAmount,
        amountSubunit: paystackVerification.verifiedAmountSubunit,
        expectedAmountSubunit: paystackVerification.expectedAmountSubunit
      }
    }
  });
  const adminNotifiedOrder = await maybeSendAdminOrderPlacedEmail(updatedOrder, 'paystack-verified');

  await markOrderDiscountIfNeeded(adminNotifiedOrder);
  await recordCouponRedemption({
    code: adminNotifiedOrder.discountCode,
    userId: adminNotifiedOrder.customerId,
    email: adminNotifiedOrder.customerEmail
  });
  if (adminNotifiedOrder.customerId && adminNotifiedOrder.customerEmail) {
    await clearUserCart({ id: adminNotifiedOrder.customerId, email: adminNotifiedOrder.customerEmail });
  }
  const confirmedOrder = await maybeSendOrderConfirmationEmail(adminNotifiedOrder, 'paystack-verified');

  res.json({
    success: true,
    verified: true,
    order: confirmedOrder
  });
}));

app.post('/api/profile/wallet/topup/paystack/verify', asyncHandler(async (req, res) => {
  requirePaystackSecretKey();
  const paystackSecretKey = getPaystackSecretKey();
  const reference = String(req.body?.reference || req.query?.reference || '').trim();
  if (!reference) {
    throw httpError(400, 'A wallet payment reference is required.');
  }

  const authUser = getAuthenticatedUser(req);
  const users = await readUsers();
  const userIndex = users.findIndex((user) => getWalletTransactionIndex(user?.wallet, reference) >= 0);
  if (userIndex < 0) {
    throw httpError(404, 'Wallet top-up record not found.');
  }

  if (authUser && String(users[userIndex]?.id) !== String(authUser.id)) {
    throw httpError(403, 'You can only verify your own wallet top-up.');
  }

  const wallet = normalizeWallet(users[userIndex].wallet);
  const transactionIndex = getWalletTransactionIndex(wallet, reference);
  if (transactionIndex < 0) {
    throw httpError(404, 'Wallet top-up record not found.');
  }

  const transaction = wallet.transactions[transactionIndex];
  if (transaction.status === 'successful') {
    const synced = await maybeSendWalletTopUpEmail(users, userIndex, reference, 'wallet-topup-verify-repeat');
    return res.json({
      success: true,
      verified: true,
      wallet: synced.wallet,
      transaction: synced.transaction || transaction
    });
  }

  const paystackResponse = await sendHttpsJsonRequest({
    hostname: 'api.paystack.co',
    path: `/transaction/verify/${encodeURIComponent(reference)}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`
    }
  });

  const verification = paystackResponse.data?.data || {};
  const verified = Boolean(paystackResponse.data?.status) && String(verification.status || '').toLowerCase() === 'success';
  if (!verified) {
    wallet.transactions[transactionIndex] = normalizeWalletTransaction({
      ...transaction,
      status: 'failed',
      updatedAt: new Date().toISOString(),
      metadata: {
        ...(transaction.metadata || {}),
        paystackVerification: verification || paystackResponse.data || null
      }
    });
    wallet.updatedAt = new Date().toISOString();
    users[userIndex].wallet = wallet;
    await writeUsers(users);

    return res.status(400).json({
      success: false,
      verified: false,
      message: String(paystackResponse.data?.message || 'Wallet top-up was not verified.'),
      wallet: normalizeWallet(users[userIndex].wallet)
    });
  }

  const chargedAmount = roundMoney(Number(verification.amount || 0) / 100);
  const expectedAmount = Math.abs(Number(transaction.amount || 0));
  if (chargedAmount && Math.abs(chargedAmount - expectedAmount) > 1) {
    wallet.transactions[transactionIndex] = normalizeWalletTransaction({
      ...transaction,
      status: 'failed',
      updatedAt: new Date().toISOString(),
      metadata: {
        ...(transaction.metadata || {}),
        paystackVerification: verification || paystackResponse.data || null,
        amountMismatch: {
          expectedAmount,
          chargedAmount
        }
      }
    });
    wallet.updatedAt = new Date().toISOString();
    users[userIndex].wallet = wallet;
    await writeUsers(users);

    return res.status(409).json({
      success: false,
      verified: false,
      message: 'Verified amount does not match the wallet top-up amount.'
    });
  }

  const completedAt = new Date().toISOString();
  wallet.balance = roundMoney(wallet.balance + chargedAmount);
  wallet.transactions[transactionIndex] = normalizeWalletTransaction({
    ...transaction,
    amount: chargedAmount,
    status: 'successful',
    updatedAt: completedAt,
    completedAt,
    metadata: {
      ...(transaction.metadata || {}),
      paystackVerification: {
        id: verification.id || null,
        channel: verification.channel || '',
        gatewayResponse: verification.gateway_response || '',
        paidAt: verification.paid_at || completedAt
      }
    }
  });
  wallet.updatedAt = completedAt;
  users[userIndex].wallet = wallet;
  await writeUsers(users);
  const synced = await maybeSendWalletTopUpEmail(users, userIndex, reference, 'wallet-topup-verified');

  res.json({
    success: true,
    verified: true,
    wallet: synced.wallet,
    transaction: synced.transaction
  });
}));

// Get all orders for a customer (by email)
app.get('/api/orders/:email', asyncHandler(async (req, res) => {
  const { email } = req.params;
  const normalized = normalizeEmail(email);
  const orders = await readOrders();
  const customerOrders = orders.filter(o => normalizeEmail(o.customerEmail) === normalized);

  res.json({
    success: true,
    orders: customerOrders,
    count: customerOrders.length
  });
}));

app.patch('/api/orders/:orderId/cancel', authMiddleware, asyncHandler(async (req, res) => {
  const order = await getOrderRecordByOrderId(req.params.orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }

  const requesterEmail = normalizeEmail(req.user?.email || '');
  const ownsOrder = requesterEmail && requesterEmail === normalizeEmail(order.customerEmail);
  const hostUser = isHostUser(req.user || {});
  if (!ownsOrder && !hostUser) {
    return res.status(403).json({ success: false, message: 'You can only cancel your own orders.' });
  }

  if (!canCancelOrderStatus(order.status)) {
    return res.status(409).json({ success: false, message: 'This order can no longer be cancelled.' });
  }

  const cancelledAt = new Date().toISOString();
  const updatedOrder = await updateOrderRecord(order.orderId, {
    orderStatus: 'cancelled',
    status: 'cancelled',
    metadata: {
      ...(order.metadata || {}),
      cancelledAt,
      cancelledBy: requesterEmail || null
    }
  });

  res.json({
    success: true,
    order: updatedOrder
  });
}));

// Create a new order
app.post('/api/orders', asyncHandler(async (req, res) => {
  try {
    const payload = req.body || {};
    const authUser = getAuthenticatedUser(req);
    const authenticatedEmail = normalizeEmail(authUser?.email || '');
    const subscribers = await readSubscribers();
    const orders = await readOrders();
    const draftOrder = buildOrderFromPayload(payload);
    const duplicate = orders.find(o => String(o.orderId || '').toUpperCase() === String(draftOrder.orderId || '').toUpperCase());
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Order already exists.'
      });
    }

    const itemsSubtotal = roundMoney(
      (Array.isArray(draftOrder.items) ? draftOrder.items : []).reduce(
        (sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 1),
        0
      )
    );
    const subtotal = roundMoney(
      payload?.subtotal ?? payload?.subtotalUsd ?? (itemsSubtotal > 0 ? itemsSubtotal : draftOrder.subtotal)
    );
    const submittedShipping = Number(payload?.shipping ?? payload?.shippingUsd ?? 0);
    const shipping = roundMoney(submittedShipping);

    let discountCode = String(payload?.couponCode || payload?.discountCode || '').trim().toUpperCase();
    let discountAmount = 0;
    let discountPercent = 0;
    let couponValidation = null;

    if (discountCode) {
      if (!authenticatedEmail) {
        return res.status(401).json({
          success: false,
          message: 'Log in to redeem your subscriber discount.'
        });
      }

      if (authenticatedEmail !== draftOrder.customerEmail) {
        return res.status(403).json({
          success: false,
          message: 'Your discount code must be used with the logged-in account email.'
        });
      }

      couponValidation = validateNewsletterDiscount({
        email: authenticatedEmail,
        couponCode: discountCode,
        subscribers,
        orders,
        currentOrderId: draftOrder.orderId
      });

      if (!couponValidation.valid) {
        return res.status(couponValidation.status).json({
          success: false,
          message: couponValidation.message
        });
      }

      discountPercent = couponValidation.discountPercent;
      discountAmount = roundMoney(subtotal * NEWSLETTER_DISCOUNT_RATIO);
    }

    const discountedSubtotal = roundMoney(Math.max(0, subtotal - discountAmount));
    const tax = roundMoney(discountedSubtotal * ORDER_TAX_RATE);
    const total = roundMoney(discountedSubtotal + tax + shipping);

    const order = buildOrderFromPayload({
      ...payload,
      orderId: draftOrder.orderId,
      customerEmail: authenticatedEmail || draftOrder.customerEmail,
      subtotal,
      discountedSubtotal,
      discountAmount,
      discountPercent,
      discountCode,
      tax,
      shipping,
      total
    });

    orders.push(order);
    await writeOrders(orders);
    const adminNotifiedOrder = await maybeSendAdminOrderPlacedEmail(order, 'orders-api-create');

    if (couponValidation?.valid) {
      await markDiscountCodeUsed(subscribers, authenticatedEmail || draftOrder.customerEmail, adminNotifiedOrder.orderId);
    }

    await recordCouponRedemption({
      code: adminNotifiedOrder.discountCode,
      userId: authUser?.id || adminNotifiedOrder.customerId,
      email: authenticatedEmail || adminNotifiedOrder.customerEmail
    });

    if (authUser?.id && authenticatedEmail) {
      await clearUserCart({ id: authUser.id, email: authenticatedEmail });
    }
    const confirmedOrder = await maybeSendOrderConfirmationEmail(adminNotifiedOrder, 'orders-create-paid');

    res.status(201).json({
      success: true,
      order: confirmedOrder,
      coupon: order.discountCode
        ? {
            code: order.discountCode,
            discountAmount: order.discountAmount,
            discountPercent: order.discountPercent
          }
        : null
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Unable to create order.'
    });
  }
}));

// ============ PAYSTACK PAYMENT VERIFICATION ============
app.post('/api/paystack/verify', async (req, res) => {
  try {
    requirePaystackSecretKey();
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
  const paystackSecretKey = getPaystackSecretKey();

  const { reference } = req.body;
  
  if (!reference) {
    return res.status(400).json({ success: false, message: 'Reference is required' });
  }
  
  const options = {
    hostname: 'api.paystack.co',
    path: `/transaction/verify/${reference}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`
    }
  };
  
  https.request(options, function(apiRes) {
    let data = '';
    apiRes.on('data', function(chunk) { data += chunk; });
    apiRes.on('end', function() {
      try {
        const parsed = JSON.parse(data);
        const verified = Boolean(parsed?.status) && String(parsed?.data?.status || '').toLowerCase() === 'success';
        if (verified) {
          res.json({
            success: true,
            verified: true,
            amount: parsed.data.amount,
            currency: parsed.data.currency,
            customer: parsed.data.customer,
            status: parsed.data.status
          });
        } else {
          res.json({
            success: true,
            verified: false,
            message: 'Payment not successful'
          });
        }
      } catch(e) {
        res.status(500).json({ success: false, message: 'Parse error' });
      }
    });
  }).on('error', function(err) {
    console.error('Paystack error:', err);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }).end();
});

// ============ FLUTTERWAVE PAYMENT VERIFICATION ============
app.post('/api/flutterwave/verify', async (req, res) => {
  const { transaction_id } = req.body;
  
  if (!transaction_id) {
    return res.status(400).json({ success: false, message: 'Transaction ID is required' });
  }
  
  const options = {
    hostname: 'api.flutterwave.com',
    path: `/v3/transactions/${transaction_id}/verify`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`
    }
  };
  
  https.request(options, function(apiRes) {
    let data = '';
    apiRes.on('data', function(chunk) { data += chunk; });
    apiRes.on('end', function() {
      try {
        const parsed = JSON.parse(data);
        if (parsed.status === 'success') {
          res.json({
            success: true,
            verified: true,
            amount: parsed.data.amount,
            currency: parsed.data.currency,
            customer: parsed.data.customer,
            status: parsed.data.status
          });
        } else {
          res.json({
            success: true,
            verified: false,
            message: 'Payment not successful'
          });
        }
      } catch(e) {
        res.status(500).json({ success: false, message: 'Parse error' });
      }
    });
  }).on('error', function(err) {
    console.error('Flutterwave error:', err);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }).end();
});

// ============ AUTH API ============
app.post('/api/auth/signup', asyncHandler(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = normalizeEmail(req.body?.email || '');
  const password = String(req.body?.password || '');

  if (name.length < 2) return res.status(400).json({ error: 'Name is too short.' });
  if (!email.includes('@')) return res.status(400).json({ error: 'Invalid email.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const users = await readUsers();
  if (users.some((u) => u.email === email)) {
    return res.status(409).json({ error: 'Email already registered.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const role = inferRoleByEmail(email);
  const user = {
    id: Date.now(),
    name,
    email,
    role,
    adminRole: normalizeAdminRoleValue(role === 'host' ? 'super_admin' : '', { role, email }),
    isBanned: false,
    banReason: '',
    addresses: [],
    notifications: normalizeNotificationSettings(),
    passwordHash,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  await writeUsers(users);
  await sendAdminCustomerActivityEmail(user, 'created an account', {
    role: user.role || 'resident'
  });

  const token = signToken(user);
  res.status(201).json({ token, user: toPublicUser(user) });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email || '');
  const password = String(req.body?.password || '');

  const users = await readUsers();
  const user = users.find((u) => u.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  if (user.isBanned) {
    return res.status(403).json({ error: 'This account has been restricted. Please contact support.' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash || '');
  if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

  user.lastLoginAt = new Date().toISOString();
  await writeUsers(users);
  await sendAdminCustomerActivityEmail(user, 'logged in', {
    lastLoginAt: user.lastLoginAt
  });

  const token = signToken(user);
  res.json({ token, user: toPublicUser(user) });
}));

app.get('/api/auth/me', authMiddleware, asyncHandler(async (req, res) => {
  const users = await readUsers();
  const user = users.find((u) => String(u.id) === String(req.user.id));
  if (!user) return res.status(404).json({ error: 'User not found.' });

  res.json({ user: toPublicUser(user) });
}));

app.patch('/api/auth/profile', authMiddleware, asyncHandler(async (req, res) => {
  const users = await readUsers();
  const idx = users.findIndex((u) => String(u.id) === String(req.user.id));
  if (idx < 0) return res.status(404).json({ error: 'User not found.' });

  const current = users[idx];
  const before = {
    name: current.name || '',
    email: current.email || '',
    phone: current.phone || '',
    passwordChanged: false
  };
  const nextName = String(req.body?.name || '').trim();
  const nextEmail = normalizeEmail(req.body?.email || '');
  const nextPhone = String(req.body?.phone || '').trim();
  const nextPassword = String(req.body?.password || '');

  if (nextName.length < 2) return res.status(400).json({ error: 'Name is too short.' });
  if (!nextEmail.includes('@')) return res.status(400).json({ error: 'Invalid email.' });
  if (nextPassword && nextPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const duplicate = users.find((u, i) => i !== idx && normalizeEmail(u.email) === nextEmail);
  if (duplicate) {
    return res.status(409).json({ error: 'Email already registered.' });
  }

  current.name = nextName;
  current.email = nextEmail;
  current.phone = nextPhone;
  current.adminRole = normalizeAdminRoleValue(current.adminRole, current);
  if (nextPassword) {
    current.passwordHash = await bcrypt.hash(nextPassword, 10);
    before.passwordChanged = true;
  }

  users[idx] = current;
  await writeUsers(users);
  const changedFields = [
    before.name !== current.name ? 'name' : '',
    normalizeEmail(before.email) !== normalizeEmail(current.email) ? 'email' : '',
    String(before.phone || '') !== String(current.phone || '') ? 'phone' : '',
    before.passwordChanged ? 'password' : ''
  ].filter(Boolean);
  await sendAdminCustomerActivityEmail(current, 'updated their account', {
    changedFields: changedFields.length ? changedFields : ['profile saved'],
    previousEmail: normalizeEmail(before.email) !== normalizeEmail(current.email) ? before.email : ''
  });

  const token = signToken(current);
  res.json({ token, user: toPublicUser(current) });
}));

app.get('/api/profile/notifications', authMiddleware, asyncHandler(async (req, res) => {
  const users = await readUsers();
  const idx = findUserIndexById(users, req.user?.id);
  if (idx < 0) return res.status(404).json({ error: 'User not found.' });

  users[idx].notifications = normalizeNotificationSettings(users[idx].notifications);
  await writeUsers(users);

  res.json({
    success: true,
    notifications: users[idx].notifications,
    providers: {
      email: {
        provider: 'brevo',
        configured: isBrevoConfigured()
      },
      marketing: {
        provider: 'brevo',
        configured: isBrevoConfigured()
      },
      sms: {
        provider: 'wati',
        configured: isWatiConfigured(),
        templateConfigured: isWatiTemplateConfigured()
      }
    }
  });
}));

app.patch('/api/profile/notifications', authMiddleware, asyncHandler(async (req, res) => {
  const users = await readUsers();
  const idx = findUserIndexById(users, req.user?.id);
  if (idx < 0) return res.status(404).json({ error: 'User not found.' });

  const current = users[idx];
  const previous = normalizeNotificationSettings(current.notifications);
  const notifications = mergeNotificationSettings(previous, req.body?.notifications || req.body || {});
  const delivery = {
    marketingSynced: false,
    marketingSyncError: ''
  };

  current.notifications = notifications;
  users[idx] = current;
  await writeUsers(users);
  const changedNotificationFields = Object.keys(notifications).filter((key) => notifications[key] !== previous[key]);
  await sendAdminCustomerActivityEmail(current, 'updated notification preferences', {
    changedFields: changedNotificationFields.length ? changedNotificationFields : ['notifications saved']
  });

  if (notifications.marketing && !previous.marketing && isValidEmail(current.email)) {
    try {
      await addNewsletterContact(current.email, {
        attributes: buildBrevoContactAttributes({
          source: 'profile-settings',
          signup_location: 'profile-notifications',
          marketing_opt_in: true
        }),
        tags: ['newsletter', 'profile-opt-in']
      });
      delivery.marketingSynced = true;
    } catch (error) {
      delivery.marketingSyncError = error?.message || 'Unable to sync marketing preference with Brevo.';
    }
  }

  res.json({
    success: true,
    notifications,
    providers: {
      email: {
        provider: 'brevo',
        configured: isBrevoConfigured()
      },
      marketing: {
        provider: 'brevo',
        configured: isBrevoConfigured()
      },
      sms: {
        provider: 'wati',
        configured: isWatiConfigured(),
        templateConfigured: isWatiTemplateConfigured()
      }
    },
    delivery
  });
}));

app.get('/api/profile/addresses', authMiddleware, asyncHandler(async (req, res) => {
  const users = await readUsers();
  const idx = users.findIndex((u) => String(u.id) === String(req.user.id));
  if (idx < 0) return res.status(404).json({ error: 'User not found.' });

  let addresses = [];
  try {
    addresses = normalizeAddressList(users[idx].addresses || []);
  } catch {
    addresses = [];
  }

  users[idx].addresses = addresses;
  await writeUsers(users);
  await sendAdminCustomerActivityEmail(users[idx], 'updated delivery addresses', {
    addressCount: String(addresses.length)
  });
  res.json({ addresses });
}));

app.put('/api/profile/addresses', authMiddleware, asyncHandler(async (req, res) => {
  const users = await readUsers();
  const idx = users.findIndex((u) => String(u.id) === String(req.user.id));
  if (idx < 0) return res.status(404).json({ error: 'User not found.' });

  let addresses = [];
  try {
    addresses = normalizeAddressList(req.body?.addresses || []);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid address payload.' });
  }

  users[idx].addresses = addresses;
  await writeUsers(users);
  res.json({ addresses });
}));

app.get('/api/profile/wallet', authMiddleware, asyncHandler(async (req, res) => {
  const users = await readUsers();
  const idx = findUserIndexById(users, req.user?.id);
  if (idx < 0) return res.status(404).json({ error: 'User not found.' });
  const wallet = normalizeWallet(users[idx].wallet);
  res.json({
    success: true,
    wallet
  });
}));

// ============ SETTINGS API ============
app.get('/api/settings/shipping', asyncHandler(async (req, res) => {
  const settings = await readSettings();
  const subtotalNgn = Number(req.query?.subtotalNgn);
  const resolved = resolveShippingQuote(settings, {
    subtotalNgn: Number.isFinite(subtotalNgn) ? subtotalNgn : 0,
    state: req.query?.state,
    country: req.query?.country
  });
  res.json({
    success: true,
    shippingFeeNgn: resolved.feeNgn,
    shipping: settings.shipping,
    resolved
  });
}));

app.patch('/api/settings/shipping', authMiddleware, asyncHandler(async (req, res) => {
  const host = await requireHost(req, res);
  if (!host) return;
  const fee = Number(req.body?.shipping?.defaultDomesticFeeNgn ?? req.body?.shippingFeeNgn);
  if (!Number.isFinite(fee) || fee < 0) {
    return res.status(400).json({ error: 'shippingFeeNgn must be a non-negative number.' });
  }
  const settings = await readSettings();
  settings.shippingFeeNgn = fee;
  settings.shipping = {
    ...(settings.shipping || {}),
    defaultDomesticFeeNgn: fee
  };
  await writeSettings(settings);
  res.json({
    success: true,
    shippingFeeNgn: settings.shippingFeeNgn,
    shipping: settings.shipping,
    resolved: resolveShippingQuote(settings)
  });
}));

app.get('/api/content', asyncHandler(async (req, res) => {
  const content = await readSingletonDocument('site_content', 'main', DEFAULT_CONTENT);
  res.json({ success: true, content });
}));

app.patch('/api/admin/orders/:orderId/confirm-payment', authMiddleware, asyncHandler(async (req, res) => {
  const ctx = await requireHost(req, res);
  if (!ctx) return;

  const order = await getOrderRecordByOrderId(req.params.orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }

  const paidAt = new Date().toISOString();
  const updatedOrder = await updateOrderRecord(order.orderId, {
    paymentStatus: 'paid',
    orderStatus: 'processing',
    status: 'processing',
    paidAt,
    metadata: {
      ...(order.metadata || {}),
      bankTransferConfirmedBy: normalizeEmail(ctx.current?.email || ''),
      bankTransferConfirmedAt: paidAt
    }
  });

  if (updatedOrder?.discountCode) {
    const subscribers = await readSubscribers();
    const matched = findSubscriberByCode(subscribers, updatedOrder.discountCode);
    if (matched && !matched.discountUsed) {
      await markDiscountCodeUsed(subscribers, updatedOrder.customerEmail, updatedOrder.orderId);
    }
  }

  await recordCouponRedemption({
    code: updatedOrder?.discountCode,
    userId: updatedOrder?.customerId,
    email: updatedOrder?.customerEmail
  });
  const confirmedOrder = await maybeSendOrderConfirmationEmail(updatedOrder, 'bank-transfer-confirmed');

  res.json({
    success: true,
    order: confirmedOrder
  });
}));

// ============ ADMIN USERS API ============
app.get('/api/admin/users', authMiddleware, asyncHandler(async (req, res) => {
  const ctx = await requireHost(req, res);
  if (!ctx) return;

  const users = ctx.users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === 'host' ? 'host' : 'resident',
    phone: String(user.phone || ''),
    createdAt: user.createdAt,
    addressesCount: Array.isArray(user.addresses) ? user.addresses.length : 0
  }));

  res.json({ users });
}));

app.delete('/api/admin/users/:id', authMiddleware, asyncHandler(async (req, res) => {
  const ctx = await requireHost(req, res);
  if (!ctx) return;

  const targetId = String(req.params.id || '').trim();
  if (!targetId) return res.status(400).json({ error: 'User id is required.' });

  if (String(ctx.current.id) === targetId) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }

  const next = ctx.users.filter((user) => String(user.id) !== targetId);
  if (next.length === ctx.users.length) {
    return res.status(404).json({ error: 'User not found.' });
  }

  await writeUsers(next);
  res.json({ success: true });
}));

// ============ GEO LOOKUP API ============
app.get('/api/geo/countries', async (req, res) => {
  try {
    const data = await getCountryStates();
    const countries = data.map(entry => entry.name).sort();
    res.json({ success: true, countries });
  } catch (error) {
    res.status(502).json({ success: false, message: 'Unable to load countries.' });
  }
});

app.get('/api/geo/states', async (req, res) => {
  const country = String(req.query.country || '').trim();
  if (!country) {
    return res.status(400).json({ success: false, message: 'Country is required.' });
  }

  try {
    const data = await getCountryStates();
    const match = data.find(entry => entry.name.toLowerCase() === country.toLowerCase());
    const states = Array.isArray(match?.states)
      ? match.states.map(state => state.name).filter(Boolean)
      : [];
    res.json({ success: true, states });
  } catch (error) {
    res.status(502).json({ success: false, message: 'Unable to load states.' });
  }
});

app.get('/api/geo/cities', async (req, res) => {
  const country = String(req.query.country || '').trim();
  const state = String(req.query.state || '').trim();
  if (!country || !state) {
    return res.status(400).json({ success: false, message: 'Country and state are required.' });
  }

  try {
    const { cities, source } = await getCitiesWithFallback(country, state);
    res.json({ success: true, cities, source });
  } catch (error) {
    res.json({ success: false, cities: [], message: 'Unable to load cities.' });
  }
});

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    storage: {
      provider: 'mongodb',
      status: getMongoStatus(),
      database: getMongoConfig().dbName
    }
  });
});

app.get(['/admin', '/admin/login'], (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'Admin.html'));
});

app.get(['/admin/Account.html', '/admin/account.html'], (req, res) => {
  res.redirect(302, '/Account.html');
});

app.get([
  '/admin/dashboard',
  '/admin/products',
  '/admin/orders',
  '/admin/customers',
  '/admin/messages',
  '/admin/payments',
  '/admin/coupons',
  '/admin/settings',
  '/admin/content',
  '/admin/newsletter',
  '/admin/reviews',
  '/admin/team'
], (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'AdminDashboard.html'));
});

// Serve static files (HTML, CSS, JS)
app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.get(['/Welcome.html', '/Index.html'], (req, res) => {
  res.redirect(301, '/index.html');
});

// Legacy startup block kept disabled while the MongoDB-aware startup runs below.
if (false) app.listen(PORT, () => {
  console.log(`🚀 Benzy Luxury Server running at http://localhost:${PORT}`);
  console.log(`📦 API Endpoints:`);
  console.log(`   GET  /api/track-order/:orderId - Track an order`);
  console.log(`   POST /api/track-order         - Track with orderId and email`);
  console.log(`   GET  /api/orders/:email       - Get customer orders`);
  console.log(`   POST /api/orders              - Create a new order`);
  console.log(`   GET  /api/cart                - Get authenticated cart`);
  console.log(`   POST /api/cart/add            - Add item to authenticated cart`);
  console.log(`   PATCH /api/cart/item/:id      - Update cart item quantity`);
  console.log(`   DELETE /api/cart/item/:id     - Remove cart item`);
  console.log(`   DELETE /api/cart/clear        - Clear authenticated cart`);
  console.log(`   POST /api/newsletter/subscribe - Subscribe footer email`);
  console.log(`   POST /api/contact-messages     - Save contact form messages`);
  console.log(`   POST /api/giveaway/enter       - Add giveaway lead to Brevo`);
  console.log(`   POST /api/vip/upgrade          - Add VIP contact to Brevo`);
  console.log(`   POST /api/coupons/validate    - Validate first-order coupon`);
  console.log(`   GET  /api/settings/shipping   - Get shipping fee (NGN)`);
  console.log(`   PATCH /api/settings/shipping  - Update shipping fee (host)`);
});

app.use((error, req, res, next) => {
  console.error('Unhandled API error:', error);
  if (res.headersSent) {
    return next(error);
  }

  res.status(Number(error?.status) || 500).json({
    success: false,
    message: error?.message || 'Internal server error.'
  });
});

async function handleStartupFailure(error) {
  if (error?.code === 'EADDRINUSE') {
    const numericPort = Number(PORT);
    const suggestedPort = Number.isInteger(numericPort) ? numericPort + 1 : 3001;
    console.error(`Port ${PORT} is already in use.`);
    console.error(`Another process is already listening on http://localhost:${PORT}.`);
    console.error(`Stop the running server first, or set PORT=${suggestedPort} before starting the server.`);
  } else {
    console.error('Failed to start Benzy Luxury server:', error);
  }

  try {
    await closeMongo();
  } catch (closeError) {
    console.error('Failed to close MongoDB after startup error:', closeError);
  }

  try {
    await closeCartSystem();
  } catch (closeError) {
    console.error('Failed to close cart system after startup error:', closeError);
  }

  process.exit(1);
}

async function startServer() {
  try {
    await initializeMongo();
    await initializeMongoSeedData();
    await initializeCartSystem();

    await new Promise((resolve, reject) => {
      const server = app.listen(PORT);

      server.once('error', reject);
      server.once('listening', () => {
        console.log(`Benzy Luxury Server running at http://localhost:${PORT}`);
        console.log(`MongoDB database: ${getMongoConfig().dbName}`);
        console.log(`API Endpoints:`);
        console.log(`   GET  /api/track-order/:orderId - Track an order`);
        console.log(`   POST /api/track-order         - Track with orderId and email`);
        console.log(`   GET  /api/orders/:email       - Get customer orders`);
        console.log(`   POST /api/orders              - Create a new order`);
        console.log(`   GET  /api/cart                - Get authenticated cart`);
        console.log(`   POST /api/cart/sync           - Sync authenticated cart snapshot`);
        console.log(`   POST /api/cart/merge          - Merge guest cart into authenticated cart`);
        console.log(`   POST /api/cart/add            - Add item to authenticated cart`);
        console.log(`   PATCH /api/cart/item/:id      - Update cart item quantity`);
        console.log(`   DELETE /api/cart/item/:id     - Remove cart item`);
        console.log(`   DELETE /api/cart/clear        - Clear authenticated cart`);
        console.log(`   POST /api/cart/apply-coupon   - Apply coupon to cart`);
        console.log(`   DELETE /api/cart/remove-coupon - Remove applied coupon`);
        console.log(`   POST /api/cart/checkout/validate - Validate cart before payment`);
        console.log(`   POST /api/newsletter/subscribe - Subscribe footer email`);
        console.log(`   POST /api/contact-messages     - Save contact form messages`);
        console.log(`   POST /api/giveaway/enter       - Add giveaway lead to Brevo`);
        console.log(`   POST /api/vip/upgrade          - Add VIP contact to Brevo`);
        console.log(`   POST /api/webhooks/brevo       - Receive Brevo delivery webhooks`);
        console.log(`   POST /api/coupons/validate    - Validate first-order coupon`);
        console.log(`   GET  /api/settings/shipping   - Get shipping fee (NGN)`);
        console.log(`   PATCH /api/settings/shipping  - Update shipping fee (host)`);
        resolve(server);
      });
    });
  } catch (error) {
    await handleStartupFailure(error);
  }
}

process.on('SIGINT', async () => {
  await closeMongo();
  await closeCartSystem();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeMongo();
  await closeCartSystem();
  process.exit(0);
});

startServer();
