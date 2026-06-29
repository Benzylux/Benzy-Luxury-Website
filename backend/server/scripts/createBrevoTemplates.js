const fs = require('fs');
const https = require('https');
const path = require('path');

const { loadEnvironment } = require('../loadEnv');

loadEnvironment();

const BREVO_HOSTNAME = 'api.brevo.com';
const OUTPUT_FILE = path.resolve(__dirname, '..', 'brevo-templates.json');
const DEFAULT_LOGO_URL = 'https://raw.githubusercontent.com/Benzylux/Benzy-Luxury-Website/main/frontend/OFF%20BACK/BLX.png';

function env(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function requestBrevo({ method = 'GET', path: requestPath, body }) {
  const apiKey = env('BREVO_API_KEY');
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is required to create Brevo templates.');
  }

  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const request = https.request(
      {
        hostname: BREVO_HOSTNAME,
        path: requestPath,
        method,
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
          ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {})
        },
        timeout: 20000
      },
      (response) => {
        let raw = '';
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          let data = {};
          if (raw) {
            try {
              data = JSON.parse(raw);
            } catch {
              data = { message: raw };
            }
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve({ statusCode: response.statusCode, data });
            return;
          }

          reject(new Error(data.message || data.code || `Brevo request failed with ${response.statusCode}.`));
        });
      }
    );

    request.on('timeout', () => request.destroy(new Error('Brevo request timed out.')));
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

function getLogoUrl() {
  return env('BREVO_LOGO_URL', DEFAULT_LOGO_URL);
}

function baseHtml(title, body, content) {
  const logoUrl = escapeHtml(getLogoUrl());
  return `
    <div style="margin:0;padding:32px 16px;background:#f6f0ea;font-family:Arial,Helvetica,sans-serif;color:#231711;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #eadfd3;border-radius:16px;overflow:hidden;">
        <div style="padding:30px 32px 26px;background:#f6f0ea;color:#111111;text-align:center;border-bottom:1px solid #eadfd3;">
          <img src="${logoUrl}" width="96" alt="BLX" style="display:block;width:96px;height:auto;margin:0 auto 14px;border:0;outline:none;text-decoration:none;">
          <div style="font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:#6b5a4d;">BENZY LUXURY</div>
          <h1 style="margin:12px 0 0;font-size:30px;line-height:1.2;color:#111111;">${escapeHtml(title)}</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">Hi {{ params.firstName | default:'there' }},</p>
          <p style="margin:0 0 22px;font-size:16px;line-height:1.7;">${body}</p>
          ${content || ''}
          <p style="margin:28px 0 0;font-size:14px;line-height:1.7;color:#6b5a4d;">Benzy Luxury<br>{{ params.supportEmail | default:'admin@benzyluxury.com' }}</p>
        </div>
      </div>
    </div>
  `;
}

const button = (label, urlParam) => `
  <p style="margin:0 0 18px;">
    <a href="{{ params.${urlParam} }}" style="display:inline-block;padding:14px 22px;border-radius:8px;background:#111111;color:#ffffff;text-decoration:none;font-weight:700;">${label}</a>
  </p>
`;

const codeBlock = (label, codeParam = 'code') => `
  <div style="margin:24px 0;padding:18px 20px;border:1px dashed #7a5c43;border-radius:12px;background:#f8f1eb;text-align:center;">
    <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#7a5c43;">${label}</div>
    <div style="margin-top:10px;font-size:32px;font-weight:800;letter-spacing:.1em;">{{ params.${codeParam} }}</div>
  </div>
`;

const orderSummary = `
  <div style="margin:24px 0;padding:18px 20px;border:1px solid #eadfd3;border-radius:12px;background:#f8f1eb;">
    <p style="margin:0 0 8px;"><strong>Order:</strong> {{ params.orderId }}</p>
    <p style="margin:0 0 8px;"><strong>Total:</strong> {{ params.total }}</p>
    <p style="margin:0;"><strong>Status:</strong> {{ params.status }}</p>
  </div>
`;

