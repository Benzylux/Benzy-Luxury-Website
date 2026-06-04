const crypto = require('crypto');
const https = require('https');

const BREVO_HOSTNAME = 'api.brevo.com';
const DEFAULT_BREVO_REQUEST_TIMEOUT_MS = 15000;

const BREVO_LIST_ENV_KEYS = Object.freeze({
  newsletter: 'BREVO_LIST_NEWSLETTER',
  customers: 'BREVO_LIST_CUSTOMERS',
  vip: 'BREVO_LIST_VIP',
  abandoned_cart: 'BREVO_LIST_ABANDONED_CART',
  giveaway: 'BREVO_LIST_GIVEAWAY',
  influencers: 'BREVO_LIST_INFLUENCERS',
  wholesale: 'BREVO_LIST_WHOLESALE',
  support: 'BREVO_LIST_SUPPORT',
  preorder: 'BREVO_LIST_PREORDER',
  events: 'BREVO_LIST_EVENTS',
  wallet_top_up: 'BREVO_LIST_WALLET_TOP_UP'
});

const DEFAULT_BREVO_LIST_IDS = Object.freeze({
  newsletter: 3,
  customers: 4,
  vip: 5,
  abandoned_cart: 6,
  giveaway: 7,
  influencers: 8,
  wholesale: 9,
  support: 10,
  preorder: 11,
  events: 12,
  wallet_top_up: 13
});

const LEGACY_BREVO_LIST_ENV_KEYS = Object.freeze({
  newsletter: 'BREVO_NEWSLETTER_LIST_ID',
  customers: 'BREVO_CUSTOMERS_LIST_ID',
  giveaway: 'BREVO_GIVEAWAY_LIST_ID'
});

const BREVO_ATTRIBUTE_ALIASES = Object.freeze({
  source: 'SOURCE',
  signup_location: 'SIGNUP_LOCATION',
  customer_status: 'CUSTOMER_STATUS',
  vip_status: 'VIP_STATUS',
  campaign_name: 'CAMPAIGN_NAME',
  order_count: 'ORDER_COUNT',
  last_order_date: 'LAST_ORDER_DATE',
  tags: 'TAGS'
});

class BrevoError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'BrevoError';
    this.statusCode = Number(options.statusCode) || 500;
    this.details = options.details || null;
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function sanitizePlainText(value, maxLength = 160) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function toPositiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeListKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function normalizeAttributeKey(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const normalized = trimmed
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();

  return BREVO_ATTRIBUTE_ALIASES[normalized] || normalized.toUpperCase();
}

function getBrevoListConfig() {
  const lists = {};

  for (const [key, envKey] of Object.entries(BREVO_LIST_ENV_KEYS)) {
    const legacyEnvKey = LEGACY_BREVO_LIST_ENV_KEYS[key];
    lists[key] = toPositiveInteger(
      process.env[envKey]
      || process.env[legacyEnvKey]
      || DEFAULT_BREVO_LIST_IDS[key]
      || ''
    );
  }

  return lists;
}

function getBrevoConfig() {
  const lists = getBrevoListConfig();
  const requestTimeoutMs = Number.parseInt(String(process.env.BREVO_REQUEST_TIMEOUT_MS || ''), 10);

  return {
    apiKey: String(process.env.BREVO_API_KEY || '').trim(),
    senderEmail: normalizeEmail(process.env.BREVO_SENDER_EMAIL || ''),
    senderName: sanitizePlainText(process.env.BREVO_SENDER_NAME || 'Benzy Luxury', 80),
    requestTimeoutMs: Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0
      ? requestTimeoutMs
      : DEFAULT_BREVO_REQUEST_TIMEOUT_MS,
    lists,
    newsletterListId: lists.newsletter || null,
    customersListId: lists.customers || null,
    vipListId: lists.vip || null,
    abandonedCartListId: lists.abandoned_cart || null,
    giveawayListId: lists.giveaway || null,
    influencersListId: lists.influencers || null,
    wholesaleListId: lists.wholesale || null,
    supportListId: lists.support || null,
    preorderListId: lists.preorder || null,
    eventsListId: lists.events || null,
    walletTopUpListId: lists.wallet_top_up || null
  };
}

function isBrevoConfigured() {
  const config = getBrevoConfig();
  return Boolean(config.apiKey && config.senderEmail && config.senderName);
}

function requireBrevoConfig(requiredKeys = []) {
  const config = getBrevoConfig();
  const missing = requiredKeys.filter((key) => !config[key]);

  if (missing.length) {
    throw new BrevoError(
      `Brevo is not configured. Missing: ${missing.join(', ')}.`,
      {
        statusCode: 503,
        details: { missing }
      }
    );
  }

  return config;
}

function getBrevoListId(listKey) {
  const safeKey = normalizeListKey(listKey);
  if (!safeKey) {
    throw new BrevoError('A Brevo list key is required.', {
      statusCode: 400
    });
  }

  const config = getBrevoConfig();
  const listId = config.lists[safeKey];
  if (!listId) {
    throw new BrevoError(`Brevo list is not configured for "${safeKey}".`, {
      statusCode: 503,
      details: {
        listKey: safeKey,
        envKey: BREVO_LIST_ENV_KEYS[safeKey] || null
      }
    });
  }

  return listId;
}

function sendBrevoRequest({ method = 'POST', path, body }) {
  const config = requireBrevoConfig(['apiKey']);

  return new Promise((resolve, reject) => {
    let settled = false;
    let request = null;
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      callback(value);
    };
    const timeoutHandle = setTimeout(() => {
      if (request) {
        request.destroy(
          new BrevoError('Brevo request timed out.', {
            statusCode: 504,
            details: { timeoutMs: config.requestTimeoutMs }
          })
        );
      }
    }, config.requestTimeoutMs);

    request = https.request(
      {
        hostname: BREVO_HOSTNAME,
        path,
        method,
        headers: {
          accept: 'application/json',
          'api-key': config.apiKey,
          'content-type': 'application/json'
        },
        timeout: config.requestTimeoutMs
      },
      (response) => {
        let rawBody = '';

        response.on('data', (chunk) => {
          rawBody += chunk;
        });

        response.on('end', () => {
          let parsedBody = {};

          if (rawBody) {
            try {
              parsedBody = JSON.parse(rawBody);
            } catch {
              parsedBody = { message: rawBody };
            }
          }

          const statusCode = response.statusCode || 500;
          if (statusCode >= 200 && statusCode < 300) {
            settle(resolve, { statusCode, data: parsedBody });
            return;
          }

          settle(
            reject,
            new BrevoError(
              parsedBody.message || parsedBody.code || 'Brevo request failed.',
              {
                statusCode,
                details: parsedBody
              }
            )
          );
        });
      }
    );

    request.on('error', (error) => {
      if (error instanceof BrevoError) {
        settle(reject, error);
        return;
      }

      settle(
        reject,
        new BrevoError(error.message || 'Unable to reach Brevo.', {
          statusCode: 502
        })
      );
    });

    request.on('timeout', () => {
      request.destroy(
        new BrevoError('Brevo request timed out.', {
          statusCode: 504,
          details: { timeoutMs: config.requestTimeoutMs }
        })
      );
    });

    if (body) {
      request.write(JSON.stringify(body));
    }

    request.end();
  });
}

