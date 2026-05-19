(function () {
  const TOKEN_KEY = "benzy_auth_token";
  const API_BASE_STORAGE_KEY = "benzy_api_base";
  const FALLBACK_API_BASE = "http://localhost:3001";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function getApiBases() {
    const bases = [];
    const storedBase = localStorage.getItem(API_BASE_STORAGE_KEY);
    const origin = window.location.origin;

    if (storedBase) bases.push(storedBase);
    if (origin && origin !== "null") bases.push(origin);
    bases.push(FALLBACK_API_BASE, "http://localhost:3001");

    return Array.from(new Set(bases.filter(Boolean)));
  }

  async function readJsonSafe(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  function createApiError(response, payload, fallbackMessage) {
    const message =
      payload?.message ||
      payload?.error ||
      fallbackMessage ||
      `Request failed with status ${response?.status || 500}.`;
    const error = new Error(String(message));
    error.status = Number(response?.status || 500);
    error.payload = payload;
    return error;
  }

  async function request(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const headers = new Headers(options.headers || {});
    const rawBody = options.body;
    const hasJsonBody = rawBody !== undefined && rawBody !== null && !(rawBody instanceof FormData);

    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (hasJsonBody && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

    const token = getToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const body = hasJsonBody && typeof rawBody !== "string" ? JSON.stringify(rawBody) : rawBody;
    let lastError = null;

    for (const base of getApiBases()) {
      try {
        const response = await fetch(`${base}${path}`, {
          method,
          headers,
          body,
          credentials: options.credentials || "same-origin"
        });
        const payload = await readJsonSafe(response);

        if (response.ok) {
          localStorage.setItem(API_BASE_STORAGE_KEY, base);
          return payload;
        }

        if ([400, 401, 403, 404, 409, 422].includes(response.status)) {
          localStorage.setItem(API_BASE_STORAGE_KEY, base);
          throw createApiError(response, payload, "The cart request could not be completed.");
        }

        lastError = createApiError(response, payload, "Unable to reach the cart service right now.");
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Unable to reach the cart service right now.");
  }

  const api = {
    getApiBases,
    getToken,
    request,
    async getCart() {
      return request("/api/cart");
    },
    async addItem(item) {
      return request("/api/cart/add", {
        method: "POST",
        body: item
      });
    },
    async updateItem(itemId, payload) {
      return request(`/api/cart/item/${encodeURIComponent(String(itemId || ""))}`, {
        method: "PATCH",
        body: payload
      });
    },
    async removeItem(itemId) {
      return request(`/api/cart/item/${encodeURIComponent(String(itemId || ""))}`, {
        method: "DELETE"
      });
    },
    async clearCart() {
      return request("/api/cart/clear", {
        method: "DELETE"
      });
    }
  };

  /*
    Sample fetch usage:
    window.BenzyCartApi.addItem({
      productId: "1",
      name: "Benzy Tee",
      price: 45,
      image: "OFF BACK/tee.png",
      quantity: 1,
      size: "Size: M",
      color: "Color: Black"
    });

    Sample axios usage:
    axios.get("/api/cart", {
      headers: { Authorization: "Bearer " + localStorage.getItem("benzy_auth_token") }
    });
  */

  window.BenzyCartApi = api;
})();
