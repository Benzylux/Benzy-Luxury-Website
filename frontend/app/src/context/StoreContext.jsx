import React from 'react';
import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { api } from '../lib/api.js';
import { fallbackProducts } from '../data/fallbackProducts.js';
import { getProductDisplayPrice, getProductRegularPrice, getProductSalePrice } from '../lib/productPricing.js';

const StoreContext = createContext(null);
const CART_KEY = 'blx-cart';
const THEME_KEY = 'blx-theme';

function cartReducer(state, action) {
  switch (action.type) {
    case 'add': {
      const item = action.item;
      const key = `${item.productId}:${item.size || 'M'}:${item.color || ''}`;
      const existing = state.find((entry) => entry.key === key);
      if (existing) {
        return state.map((entry) => entry.key === key ? { ...entry, quantity: entry.quantity + item.quantity } : entry);
      }
      return [...state, { ...item, key }];
    }
    case 'quantity':
      return state
        .map((item) => item.key === action.key ? { ...item, quantity: Math.max(1, action.quantity) } : item)
        .filter((item) => item.quantity > 0);
    case 'remove':
      return state.filter((item) => item.key !== action.key);
    case 'clear':
      return [];
    default:
      return state;
  }
}

function initCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  } catch {
    return [];
  }
}

export function StoreProvider({ children }) {
  const [products, setProducts] = useState(fallbackProducts);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('blx-user') || 'null');
    } catch {
      return null;
    }
  });
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  const [cart, dispatch] = useReducer(cartReducer, [], initCart);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    api.getProducts()
      .then((payload) => setProducts(payload.products || fallbackProducts))
      .catch(() => setProducts(fallbackProducts));
  }, []);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal > 150000 || subtotal === 0 ? 0 : 3000;
  const tax = Math.round(subtotal * 0.075);
  const total = subtotal + shipping + tax;

  const value = useMemo(() => ({
    products,
    cart,
    user,
    theme,
    subtotal,
    shipping,
    tax,
    total,
    setTheme,
    setUser(nextUser, token) {
      setUser(nextUser);
      localStorage.setItem('blx-user', JSON.stringify(nextUser));
      if (token) localStorage.setItem('blx-token', token);
    },
    logout() {
      setUser(null);
      localStorage.removeItem('blx-user');
      localStorage.removeItem('blx-token');
    },
    addToCart(product, options = {}) {
      dispatch({
        type: 'add',
        item: {
          productId: String(product.productId),
          name: product.name,
          slug: product.slug,
          image: product.image,
          price: getProductDisplayPrice(product),
          regularPrice: getProductRegularPrice(product),
          discountPrice: getProductSalePrice(product),
          quantity: Number(options.quantity || 1),
          size: options.size || 'M',
          color: options.color || product.variants?.[0]?.color || ''
        }
      });
    },
    updateQuantity: (key, quantity) => dispatch({ type: 'quantity', key, quantity }),
    removeFromCart: (key) => dispatch({ type: 'remove', key }),
    clearCart: () => dispatch({ type: 'clear' })
  }), [cart, products, shipping, subtotal, tax, theme, total, user]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used inside StoreProvider.');
  return context;
}
