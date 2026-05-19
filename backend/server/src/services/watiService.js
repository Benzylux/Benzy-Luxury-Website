const https = require('https');

class WatiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'WatiError';
    this.statusCode = Number(options.statusCode) || 500;
    this.details = options.details || null;
  }
}

function sanitizePlainText(value, maxLength = 160) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('00') ? digits.slice(2) : digits;
}

function normalizeEndpoint(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, '');
}

function getWatiConfig() {
  return {
    endpoint: normalizeEndpoint(process.env.WATI_API_ENDPOINT || process.env.WATI_BASE_URL || ''),
    token: String(process.env.WATI_TOKEN || process.env.WATI_ACCESS_TOKEN || '').trim(),
    channelNumber: normalizePhone(process.env.WATI_CHANNEL_NUMBER || process.env.WATI_PHONE_NUMBER || ''),
    templateName: sanitizePlainText(process.env.WATI_TEMPLATE_NAME || '', 120),
    templateBroadcastPrefix: sanitizePlainText(process.env.WATI_TEMPLATE_BROADCAST_PREFIX || 'Benzy Luxury contact', 80)
  };
}

function isWatiConfigured() {
  const config = getWatiConfig();
  return Boolean(config.endpoint && config.token);
}

function isWatiTemplateConfigured() {
  const config = getWatiConfig();
  return Boolean(config.endpoint && config.token && config.channelNumber && config.templateName);
}

function requireWatiConfig(requiredKeys = []) {
  const config = getWatiConfig();
  const missing = requiredKeys.filter((key) => !config[key]);
  if (missing.length) {
    throw new WatiError(`WATI is not configured. Missing: ${missing.join(', ')}.`, {
      statusCode: 503,
      details: { missing }
    });
  }
  return config;
}

function sendWatiRequest({ method = 'POST', path, query, body }) {
  const config = requireWatiConfig(['endpoint', 'token']);
  const url = new URL(String(path || '').replace(/^\/*/, ''), `${config.endpoint}/`);

  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
  }

  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${config.token}`,
          'content-type': 'application/json'
        }
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
            resolve({ statusCode, data: parsedBody });
            return;
          }

          reject(new WatiError(
            parsedBody.message || parsedBody.info || parsedBody.error || 'WATI request failed.',
            {
              statusCode,
              details: parsedBody
            }
          ));
        });
      }
    );

    request.on('error', (error) => {
      reject(new WatiError(error.message || 'Unable to reach WATI.', {
        statusCode: 502
      }));
    });

    if (body) {
      request.write(JSON.stringify(body));
    }

    request.end();
  });
}

function buildTemplateBroadcastName(seed) {
  const config = getWatiConfig();
  const rawSeed = sanitizePlainText(seed || '', 60)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const timestamp = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 12);
  const base = [config.templateBroadcastPrefix, rawSeed].filter(Boolean).join(' ');
  return sanitizePlainText(`${base || 'Benzy Luxury contact'} ${timestamp}`, 120);
}

async function sendWatiTemplateMessage({
  phone,
  templateName,
  channelNumber,
  broadcastName,
  parameters
}) {
  const config = requireWatiConfig(['endpoint', 'token', 'channelNumber', 'templateName']);
  const safePhone = normalizePhone(phone);
  const safeTemplateName = sanitizePlainText(templateName || config.templateName, 120);
  const safeChannelNumber = normalizePhone(channelNumber || config.channelNumber);
  const safeBroadcastName = buildTemplateBroadcastName(broadcastName);

  if (!safePhone) {
    throw new WatiError('A WhatsApp phone number is required.', {
      statusCode: 400
    });
  }

  if (!safeTemplateName) {
    throw new WatiError('A WATI template name is required.', {
      statusCode: 400
    });
  }

  if (!safeChannelNumber) {
    throw new WatiError('A WATI channel number is required.', {
      statusCode: 400
    });
  }

  const safeParameters = Array.isArray(parameters) ? parameters : [];
  const payload = {
    template_name: safeTemplateName,
    templateName: safeTemplateName,
    broadcast_name: safeBroadcastName,
    broadcastName: safeBroadcastName,
    channel_number: safeChannelNumber,
    channelNumber: safeChannelNumber,
    parameters: safeParameters
  };

  const response = await sendWatiRequest({
    path: '/api/v1/sendTemplateMessage',
    method: 'POST',
    query: {
      whatsappNumber: safePhone
    },
    body: payload
  });

  return {
    statusCode: response.statusCode,
    phone: safePhone,
    templateName: safeTemplateName,
    broadcastName: safeBroadcastName,
    messageId: sanitizePlainText(
      response.data?.messageId
      || response.data?.result?.messageId
      || response.data?.id
      || '',
      240
    ),
    raw: response.data
  };
}

async function sendWatiSessionMessage({
  phone,
  messageText,
  channelNumber,
  localMessageId
}) {
  const config = requireWatiConfig(['endpoint', 'token']);
  const safePhone = normalizePhone(phone);
  const safeMessageText = String(messageText || '').trim().slice(0, 4096);
  const safeChannelNumber = normalizePhone(channelNumber || config.channelNumber);
  const safeLocalMessageId = sanitizePlainText(localMessageId || '', 120);

  if (!safePhone) {
    throw new WatiError('A WhatsApp phone number is required.', {
      statusCode: 400
    });
  }

  if (!safeMessageText) {
    throw new WatiError('A WATI session message body is required.', {
      statusCode: 400
    });
  }

  const response = await sendWatiRequest({
    path: `/api/v1/sendSessionMessage/${safePhone}`,
    method: 'POST',
    query: {
      messageText: safeMessageText,
      channelPhoneNumber: safeChannelNumber,
      localMessageId: safeLocalMessageId
    }
  });

  return {
    statusCode: response.statusCode,
    phone: safePhone,
    localMessageId: safeLocalMessageId,
    messageId: sanitizePlainText(
      response.data?.messageId
      || response.data?.result?.messageId
      || response.data?.id
      || '',
      240
    ),
    raw: response.data
  };
}

module.exports = {
  WatiError,
  getWatiConfig,
  isWatiConfigured,
  isWatiTemplateConfigured,
  normalizePhone,
  sendWatiSessionMessage,
  sendWatiTemplateMessage
};