function normalizeContactAttributes(attributes) {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    return {};
  }

  const normalized = {};

  for (const [rawKey, rawValue] of Object.entries(attributes)) {
    const key = normalizeAttributeKey(rawKey);
    if (!key) continue;
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    if (Array.isArray(rawValue)) {
      normalized[key] = rawValue
        .map((entry) => sanitizePlainText(entry, 120))
        .filter(Boolean);
      continue;
    }

    if (typeof rawValue === 'boolean' || typeof rawValue === 'number') {
      normalized[key] = rawValue;
      continue;
    }

    normalized[key] = sanitizePlainText(rawValue, 160);
  }

  return normalized;
}

function buildContactAttributes(attributes, tags) {
  const nextAttributes = normalizeContactAttributes(attributes);
  const normalizedTags = Array.isArray(tags)
    ? tags.map((tag) => sanitizePlainText(tag, 60)).filter(Boolean)
    : [];

  if (!normalizedTags.length) {
    return nextAttributes;
  }

  if (Array.isArray(nextAttributes.TAGS)) {
    nextAttributes.TAGS = Array.from(new Set([...nextAttributes.TAGS, ...normalizedTags]));
  } else if (typeof nextAttributes.TAGS === 'string' && nextAttributes.TAGS) {
    nextAttributes.TAGS = Array.from(new Set([
      nextAttributes.TAGS,
      ...normalizedTags
    ]));
  } else {
    nextAttributes.TAGS = normalizedTags;
  }

  return nextAttributes;
}

function resolveBrevoListIds(options = {}, config = getBrevoConfig()) {
  const directIds = Array.isArray(options.listIds)
    ? options.listIds.map((entry) => toPositiveInteger(entry)).filter(Boolean)
    : [];
  const explicitListId = toPositiveInteger(options.listId);

  const normalizedListKeys = [
    options.listKey,
    ...(Array.isArray(options.listKeys) ? options.listKeys : [])
  ]
    .map((entry) => normalizeListKey(entry))
    .filter(Boolean);

  const keyedIds = normalizedListKeys.map((key) => {
    const listId = config.lists[key];
    if (!listId) {
      throw new BrevoError(`Brevo list is not configured for "${key}".`, {
        statusCode: 503,
        details: {
          listKey: key,
          envKey: BREVO_LIST_ENV_KEYS[key] || null
        }
      });
    }
    return listId;
  });

  const fallbackIds = explicitListId || directIds.length || keyedIds.length || !config.lists.newsletter
    ? []
    : [config.lists.newsletter];

  return Array.from(new Set([
    explicitListId,
    ...directIds,
    ...keyedIds,
    ...fallbackIds
  ].filter(Boolean)));
}

function buildRecipient(email, name) {
  const safeEmail = normalizeEmail(email);
  if (!isValidEmail(safeEmail)) {
    throw new BrevoError('A valid recipient email is required.', {
      statusCode: 400
    });
  }

  const recipient = { email: safeEmail };
  const safeName = sanitizePlainText(name, 80);
  if (safeName) {
    recipient.name = safeName;
  }

  return recipient;
}

function getGreetingName(name, email) {
  const safeName = sanitizePlainText(name, 80);
  if (safeName) return safeName;

  const localPart = normalizeEmail(email).split('@')[0] || 'there';
  return sanitizePlainText(localPart.replace(/[._-]+/g, ' '), 80) || 'there';
}

function formatCurrency(amount, currency) {
  const safeCurrency = String(currency || 'NGN').trim().toUpperCase() || 'NGN';
  const numericAmount = Number(amount || 0);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;

  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits: 2
    }).format(safeAmount);
  } catch {
    return `${safeCurrency} ${safeAmount.toFixed(2)}`;
  }
}

function formatDate(value) {
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
    process.env.BREVO_PUBLIC_BASE_URL
    || process.env.PUBLIC_SITE_URL
    || process.env.SITE_URL
    || process.env.PAYSTACK_CALLBACK_BASE_URL
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

function formatLabel(value, fallback = 'Pending') {
  const safeValue = sanitizePlainText(value, 80);
  if (!safeValue) return fallback;

  return safeValue
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ') || fallback;
}

function resolveEmailImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const normalized = raw.replace(/^\.?\//, '').replace(/\\/g, '/');
  return buildPublicUrl(`/${normalized}`);
}

function buildItemsTableRows(items, currency) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const name = escapeHtml(
        sanitizePlainText(item?.title || item?.name || 'Item', 120)
      );
      const quantity = Math.max(1, Number.parseInt(String(item?.quantity || item?.qty || 1), 10) || 1);
      const unitAmount = Number(item?.price ?? item?.priceNgn ?? item?.priceUsd ?? 0) || 0;
      const price = formatCurrency(unitAmount, currency);
      const lineTotal = formatCurrency(unitAmount * quantity, currency);
      const imageUrl = resolveEmailImageUrl(item?.image || item?.imageUrl || item?.thumbnail || '');
      const options = [
        item?.size ? `Size: ${sanitizePlainText(item.size, 30)}` : '',
        item?.color ? `Color: ${sanitizePlainText(item.color, 40)}` : ''
      ].filter(Boolean).join(' | ');

      return `
        <tr>
          <td style="padding:16px 0;border-bottom:1px solid #e5e5e5;color:#111111;">
            <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr>
                ${imageUrl ? `<td style="width:74px;padding-right:14px;vertical-align:top;"><img src="${escapeHtml(imageUrl)}" alt="${name}" width="62" height="74" style="display:block;width:62px;height:74px;object-fit:cover;border:1px solid #eeeeee;"></td>` : ''}
                <td style="vertical-align:top;">
                  <div style="font-size:15px;font-weight:700;line-height:1.45;text-transform:uppercase;">${name}</div>
                  ${options ? `<div style="margin-top:4px;font-size:12px;line-height:1.5;color:#777777;">${escapeHtml(options)}</div>` : ''}
                  <div style="margin-top:7px;font-size:13px;color:#333333;">Qty: ${quantity}</div>
                </td>
              </tr>
            </table>
          </td>
          <td style="padding:16px 0;border-bottom:1px solid #e5e5e5;color:#111111;text-align:right;font-size:14px;font-weight:700;white-space:nowrap;">${escapeHtml(lineTotal)}</td>
        </tr>
      `;
    })
    .join('');
}

async function addContactToBrevo(email, options = {}) {
  const config = requireBrevoConfig(['apiKey']);
  const safeEmail = normalizeEmail(email);
  const listIds = resolveBrevoListIds(options, config);

  if (!isValidEmail(safeEmail)) {
    throw new BrevoError('A valid contact email is required.', {
      statusCode: 400
    });
  }

  if (!listIds.length) {
    throw new BrevoError('Brevo list ID is not configured.', {
      statusCode: 503
    });
  }

  const attributes = buildContactAttributes(options.attributes, options.tags);
  const payload = {
    email: safeEmail,
    listIds,
    updateEnabled: options.updateEnabled !== false
  };

  if (Object.keys(attributes).length) {
    payload.attributes = attributes;
  }

  const response = await sendBrevoRequest({
    path: '/v3/contacts',
    method: 'POST',
    body: payload
  });

  return {
    email: safeEmail,
    listIds,
    primaryListId: listIds[0] || null,
    contactId: response.data?.id || null,
    statusCode: response.statusCode
  };
}

