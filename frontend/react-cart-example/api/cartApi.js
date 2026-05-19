async function request(path, { apiBase = '', token = '', method = 'GET', body } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: method === 'GET' ? undefined : JSON.stringify(body || {})
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(data?.message || data?.error || 'Request failed.'));
  }

  return data;
}

export function getCart({ apiBase = '', token }) {
  return request('/api/cart', { apiBase, token, method: 'GET' });
}

export function syncCart({ apiBase = '', token, items, couponCode, guestId }) {
  return request('/api/cart/sync', {
    apiBase,
    token,
    method: 'POST',
    body: { items, couponCode, guestId }
  });
}

export function mergeGuestCart({ apiBase = '', token, guestCart, guestId }) {
  return request('/api/cart/merge', {
    apiBase,
    token,
    method: 'POST',
    body: { guestCart, guestId }
  });
}

export function addToCart({ apiBase = '', token, item }) {
  return request('/api/cart/add', {
    apiBase,
    token,
    method: 'POST',
    body: item
  });
}

export function updateCartItem({ apiBase = '', token, itemId, quantity }) {
  return request(`/api/cart/item/${encodeURIComponent(itemId)}`, {
    apiBase,
    token,
    method: 'PATCH',
    body: { quantity }
  });
}

export function removeCartItem({ apiBase = '', token, itemId }) {
  return request(`/api/cart/item/${encodeURIComponent(itemId)}`, {
    apiBase,
    token,
    method: 'DELETE'
  });
}

export function clearCart({ apiBase = '', token }) {
  return request('/api/cart/clear', {
    apiBase,
    token,
    method: 'DELETE'
  });
}

export function applyCoupon({ apiBase = '', token = '', code, guestCart, guestId }) {
  return request('/api/cart/apply-coupon', {
    apiBase,
    token,
    method: 'POST',
    body: {
      code,
      couponCode: code,
      guestCart,
      guestId
    }
  });
}

export function removeCoupon({ apiBase = '', token }) {
  return request('/api/cart/remove-coupon', {
    apiBase,
    token,
    method: 'DELETE'
  });
}

export function validateCoupon({ apiBase = '', token = '', code, guestId = '' }) {
  const query = guestId ? `?guestId=${encodeURIComponent(guestId)}` : '';
  return request(`/api/coupons/${encodeURIComponent(code)}/validate${query}`, {
    apiBase,
    token,
    method: 'GET'
  });
}

export function validateCheckout({ apiBase = '', token }) {
  return request('/api/cart/checkout/validate', {
    apiBase,
    token,
    method: 'POST'
  });
}
