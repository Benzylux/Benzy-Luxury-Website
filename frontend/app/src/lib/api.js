const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

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
  checkoutContext: () => request('/api/checkout/context'),
  initializePaystack: (body) => request('/api/checkout/paystack/initialize', { method: 'POST', body: JSON.stringify(body) }),
  createOrder: (body) => request('/api/orders', { method: 'POST', body: JSON.stringify(body) }),
  trackOrder: (body) => request('/api/track-order', { method: 'POST', body: JSON.stringify(body) }),
  adminOrders: () => request('/api/admin/orders'),
  adminUsers: () => request('/api/admin/users'),
  adminProducts: () => request('/api/admin/products')
};

export function assetUrl(path) {
  const safe = String(path || '').trim();
  if (!safe) return '/products/img-0026-webp-mon42n2c-520893bfe4.webp';
  if (/^https?:\/\//i.test(safe) || safe.startsWith('/products/')) return safe;
  if (safe.includes('/')) {
    return `${API_BASE_URL}/${safe.split('/').map(encodeURIComponent).join('/')}`;
  }
  const fileName = safe.split(/[\\/]/).pop();
  return `/products/${fileName}`;
}