async function addContactToBrevoList(listKey, email, options = {}) {
  return addContactToBrevo(email, {
    ...options,
    listKey
  });
}

function createListHelper(listKey) {
  return function addContactForList(email, options = {}) {
    return addContactToBrevoList(listKey, email, options);
  };
}

const addNewsletterContact = createListHelper('newsletter');
const addCustomerContact = createListHelper('customers');
const addVipContact = createListHelper('vip');
const addAbandonedCartContact = createListHelper('abandoned_cart');
const addGiveawayContact = createListHelper('giveaway');
const addInfluencerContact = createListHelper('influencers');
const addWholesaleContact = createListHelper('wholesale');
const addSupportContact = createListHelper('support');
const addPreorderContact = createListHelper('preorder');
const addEventsContact = createListHelper('events');
const addWalletTopUpContact = createListHelper('wallet_top_up');

async function sendTransactionalEmail({
  toEmail,
  toName,
  subject,
  htmlContent,
  textContent,
  attachments,
  tags,
  templateId,
  params
}) {
  const config = requireBrevoConfig(['apiKey', 'senderEmail', 'senderName']);
  const resolvedTemplateId = toPositiveInteger(templateId);

  if (!resolvedTemplateId && !sanitizePlainText(subject, 160)) {
    throw new BrevoError('A transactional email subject is required.', {
      statusCode: 400
    });
  }

  const payload = {
    sender: {
      email: config.senderEmail,
      name: config.senderName
    },
    to: [buildRecipient(toEmail, toName)]
  };

  if (resolvedTemplateId) {
    payload.templateId = resolvedTemplateId;
    if (params && typeof params === 'object' && !Array.isArray(params)) {
      payload.params = params;
    }
  } else {
    payload.subject = sanitizePlainText(subject, 160);
    payload.htmlContent = String(htmlContent || '').trim();
    payload.textContent = String(textContent || '').trim();
  }

  if (Array.isArray(tags) && tags.length) {
    payload.tags = tags
      .map((tag) => sanitizePlainText(tag, 60))
      .filter(Boolean);
  }

  if (Array.isArray(attachments) && attachments.length) {
    payload.attachment = attachments
      .map((attachment) => ({
        name: sanitizePlainText(attachment?.name || 'attachment.txt', 160),
        content: String(attachment?.content || '').trim()
      }))
      .filter((attachment) => attachment.name && attachment.content);
  }

  const response = await sendBrevoRequest({
    path: '/v3/smtp/email',
    method: 'POST',
    body: payload
  });

  return {
    messageId: String(response.data?.messageId || '').trim(),
    statusCode: response.statusCode
  };
}

function buildMarketingFooter(options = {}) {
  const unsubscribeUrl = String(options.unsubscribeUrl || '').trim();
  const preferenceUrl = String(options.preferenceUrl || unsubscribeUrl || '').trim();

  if (!unsubscribeUrl && !preferenceUrl) return { html: '', text: '' };

  const links = [
    preferenceUrl
      ? `<a href="${escapeHtml(preferenceUrl)}" style="color:#6b5a4d;text-decoration:underline;">manage preferences</a>`
      : '',
    unsubscribeUrl
      ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b5a4d;text-decoration:underline;">unsubscribe</a>`
      : ''
  ].filter(Boolean).join(' or ');

  return {
    html: `
      <p style="margin:20px 0 0;font-size:12px;line-height:1.7;color:#6b5a4d;">
        You are receiving this because you subscribed to Benzy Luxury updates.
        ${links ? `You can ${links} at any time.` : ''}
      </p>
    `,
    text: [
      'You are receiving this because you subscribed to Benzy Luxury updates.',
      preferenceUrl ? `Manage preferences: ${preferenceUrl}` : '',
      unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : ''
    ].filter(Boolean).join('\n')
  };
}

async function sendWelcomeEmail(email, name = '', options = {}) {
  const config = getBrevoConfig();
  const greetingName = getGreetingName(name, email);
  const discountCode = sanitizePlainText(options.discountCode || '', 40);
  const subscribedAt = formatDate(options.subscribedAt || new Date().toISOString());
  const shopUrl = String(options.shopUrl || buildPublicUrl('/Shop.html?cat=all')).trim();
  const lookbookUrl = String(options.lookbookUrl || buildPublicUrl('/Lookbook.html')).trim();
  const supportEmail = config.senderEmail;
  const marketingFooter = buildMarketingFooter(options);
  const subject = discountCode
    ? 'Welcome to Benzy Luxury | Your 10% code is inside'
    : 'Welcome to Benzy Luxury';
  const codeBlock = discountCode
    ? `
      <div style="margin:24px 0;padding:18px 20px;border:1px dashed #7a5c43;border-radius:12px;background:#f8f1eb;text-align:center;">
        <div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#7a5c43;">Your subscriber code</div>
        <div style="margin-top:10px;font-size:28px;font-weight:700;letter-spacing:0.08em;color:#231711;">${escapeHtml(discountCode)}</div>
        <div style="margin-top:10px;font-size:14px;line-height:1.7;color:#6b5a4d;">Use this at checkout with the same email address you subscribed with.</div>
      </div>
    `
    : '';
  const ctaBlock = shopUrl
    ? `
      <div style="margin:0 0 24px;">
        <a href="${escapeHtml(shopUrl)}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#231711;color:#f6f0ea;text-decoration:none;font-weight:700;letter-spacing:0.04em;">Shop the latest drop</a>
      </div>
    `
    : '';
  const quickLinksBlock = [
    shopUrl
      ? `<a href="${escapeHtml(shopUrl)}" style="display:inline-block;margin:0 10px 10px 0;padding:10px 16px;border-radius:999px;border:1px solid #d8c4b3;color:#231711;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.04em;">Shop all</a>`
      : '',
    lookbookUrl
      ? `<a href="${escapeHtml(lookbookUrl)}" style="display:inline-block;margin:0 10px 10px 0;padding:10px 16px;border-radius:999px;border:1px solid #d8c4b3;color:#231711;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.04em;">View lookbook</a>`
      : ''
  ]
    .filter(Boolean)
    .join('');
  const supportBlock = supportEmail
    ? `
      <p style="margin:20px 0 0;font-size:15px;line-height:1.7;color:#6b5a4d;">
        Need help before your first order? Reach us at
        <a href="mailto:${escapeHtml(supportEmail)}" style="color:#231711;font-weight:700;text-decoration:none;">${escapeHtml(supportEmail)}</a>.
      </p>
    `
    : '';
  const htmlContent = `
    <div style="margin:0;padding:32px 16px;background:#f6f0ea;font-family:Arial,sans-serif;color:#231711;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #eadfd3;">
        <div style="padding:28px 32px;background:#231711;color:#f6f0ea;">
          <div style="font-size:12px;letter-spacing:0.26em;text-transform:uppercase;opacity:0.78;">Benzy Luxury</div>
          <h1 style="margin:12px 0 0;font-size:30px;line-height:1.2;">Welcome inside</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hi ${escapeHtml(greetingName)},</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Thanks for subscribing to Benzy Luxury updates. You are now on the list for new drops, private offers, and brand moments we share first with our insiders.</p>
          ${codeBlock}
          ${ctaBlock}
          <div style="margin:0 0 24px;padding:20px;border-radius:16px;background:#fcf8f3;border:1px solid #eadfd3;">
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7a5c43;">What to expect</div>
            <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#231711;">Early access to fresh drops, restocks, and key product releases.</p>
            <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:#231711;">Private offers reserved for subscribers and returning customers.</p>
            <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:#231711;">Styling notes, campaign previews, and standout pieces before they move.</p>
          </div>
          ${quickLinksBlock ? `<div style="margin:0 0 20px;">${quickLinksBlock}</div>` : ''}
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Subscription recorded on ${escapeHtml(subscribedAt)}.</p>
          ${supportBlock}
          <p style="margin:0;font-size:15px;line-height:1.7;color:#6b5a4d;">If you did not request this, you can ignore this email.</p>
          ${marketingFooter.html}
        </div>
      </div>
    </div>
  `;
  const textContent = [
    `Hi ${greetingName},`,
    '',
    'Thanks for subscribing to Benzy Luxury updates.',
    'You are now on the list for new drops, private offers, and brand updates.',
    discountCode ? `Your 10% code: ${discountCode}` : '',
    discountCode ? 'Use this code at checkout with the same email address you subscribed with.' : '',
    '',
    'What to expect:',
    '- Early access to fresh drops and restocks',
    '- Private offers for subscribers',
    '- Styling notes and campaign previews',
    '',
    shopUrl ? `Shop the latest drop: ${shopUrl}` : '',
    lookbookUrl ? `View the lookbook: ${lookbookUrl}` : '',
    supportEmail ? `Need help? Contact us at ${supportEmail}.` : '',
    '',
    `Subscription recorded on ${subscribedAt}.`,
    '',
    marketingFooter.text,
    '',
    'If you did not request this, you can ignore this email.'
  ]
    .filter(Boolean)
    .join('\n');

  return sendTransactionalEmail({
    toEmail: email,
    toName: greetingName,
    subject,
    htmlContent,
    textContent,
    tags: ['newsletter', 'welcome']
  });
}