const templates = [
  {
    key: 'welcome',
    templateName: 'BLX Welcome Template',
    subject: 'Welcome to Benzy Luxury',
    htmlContent: baseHtml('Welcome to Benzy Luxury', 'Your BLX account is ready. You can now manage orders, receipts, saved addresses, wishlist items, and notifications from your dashboard.', button('Open dashboard', 'dashboardUrl'))
  },
  {
    key: 'otp',
    templateName: 'BLX OTP Template',
    subject: 'Your Benzy Luxury login code',
    htmlContent: baseHtml('Your login code', 'Use this one-time code to sign in to your Benzy Luxury account. It expires shortly.', codeBlock('Login code'))
  },
  {
    key: 'verification',
    templateName: 'BLX Verification Template',
    subject: 'Verify your Benzy Luxury email',
    htmlContent: baseHtml('Verify your email', 'Use this code to verify your account email and unlock all customer dashboard features.', codeBlock('Verification code'))
  },
  {
    key: 'order_confirmation',
    templateName: 'BLX Order Confirmation Template',
    subject: 'Order confirmed | {{ params.orderId }}',
    htmlContent: baseHtml('Order confirmed', 'We received your order and sent it to the BLX operations team.', `${orderSummary}${button('View order', 'orderUrl')}`)
  },
  {
    key: 'receipt',
    templateName: 'BLX Receipt Template',
    subject: 'Payment receipt | {{ params.receiptId }}',
    htmlContent: baseHtml('Payment successful', 'Your payment was successful. Your receipt is attached or available in your account dashboard.', `${orderSummary}${button('Download receipt', 'receiptUrl')}`)
  },
  {
    key: 'invoice',
    templateName: 'BLX Invoice Template',
    subject: 'Invoice | {{ params.invoiceId }}',
    htmlContent: baseHtml('Your invoice', 'Your invoice is ready for download. You can keep this for your records.', `${orderSummary}${button('Download invoice', 'invoiceUrl')}`)
  },
  {
    key: 'shipping',
    templateName: 'BLX Shipping Template',
    subject: 'Order shipped | {{ params.orderId }}',
    htmlContent: baseHtml('Your order has shipped', 'Your BLX order is on the move. Use the tracking details below for delivery updates.', `${orderSummary}<p><strong>Tracking ID:</strong> {{ params.trackingId }}</p>${button('Track order', 'trackingUrl')}`)
  },
  {
    key: 'delivered',
    templateName: 'BLX Delivered Template',
    subject: 'Delivered | {{ params.orderId }}',
    htmlContent: baseHtml('Order delivered', 'Your order has been delivered. Thank you for shopping Benzy Luxury.', `${orderSummary}${button('View receipt', 'receiptUrl')}`)
  },
  {
    key: 'password_reset',
    templateName: 'BLX Password Reset Template',
    subject: 'Reset your Benzy Luxury password',
    htmlContent: baseHtml('Reset your password', 'Use this secure code or link to reset your account password. It expires shortly.', `${codeBlock('Reset code')}${button('Reset password', 'resetUrl')}`)
  }
];

async function getExistingTemplates() {
  const response = await requestBrevo({
    path: '/v3/smtp/templates?templateStatus=true&limit=1000&offset=0'
  });
  return Array.isArray(response.data?.templates) ? response.data.templates : [];
}

async function upsertTemplate(template, existingTemplates) {
  const senderEmail = env('BREVO_SENDER_EMAIL', 'admin@benzyluxury.com');
  const senderName = env('BREVO_SENDER_NAME', 'Benzy Luxury');
  const found = existingTemplates.find((entry) => String(entry.name || '').trim() === template.templateName);
  const payload = {
    tag: 'blx-transactional',
    sender: { name: senderName, email: senderEmail },
    templateName: template.templateName,
    subject: template.subject,
    htmlContent: template.htmlContent,
    isActive: true
  };

  if (found?.id) {
    await requestBrevo({
      method: 'PUT',
      path: `/v3/smtp/templates/${found.id}`,
      body: payload
    });
    return { ...template, id: found.id, action: 'updated' };
  }

  const created = await requestBrevo({
    method: 'POST',
    path: '/v3/smtp/templates',
    body: payload
  });
  return { ...template, id: created.data?.id || null, action: 'created' };
}

async function main() {
  const existing = await getExistingTemplates();
  const results = [];
  for (const template of templates) {
    const result = await upsertTemplate(template, existing);
    results.push(result);
    console.log(`${result.action}: ${result.templateName} (${result.id || 'pending-id'})`);
  }

  const envMap = results.reduce((acc, template) => {
    acc[`BREVO_TEMPLATE_${template.key.toUpperCase()}`] = template.id;
    return acc;
  }, {});
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify({ generatedAt: new Date().toISOString(), templates: results, env: envMap }, null, 2)}\n`);
  console.log(`Saved template IDs to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
