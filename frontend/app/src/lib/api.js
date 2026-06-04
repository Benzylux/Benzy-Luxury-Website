function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured;

  return 'https://benzy-luxury-website.onrender.com';
}

const API_BASE_URL = resolveApiBaseUrl();

async function request(path, options = {}) {
  const token = localStorage.getItem('blx-token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'Request failed.');
  }
  return payload;
}

export const api = {
  baseUrl: API_BASE_URL,
  getProducts: () => request('/api/products'),
  getProduct: (slug) => request(`/api/products/${encodeURIComponent(slug)}`),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  signup: (body) => request('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/api/auth/me'),
  updateProfile: (body) => request('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  verifyEmail: (body) => request('/api/auth/verify-email', { method: 'POST', body: JSON.stringify(body) }),
  resendVerification: () => request('/api/auth/resend-verification', { method: 'POST' }),
  requestOtp: (body) => request('/api/auth/otp/request', { method: 'POST', body: JSON.stringify(body) }),
  verifyOtp: (body) => request('/api/auth/otp/verify', { method: 'POST', body: JSON.stringify(body) }),
  forgotPassword: (body) => request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
  resetPassword: (body) => request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
  accountDashboard: () => request('/api/profile/dashboard'),
  updateAddresses: (addresses) => request('/api/profile/addresses', { method: 'PUT', body: JSON.stringify({ addresses }) }),
  updateWishlist: (wishlist) => request('/api/profile/wishlist', { method: 'PUT', body: JSON.stringify({ wishlist }) }),
  updateNotifications: (notifications) => request('/api/profile/notifications', { method: 'PATCH', body: JSON.stringify({ notifications }) }),
  myOrders: () => request('/api/orders/my/history'),
  requestReturn: (orderId, body) => request(`/api/orders/${encodeURIComponent(orderId)}/return`, { method: 'POST', body: JSON.stringify(body) }),
  checkoutContext: () => request('/api/checkout/context'),
  initializePaystack: (body) => request('/api/checkout/paystack/initialize', { method: 'POST', body: JSON.stringify(body) }),
  createOrder: (body) => request('/api/orders', { method: 'POST', body: JSON.stringify(body) }),
  trackOrder: (body) => request('/api/track-order', { method: 'POST', body: JSON.stringify(body) }),
  adminOrders: () => request('/api/admin/orders'),
  adminUsers: () => request('/api/admin/users'),
  adminProducts: () => request('/api/admin/products'),
  adminEmailLogs: () => request('/api/admin/email-logs'),
  adminSegments: () => request('/api/admin/customer-segments'),
  adminSupportMessages: () => request('/api/admin/support-messages'),
  updateSupportMessage: (messageId, body) => request(`/api/admin/support-messages/${encodeURIComponent(messageId)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  sendEmailCampaign: (body) => request('/api/admin/email-campaigns', { method: 'POST', body: JSON.stringify(body) })
};

export function assetUrl(path) {
  const safe = String(path || '').trim();
  if (!safe) return '/products/img-0026-webp-mon42n2c-520893bfe4.webp';
  if (/^https?:\/\//i.test(safe) || safe.startsWith('/products/')) return safe;
  if (safe.startsWith('/uploads/')) return `${API_BASE_URL}${safe}`;
  if (safe.includes('/')) {
    return `${API_BASE_URL}/${safe.split('/').map(encodeURIComponent).join('/')}`;
  }
  const fileName = safe.split(/[\\/]/).pop();
  return `/products/${fileName}`;
}