function buildOrderReceiptAttachment(orderData = {}, currency = 'NGN') {
  const orderId = sanitizePlainText(orderData?.orderId || orderData?.id || 'order', 80) || 'order';
  const safeOrderId = orderId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'order';
  const pdf = buildInvoiceReceiptPdf(orderData, currency);

  return {
    name: `invoice-${safeOrderId}.pdf`,
    content: pdf.toString('base64')
  };
}

function formatReceiptMoney(amount, currency = 'NGN') {
  const safeCurrency = sanitizePdfText(currency || 'NGN') || 'NGN';
  const numeric = Number(amount || 0);
  const safeAmount = Number.isFinite(numeric) ? numeric : 0;
  return `${safeCurrency} ${safeAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function getReceiptCustomerName(orderData = {}) {
  return sanitizePlainText(
    orderData?.customer?.name
    || orderData?.customerName
    || orderData?.name
    || 'Customer',
    120
  );
}

function getReceiptShippingAddress(orderData = {}) {
  const direct = sanitizePlainText(orderData?.shippingAddress || '', 260);
  if (direct) return direct;

  const customer = orderData?.customer && typeof orderData.customer === 'object' ? orderData.customer : {};
  return [
    customer.address,
    customer.line1,
    customer.city,
    customer.state,
    customer.country
  ].map((entry) => sanitizePlainText(entry || '', 120)).filter(Boolean).join(', ') || 'Delivery address to be confirmed.';
}

function truncatePdfText(value, maxLength = 90) {
  const safeValue = sanitizePdfText(value);
  if (safeValue.length <= maxLength) return safeValue;
  return `${safeValue.slice(0, Math.max(0, maxLength - 3))}...`;
}

function buildBarcodeCommands(value, x, y, height) {
  const hash = crypto.createHash('sha256').update(String(value || 'BENZY')).digest('hex');
  const commands = [];
  let cursor = x;

  for (let index = 0; index < 48; index += 1) {
    const nibble = Number.parseInt(hash[index % hash.length], 16);
    const width = nibble % 3 === 0 ? 1 : nibble % 3 === 1 ? 2 : 3;
    if (index % 2 === 0 || nibble > 7) {
      commands.push(`${cursor} ${y} ${width} ${height} re f`);
    }
    cursor += width + 2;
  }

  return commands;
}

function buildInvoiceReceiptPdf(orderData = {}, currency = 'NGN') {
  const pageWidth = 612;
  const pageHeight = 792;
  const orderId = sanitizePdfText(orderData?.orderId || orderData?.id || 'Pending');
  const customerName = getReceiptCustomerName(orderData);
  const customerEmail = normalizeEmail(orderData?.customerEmail || orderData?.customer?.email || '');
  const customerPhone = sanitizePlainText(orderData?.customerPhone || orderData?.customer?.phone || '', 40);
  const shippingAddress = getReceiptShippingAddress(orderData);
  const createdAt = formatDate(orderData?.paidAt || orderData?.createdAt || orderData?.updatedAt || new Date().toISOString());
  const status = formatLabel(orderData?.paymentStatus || orderData?.orderStatus || orderData?.status || 'paid', 'Paid');
  const subtotal = Number(orderData?.subtotal || 0);
  const discount = Number(orderData?.discountAmount || orderData?.discount || 0);
  const tax = Number(orderData?.tax || 0);
  const shipping = Number(orderData?.shipping || 0);
  const total = Number(orderData?.total || 0);
  const paymentMethod = sanitizePdfText(orderData?.paymentMethod || 'Online payment');
  const paymentReference = sanitizePdfText(orderData?.paymentReference || orderData?.transactionId || orderId);
  const items = Array.isArray(orderData?.items) ? orderData.items : [];
  const commands = [];

  const text = (x, y, size, value, font = 'F1') => {
    commands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`);
  };
  const estimateTextWidth = (value, size) => sanitizePdfText(value).length * size * 0.52;
  const textRight = (rightX, y, size, value, font = 'F1') => {
    text(Math.max(28, rightX - estimateTextWidth(value, size)), y, size, value, font);
  };
  const textCenter = (centerX, y, size, value, font = 'F1') => {
    text(Math.max(28, centerX - (estimateTextWidth(value, size) / 2)), y, size, value, font);
  };
  const line = (x1, y1, x2, y2, width = 0.6) => {
    commands.push(`${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  };
  const rect = (x, y, width, height, stroke = true) => {
    commands.push(`${x} ${y} ${width} ${height} re ${stroke ? 'S' : 'f'}`);
  };

  commands.push('1 1 1 rg 0 0 612 792 re f 0 0 0 rg');

  rect(36, 712, 56, 56);
  text(44, 747, 14, 'BENZY', 'F2');
  text(48, 730, 14, 'LUX', 'F2');
  text(108, 756, 20, 'BENZY LUXURY', 'F2');
  text(108, 737, 10, 'benzyluxury.com.ng');
  text(108, 721, 10, 'benzyluxury@gmail.com');
  text(108, 705, 10, '+2347011547813');

  textRight(576, 756, 18, 'Receipt', 'F2');
  textRight(576, 737, 10, 'Benzy Luxury,');
  textRight(576, 722, 10, 'Surulere Lagos,');
  textRight(576, 707, 10, 'Surulere, Lagos');
  textRight(576, 688, 10, `Order number: ${orderId}`);
  commands.push(...buildBarcodeCommands(orderId, 446, 655, 27));
  line(36, 632, 576, 632);

  text(38, 606, 10, 'Shipped To:', 'F2');
  text(38, 588, 12, customerName, 'F2');
  text(38, 570, 10, truncatePdfText(shippingAddress, 64));
  if (customerPhone) text(38, 554, 10, customerPhone);
  if (customerEmail) text(38, 538, 10, customerEmail);

  text(250, 606, 10, `Date Created: ${createdAt}`);
  text(250, 588, 10, 'Status :');
  text(296, 588, 10, status, 'F2');
  textRight(576, 606, 10, 'Total Paid');
  textRight(576, 582, 17, formatReceiptMoney(total, currency), 'F2');

  line(36, 520, 576, 520);
  text(40, 500, 9, 'ITEM DETAIL', 'F2');
  textCenter(390, 500, 9, 'QTY', 'F2');
  textRight(494, 500, 9, 'RATE', 'F2');
  textRight(576, 500, 9, 'AMOUNT', 'F2');
  line(36, 488, 576, 488);

  let y = 458;
  items.slice(0, 8).forEach((item) => {
    const quantity = Math.max(1, Number.parseInt(String(item?.quantity || item?.qty || 1), 10) || 1);
    const unitPrice = Number(item?.price ?? item?.priceNgn ?? item?.priceUsd ?? 0) || 0;
    const lineTotal = unitPrice * quantity;
    const itemName = sanitizePdfText(item?.title || item?.name || 'Item');
    const options = [
      item?.size ? `size: ${sanitizePdfText(item.size)}` : '',
      item?.color ? `colour: ${sanitizePdfText(item.color)}` : ''
    ].filter(Boolean).join(', ');

    rect(40, y - 9, 28, 28);
    text(78, y + 8, 10, truncatePdfText(`${itemName}${options ? ` ${options}` : ''}`, 58));
    textCenter(390, y + 8, 10, String(quantity));
    textRight(494, y + 8, 10, formatReceiptMoney(unitPrice, currency));
    textRight(576, y + 8, 10, formatReceiptMoney(lineTotal, currency));
    line(36, y - 26, 576, y - 26);
    y -= 46;
  });

  const totalsX = 370;
  const totalsValueX = 576;
  let totalsY = Math.min(430, y + 14);
  text(totalsX, totalsY, 10, 'Subtotal');
  textRight(totalsValueX, totalsY, 10, formatReceiptMoney(subtotal, currency));
  totalsY -= 22;
  text(totalsX, totalsY, 10, 'Discount');
  textRight(totalsValueX, totalsY, 10, `- ${formatReceiptMoney(discount, currency)}`);
  if (tax > 0) {
    totalsY -= 22;
    text(totalsX, totalsY, 10, 'Tax');
    textRight(totalsValueX, totalsY, 10, formatReceiptMoney(tax, currency));
  }
  if (shipping > 0) {
    totalsY -= 22;
    text(totalsX, totalsY, 10, 'Shipping');
    textRight(totalsValueX, totalsY, 10, formatReceiptMoney(shipping, currency));
  }
  totalsY -= 12;
  line(totalsX, totalsY, 576, totalsY);
  totalsY -= 22;
  text(totalsX, totalsY, 12, 'Total', 'F2');
  textRight(totalsValueX, totalsY, 12, formatReceiptMoney(total, currency), 'F2');
  totalsY -= 24;
  text(totalsX, totalsY, 11, 'Paid');
  textRight(totalsValueX, totalsY, 11, formatReceiptMoney(total, currency));

  const txnY = 238;
  line(36, txnY + 28, 576, txnY + 28);
  text(40, txnY + 10, 11, 'Transactions', 'F2');
  text(40, txnY - 12, 10, 'Payment number', 'F2');
  text(210, txnY - 12, 10, 'Payment mode', 'F2');
  text(342, txnY - 12, 10, 'Date', 'F2');
  textRight(576, txnY - 12, 10, 'Amount', 'F2');
  text(40, txnY - 38, 10, paymentReference || '1');
  text(210, txnY - 38, 10, paymentMethod);
  text(342, txnY - 38, 10, createdAt);
  textRight(576, txnY - 38, 10, formatReceiptMoney(total, currency));

  line(36, 74, 576, 74);
  textCenter(306, 58, 10, 'Thank you for doing business with us', 'F2');
  textCenter(306, 44, 8, 'Powered by Benzy Luxury | benzyluxury.com.ng');
  textCenter(306, 28, 8, 'Page 1', 'F2');

  return buildPdfFromContent(commands.join('\n'), pageWidth, pageHeight);
}

function sanitizePdfText(value) {
  return String(value || '')
    .replace(/\u20a6/g, 'NGN ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfText(value) {
  return sanitizePdfText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildSimpleReceiptPdf(lines) {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginLeft = 54;
  const lineHeight = 16;
  const maxLines = 42;
  const visibleLines = (Array.isArray(lines) ? lines : [])
    .flatMap((line) => {
      const safeLine = sanitizePdfText(line);
      if (safeLine.length <= 84) return [safeLine];
      const wrapped = [];
      for (let index = 0; index < safeLine.length; index += 84) {
        wrapped.push(safeLine.slice(index, index + 84));
      }
      return wrapped;
    })
    .slice(0, maxLines);

  if (visibleLines.length === maxLines && Array.isArray(lines) && lines.length > maxLines) {
    visibleLines[visibleLines.length - 1] = 'More receipt lines were omitted from this compact receipt.';
  }

  const content = [
    'BT',
    '/F2 18 Tf',
    `${marginLeft} 738 Td`,
    `(Benzy Luxury) Tj`,
    '/F1 11 Tf',
    '0 -24 Td',
    `(Order receipt) Tj`,
    ...visibleLines.flatMap((line, index) => [
      index === 0 ? '0 -28 Td' : `0 -${lineHeight} Td`,
      `(${escapePdfText(line)}) Tj`
    ]),
    'ET'
  ].join('\n');

  return buildPdfFromContent(content, pageWidth, pageHeight);
}

function buildPdfFromContent(content, pageWidth = 612, pageHeight = 792) {
  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };
  addObject('<< /Type /Catalog /Pages 2 0 R >>');
  addObject('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObject(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`);
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  addObject(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`);
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

async function sendOrderConfirmation(email, orderData = {}) {
  const config = getBrevoConfig();
  const currency = String(
    orderData?.currency
    || orderData?.settlementCurrency
    || 'NGN'
  ).trim().toUpperCase();
  const greetingName = getGreetingName(
    orderData?.customer?.name
    || orderData?.customerName
    || '',
    email
  );
  const orderId = sanitizePlainText(orderData?.orderId || orderData?.id || 'Pending', 60);
  const paymentMethod = sanitizePlainText(orderData?.paymentMethod || 'Online payment', 80);
  const shippingAddress = sanitizePlainText(
    orderData?.shippingAddress
    || orderData?.customer?.address
    || 'We will confirm your delivery details shortly.',
    220
  );
  const orderDate = formatDate(
    orderData?.paidAt
    || orderData?.updatedAt
    || orderData?.createdAt
    || new Date().toISOString()
  );
  const orderStatus = formatLabel(orderData?.orderStatus || orderData?.status || 'processing', 'Processing');
  const estimatedDelivery = sanitizePlainText(orderData?.estimatedDelivery || '', 80);
  const paymentReference = sanitizePlainText(
    orderData?.paymentReference
    || orderData?.transactionId
    || '',
    80
  );
  const supportEmail = config.senderEmail;
  const profileUrl = String(orderData?.profileUrl || buildPublicUrl('/Profile.html')).trim();
  const shopUrl = String(orderData?.shopUrl || buildPublicUrl('/Shop.html?cat=all')).trim();
  const contactUrl = String(orderData?.contactUrl || buildPublicUrl('/Contact.html')).trim();
  const itemCount = (Array.isArray(orderData?.items) ? orderData.items : []).reduce((sum, item) => {
    const quantity = Math.max(1, Number.parseInt(String(item?.quantity || item?.qty || 1), 10) || 1);
    return sum + quantity;
  }, 0);
  const itemsRows = buildItemsTableRows(orderData?.items || [], currency);
  const subtotal = formatCurrency(orderData?.subtotal || 0, currency);
  const discount = formatCurrency(orderData?.discountAmount || orderData?.discount || 0, currency);
  const tax = formatCurrency(orderData?.tax || 0, currency);
  const shipping = formatCurrency(orderData?.shipping || 0, currency);
  const total = formatCurrency(orderData?.total || 0, currency);
  const summaryRows = [
    `<tr><td style="padding:7px 0;color:#666666;">Subtotal</td><td align="right" style="padding:7px 0;font-weight:700;color:#111111;">${escapeHtml(subtotal)}</td></tr>`,
    `<tr><td style="padding:7px 0;color:#666666;">Discount</td><td align="right" style="padding:7px 0;font-weight:700;color:#111111;">${escapeHtml(discount)}</td></tr>`,
    `<tr><td style="padding:7px 0;color:#666666;">Tax</td><td align="right" style="padding:7px 0;font-weight:700;color:#111111;">${escapeHtml(tax)}</td></tr>`,
    `<tr><td style="padding:7px 0;color:#666666;">Shipping</td><td align="right" style="padding:7px 0;font-weight:700;color:#111111;">${escapeHtml(shipping)}</td></tr>`
  ].join('');
  const ctaBlock = [
    profileUrl
      ? `<a href="${escapeHtml(profileUrl)}" style="display:inline-block;margin:0 10px 10px 0;padding:14px 22px;border-radius:999px;background:#231711;color:#f6f0ea;text-decoration:none;font-weight:700;">View orders</a>`
      : '',
    shopUrl
      ? `<a href="${escapeHtml(shopUrl)}" style="display:inline-block;margin:0 10px 10px 0;padding:14px 22px;border-radius:999px;border:1px solid #d8c4b3;color:#231711;text-decoration:none;font-weight:700;">Continue shopping</a>`
      : '',
    contactUrl
      ? `<a href="${escapeHtml(contactUrl)}" style="display:inline-block;margin:0 10px 10px 0;padding:14px 22px;border-radius:999px;border:1px solid #d8c4b3;color:#231711;text-decoration:none;font-weight:700;">Contact support</a>`
      : ''
  ]
    .filter(Boolean)
    .join('');
  const htmlContent = `
    <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111111;">
      <div style="max-width:720px;margin:0 auto;padding:28px 18px 34px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:28px;">
          <tr>
            <td align="left" style="vertical-align:middle;">
              <div style="width:64px;height:64px;border:2px solid #111111;border-radius:50%;font-size:14px;line-height:16px;font-weight:900;text-align:center;padding-top:14px;box-sizing:border-box;">BENZY<br>LUX</div>
            </td>
            <td align="right" style="vertical-align:middle;">
              <div style="font-family:Georgia,serif;font-size:28px;font-weight:700;font-style:italic;letter-spacing:0.04em;">Benzy Luxury</div>
              <a href="${escapeHtml(buildPublicUrl('/') || 'https://benzyluxury.com.ng')}" style="font-size:15px;color:#2b7de9;text-decoration:underline;">benzyluxury.com.ng</a>
            </td>
          </tr>
        </table>
        <h1 style="margin:0 0 22px;font-size:34px;line-height:1.15;color:#000000;">Thank you for your purchase!</h1>
        <p style="margin:0 0 20px;font-size:17px;line-height:1.7;">Hello ${escapeHtml(greetingName)},</p>
        <p style="margin:0 0 28px;font-size:17px;line-height:1.7;">Thank you for placing your order with us. Your payment has been received and your order is now being prepared.</p>

        <div style="border-top:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5;padding:20px 0;margin-bottom:22px;">
          <div style="font-size:28px;line-height:1.2;font-weight:800;">Order No: ${escapeHtml(orderId)}</div>
          <div style="margin-top:12px;font-size:16px;color:#777777;">Date: ${escapeHtml(orderDate)}</div>
          <div style="margin-top:8px;font-size:14px;color:#777777;">Status: ${escapeHtml(orderStatus)}${paymentReference ? ` | Reference: ${escapeHtml(paymentReference)}` : ''}</div>
        </div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:24px;">
            <thead>
              <tr>
                <th align="left" style="padding:0 0 10px;color:#777777;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Item</th>
                <th align="right" style="padding:0 0 10px;color:#777777;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows || `
                <tr>
                  <td colspan="2" style="padding:16px 0;border-bottom:1px solid #e5e5e5;color:#666666;">Your order items will appear here once available.</td>
                </tr>
              `}
            </tbody>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 26px;font-size:15px;">
            ${summaryRows}
            <tr><td style="padding:13px 0 0;border-top:1px solid #e5e5e5;font-size:20px;font-weight:800;">Total</td><td align="right" style="padding:13px 0 0;border-top:1px solid #e5e5e5;font-size:20px;font-weight:800;">${escapeHtml(total)}</td></tr>
          </table>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 26px;">
            <tr>
              <td width="50%" style="vertical-align:top;padding-right:12px;">
                <h2 style="margin:0 0 12px;font-size:20px;line-height:1.2;text-transform:uppercase;">Billing Info:</h2>
                <p style="margin:0;font-size:15px;line-height:1.65;color:#111111;">${escapeHtml(orderData?.customer?.phone || orderData?.customerPhone || '')}<br>${escapeHtml(shippingAddress)}</p>
              </td>
              <td width="50%" style="vertical-align:top;padding-left:12px;text-align:right;">
                <h2 style="margin:0 0 12px;font-size:20px;line-height:1.2;text-transform:uppercase;">Shipping Info:</h2>
                <p style="margin:0;font-size:15px;line-height:1.65;color:#111111;">${escapeHtml(orderData?.customer?.phone || orderData?.customerPhone || '')}<br>${escapeHtml(shippingAddress)}</p>
              </td>
            </tr>
          </table>

          ${ctaBlock ? `<div style="margin:0 0 24px;">${ctaBlock}</div>` : ''}
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">We will update you as your order moves. ${estimatedDelivery ? `Estimated delivery: ${escapeHtml(estimatedDelivery)}.` : ''}</p>
          ${supportEmail ? `
            <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#666666;">
              Questions about your order? Reach us at
              <a href="mailto:${escapeHtml(supportEmail)}" style="color:#111111;font-weight:700;text-decoration:none;">${escapeHtml(supportEmail)}</a>.
            </p>
          ` : ''}
          <div style="padding:28px 20px;background:#f7f7f7;text-align:center;color:#999999;">
            <div style="font-family:Georgia,serif;font-size:18px;font-style:italic;">Benzy Luxury</div>
            <a href="${escapeHtml(buildPublicUrl('/') || 'https://benzyluxury.com.ng')}" style="display:inline-block;margin-top:10px;color:#2b7de9;text-decoration:underline;">benzyluxury.com.ng</a>
          </div>
      </div>
    </div>
  `;
  const textContent = [
    `Hi ${greetingName},`,
    '',
    `Your Benzy Luxury order ${orderId} has been confirmed.`,
    `Paid on: ${orderDate}`,
    `Status: ${orderStatus}`,
    `Payment method: ${paymentMethod}`,
    paymentReference ? `Reference: ${paymentReference}` : '',
    itemCount ? `Items: ${itemCount}` : '',
    estimatedDelivery ? `Estimated delivery: ${estimatedDelivery}` : '',
    `Shipping address: ${shippingAddress}`,
    '',
    'Next steps:',
    `- Keep order ID ${orderId} for support and tracking`,
    estimatedDelivery
      ? `- Current delivery estimate: ${estimatedDelivery}`
      : '- Delivery timing will be updated as your order progresses',
    profileUrl ? `- View orders: ${profileUrl}` : '',
    shopUrl ? `- Continue shopping: ${shopUrl}` : '',
    contactUrl ? `- Contact support: ${contactUrl}` : '',
    supportEmail ? `- Support email: ${supportEmail}` : '',
    '',
    'Order summary:',
    ...(Array.isArray(orderData?.items) ? orderData.items : []).map((item) => {
      const itemName = sanitizePlainText(item?.title || item?.name || 'Item', 120);
      const quantity = Math.max(1, Number.parseInt(String(item?.quantity || item?.qty || 1), 10) || 1);
      const itemTotal = formatCurrency((Number(item?.price ?? item?.priceUsd ?? 0) || 0) * quantity, currency);
      return `- ${itemName} x${quantity}: ${itemTotal}`;
    }),
    '',
    `Subtotal: ${subtotal}`,
    `Discount: ${discount}`,
    `Tax: ${tax}`,
    `Shipping: ${shipping}`,
    `Total: ${total}`
  ]
    .filter(Boolean)
    .join('\n');

  return sendTransactionalEmail({
    toEmail: email,
    toName: greetingName,
    subject: `Order confirmed | ${orderId}`,
    htmlContent,
    textContent,
    attachments: [buildOrderReceiptAttachment(orderData, currency)],
    tags: ['orders', 'confirmation']
  });
}

async function sendOrderStatusUpdateEmail(email, orderData = {}, options = {}) {
  const config = getBrevoConfig();
  const greetingName = getGreetingName(orderData?.customer?.name || orderData?.customerName || '', email);
  const orderId = sanitizePlainText(orderData?.orderId || orderData?.id || 'Pending', 60);
  const status = formatLabel(orderData?.orderStatus || orderData?.status || 'processing', 'Processing');
  const previousStatus = formatLabel(options.previousStatus || '', '');
  const estimatedDelivery = sanitizePlainText(orderData?.estimatedDelivery || '', 80);
  const profileUrl = String(orderData?.profileUrl || buildPublicUrl('/Profile.html')).trim();
  const contactUrl = String(orderData?.contactUrl || buildPublicUrl('/Contact.html')).trim();
  const supportEmail = config.senderEmail;
  const statusLine = previousStatus
    ? `Your order moved from ${previousStatus} to ${status}.`
    : `Your order is now ${status}.`;

  const htmlContent = `
    <div style="margin:0;padding:32px 16px;background:#f6f0ea;font-family:Arial,sans-serif;color:#231711;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #eadfd3;">
        <div style="padding:28px 32px;background:#231711;color:#f6f0ea;">
          <div style="font-size:12px;letter-spacing:0.26em;text-transform:uppercase;opacity:0.78;">Benzy Luxury</div>
          <h1 style="margin:12px 0 0;font-size:30px;line-height:1.2;">Order update</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hi ${escapeHtml(greetingName)},</p>
          <p style="margin:0 0 20px;font-size:16px;line-height:1.7;">${escapeHtml(statusLine)}</p>
          <div style="margin:0 0 24px;padding:18px 20px;border-radius:14px;background:#f8f1eb;border:1px solid #eadfd3;">
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7a5c43;">Order ID</div>
            <div style="margin-top:6px;font-size:18px;font-weight:700;">${escapeHtml(orderId)}</div>
            <div style="margin-top:14px;font-size:15px;line-height:1.8;color:#6b5a4d;">
              Current status: ${escapeHtml(status)}<br>
              ${estimatedDelivery ? `Estimated delivery: ${escapeHtml(estimatedDelivery)}<br>` : ''}
            </div>
          </div>
          <div style="margin:0 0 20px;">
            ${profileUrl ? `<a href="${escapeHtml(profileUrl)}" style="display:inline-block;margin:0 10px 10px 0;padding:14px 22px;border-radius:999px;background:#231711;color:#f6f0ea;text-decoration:none;font-weight:700;">View order</a>` : ''}
            ${contactUrl ? `<a href="${escapeHtml(contactUrl)}" style="display:inline-block;margin:0 10px 10px 0;padding:14px 22px;border-radius:999px;border:1px solid #d8c4b3;color:#231711;text-decoration:none;font-weight:700;">Contact support</a>` : ''}
          </div>
          ${supportEmail ? `<p style="margin:0;font-size:15px;line-height:1.7;color:#6b5a4d;">Questions? Reach us at <a href="mailto:${escapeHtml(supportEmail)}" style="color:#231711;font-weight:700;text-decoration:none;">${escapeHtml(supportEmail)}</a>.</p>` : ''}
        </div>
      </div>
    </div>
  `;
  const textContent = [
    `Hi ${greetingName},`,
    '',
    statusLine,
    `Order ID: ${orderId}`,
    `Current status: ${status}`,
    estimatedDelivery ? `Estimated delivery: ${estimatedDelivery}` : '',
    profileUrl ? `View order: ${profileUrl}` : '',
    contactUrl ? `Contact support: ${contactUrl}` : '',
    supportEmail ? `Support email: ${supportEmail}` : ''
  ].filter(Boolean).join('\n');

  return sendTransactionalEmail({
    toEmail: email,
    toName: greetingName,
    subject: `Order update | ${orderId} is ${status}`,
    htmlContent,
    textContent,
    tags: ['orders', 'status-update']
  });
}

async function sendWalletTopUpReceiptEmail(email, name = '', options = {}) {
  const currency = String(options?.currency || 'NGN').trim().toUpperCase() || 'NGN';
  const greetingName = getGreetingName(name, email);
  const reference = sanitizePlainText(
    options?.reference || options?.paymentReference || options?.transactionId || 'Pending',
    80
  );
  const paymentMethod = sanitizePlainText(options?.paymentMethod || 'Paystack', 80) || 'Paystack';
  const completedAt = formatDate(
    options?.completedAt
    || options?.paidAt
    || options?.updatedAt
    || options?.createdAt
    || new Date().toISOString()
  );
  const amount = formatCurrency(options?.amount || 0, currency);
  const balance = formatCurrency(options?.balance || 0, currency);
  const htmlContent = `
    <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111111;">
      <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
        <div style="margin:0 0 34px;">
          <div style="display:inline-block;width:22px;height:22px;background:#009e49;border-radius:4px;color:#ffffff;text-align:center;line-height:22px;font-weight:800;">✓</div>
          <span style="margin-left:8px;font-size:28px;font-weight:800;vertical-align:middle;">Benzy Luxury</span>
        </div>
        <h1 style="margin:0 0 24px;font-size:34px;line-height:1.15;">Wallet Top-up Confirmed</h1>
        <p style="margin:0 0 22px;font-size:18px;line-height:1.65;">Hello ${escapeHtml(greetingName)},</p>
        <p style="margin:0 0 26px;font-size:18px;line-height:1.65;color:#444444;">${escapeHtml(amount)} has been added to your Benzy wallet. Below are the transaction details.</p>
        <div style="border-top:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5;padding:20px 0;margin-bottom:28px;font-size:17px;line-height:1.9;color:#444444;">
          <div><strong style="color:#333333;">Reference:</strong> ${escapeHtml(reference)}</div>
          <div><strong style="color:#333333;">Amount:</strong> ${escapeHtml(amount)}</div>
          <div><strong style="color:#333333;">Wallet Balance:</strong> ${escapeHtml(balance)}</div>
          <div><strong style="color:#333333;">Payment Method:</strong> ${escapeHtml(paymentMethod)}</div>
          <div><strong style="color:#333333;">Status:</strong> Successful</div>
          <div><strong style="color:#333333;">Confirmed On:</strong> ${escapeHtml(completedAt)}</div>
        </div>
        <p style="margin:0 0 18px;font-size:17px;line-height:1.65;color:#444444;">If you did not make this top-up, please contact Benzy Luxury support immediately.</p>
        <p style="margin:0;font-size:17px;line-height:1.65;color:#444444;">Your business best friend,<br><strong>Benzy Luxury.</strong></p>
      </div>
    </div>
  `;
  const textContent = [
    `Hi ${greetingName},`,
    '',
    'Your Benzy wallet top-up has been confirmed.',
    `Amount added: ${amount}`,
    `New wallet balance: ${balance}`,
    `Reference: ${reference}`,
    `Payment method: ${paymentMethod}`,
    `Confirmed on: ${completedAt}`,
    '',
    'If you did not make this top-up, please contact Benzy Luxury support immediately.'
  ]
    .filter(Boolean)
    .join('\n');

  return sendTransactionalEmail({
    toEmail: email,
    toName: greetingName,
    subject: 'Benzy wallet top-up receipt',
    htmlContent,
    textContent,
    tags: ['wallet', 'top-up', 'receipt']
  });
}

async function sendPasswordResetEmail(email, name = '', options = {}) {
  const resetUrl = String(options.resetUrl || '').trim();
  const resetCode = sanitizePlainText(options.resetCode || options.code || '', 40);
  const expiresIn = sanitizePlainText(options.expiresIn || '15 minutes', 40);

  if (!resetUrl && !resetCode) {
    throw new BrevoError('A reset URL or reset code is required.', {
      statusCode: 400
    });
  }

  const greetingName = getGreetingName(name, email);
  const htmlContent = `
    <div style="margin:0;padding:32px 16px;background:#f6f0ea;font-family:Arial,sans-serif;color:#231711;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #eadfd3;">
        <div style="padding:28px 32px;background:#231711;color:#f6f0ea;">
          <div style="font-size:12px;letter-spacing:0.26em;text-transform:uppercase;opacity:0.78;">Benzy Luxury</div>
          <h1 style="margin:12px 0 0;font-size:30px;line-height:1.2;">Reset your password</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hi ${escapeHtml(greetingName)},</p>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">We received a request to reset your account password. This reset expires in ${escapeHtml(expiresIn)}.</p>
          ${resetCode ? `
            <div style="margin:24px 0;padding:18px 20px;border:1px dashed #7a5c43;border-radius:12px;background:#f8f1eb;text-align:center;">
              <div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#7a5c43;">Reset code</div>
              <div style="margin-top:10px;font-size:28px;font-weight:700;letter-spacing:0.08em;color:#231711;">${escapeHtml(resetCode)}</div>
            </div>
          ` : ''}
          ${resetUrl ? `
            <p style="margin:0 0 20px;font-size:16px;line-height:1.7;">Use this secure link to continue:</p>
            <p style="margin:0 0 16px;"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#231711;color:#f6f0ea;text-decoration:none;font-weight:700;">Reset password</a></p>
          ` : ''}
          <p style="margin:0;font-size:15px;line-height:1.7;color:#6b5a4d;">If you did not request this, you can ignore this email.</p>
        </div>
      </div>
    </div>
  `;
  const textContent = [
    `Hi ${greetingName},`,
    '',
    `We received a request to reset your password. This reset expires in ${expiresIn}.`,
    resetCode ? `Reset code: ${resetCode}` : '',
    resetUrl ? `Reset link: ${resetUrl}` : '',
    '',
    'If you did not request this, you can ignore this email.'
  ]
    .filter(Boolean)
    .join('\n');

  return sendTransactionalEmail({
    toEmail: email,
    toName: greetingName,
    subject: 'Reset your Benzy Luxury password',
    htmlContent,
    textContent,
    tags: ['auth', 'password-reset']
  });
}

module.exports = {
  BREVO_LIST_ENV_KEYS,
  BrevoError,
  addAbandonedCartContact,
  addContactToBrevo,
  addContactToBrevoList,
  addCustomerContact,
  addEventsContact,
  addGiveawayContact,
  addInfluencerContact,
  addNewsletterContact,
  addPreorderContact,
  addSupportContact,
  addVipContact,
  addWalletTopUpContact,
  addWholesaleContact,
  buildOrderReceiptAttachment,
  getBrevoConfig,
  getBrevoListId,
  isBrevoConfigured,
  sendOrderConfirmation,
  sendOrderStatusUpdateEmail,
  sendPasswordResetEmail,
  sendTransactionalEmail,
  sendWalletTopUpReceiptEmail,
  sendWelcomeEmail
};
