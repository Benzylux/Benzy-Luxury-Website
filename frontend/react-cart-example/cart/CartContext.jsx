import React, { createContext, startTransition, useContext, useEffect, useReducer } from 'react';
import {
  addToCart,
  applyCoupon,
  clearCart,
  getCart,
  mergeGuestCart,
  removeCartItem,
  removeCoupon,
  updateCartItem,
  validateCheckout
} from '../api/cartApi';
import {
  clearGuestCartState,
  createGuestCartState,
  guestPayloadFromState,
  mergeGuestCartItems,
  readGuestCartState,
  summarizeGuestCart,
  writeGuestCartFromServerCart,
  writeGuestCartState
} from './cartStorage';
import { cartReducer, initialCartState } from './cartReducer';

const CartContext = createContext(null);

function normalizeApiItem(item) {
  return {
    productId: item.productId,
    name: item.name,
    price: Number(item.price || 0),
    image: item.image,
    quantity: Number(item.quantity || 1),
    size: item.size,
    color: item.color,
    variantId: item.variantId,
    categoryId: item.categoryId
  };
}

export function CartProvider({ apiBase = '', authToken = '', user = null, children }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);
  const isAuthenticated = Boolean(authToken && user?.id);

  useEffect(() => {
    let cancelled = false;

    async function bootCart() {
      dispatch({ type: 'loading' });

      try {
        if (!isAuthenticated) {
          const guestCart = summarizeGuestCart(readGuestCartState());
          if (!cancelled) {
            startTransition(() => {
              dispatch({ type: 'replace', cart: guestCart });
            });
          }
          return;
        }

        const guestState = readGuestCartState();
        const shouldMergeGuestCart = guestState.items.length > 0 || Boolean(guestState.couponCode);
        const payload = shouldMergeGuestCart
          ? await mergeGuestCart({
              apiBase,
              token: authToken,
              ...guestPayloadFromState(guestState)
            })
          : await getCart({ apiBase, token: authToken });

        clearGuestCartState();
        if (!cancelled) {
          startTransition(() => {
            dispatch({ type: 'replace', cart: payload.cart });
          });
        }
      } catch (error) {
        if (!cancelled) {
          dispatch({ type: 'error', error: error.message });
        }
      }
    }

    void bootCart();

    return () => {
      cancelled = true;
    };
  }, [apiBase, authToken, isAuthenticated, user?.id]);

  function replaceGuestCart(nextGuestState, message = '') {
    writeGuestCartState(nextGuestState);
    const guestCart = summarizeGuestCart(nextGuestState);
    startTransition(() => {
      dispatch({ type: 'replace', cart: guestCart, message });
    });
    return guestCart;
  }

  async function addItem(item) {
    if (isAuthenticated) {
      dispatch({ type: 'loading' });
      try {
        const result = await addToCart({
          apiBase,
          token: authToken,
          item: normalizeApiItem(item)
        });
        startTransition(() => {
          dispatch({ type: 'replace', cart: result.cart, message: 'Item added to cart.' });
        });
        return result.cart;
      } catch (error) {
        dispatch({ type: 'error', error: error.message });
        throw error;
      }
    }

    const guestState = readGuestCartState();
    const nextGuestState = createGuestCartState({
      ...guestState,
      items: mergeGuestCartItems(guestState.items, [normalizeApiItem(item)]),
      updatedAt: new Date().toISOString()
    });
    return replaceGuestCart(nextGuestState, 'Item added to cart.');
  }

  async function updateQuantity(itemId, quantity) {
    if (isAuthenticated) {
      dispatch({ type: 'loading' });
      try {
        const result = await updateCartItem({
          apiBase,
          token: authToken,
          itemId,
          quantity
        });
        startTransition(() => {
          dispatch({ type: 'replace', cart: result.cart, message: 'Quantity updated.' });
        });
        return result.cart;
      } catch (error) {
        dispatch({ type: 'error', error: error.message });
        throw error;
      }
    }

    const guestState = readGuestCartState();
    const nextGuestState = createGuestCartState({
      ...guestState,
      items: guestState.items.map((item) => (
        item.productId === itemId || item.variantId === itemId
          ? { ...item, quantity: Math.max(1, Number(quantity || 1)) }
          : item
      )),
      updatedAt: new Date().toISOString()
    });
    return replaceGuestCart(nextGuestState, 'Quantity updated.');
  }

  async function removeItem(itemId) {
    if (isAuthenticated) {
      dispatch({ type: 'loading' });
      try {
        const result = await removeCartItem({
          apiBase,
          token: authToken,
          itemId
        });
        startTransition(() => {
          dispatch({ type: 'replace', cart: result.cart, message: 'Item removed.' });
        });
        return result.cart;
      } catch (error) {
        dispatch({ type: 'error', error: error.message });
        throw error;
      }
    }

    const guestState = readGuestCartState();
    const nextGuestState = createGuestCartState({
      ...guestState,
      items: guestState.items.filter((item) => item.productId !== itemId && item.variantId !== itemId),
      updatedAt: new Date().toISOString()
    });
    return replaceGuestCart(nextGuestState, 'Item removed.');
  }

  async function clearAll() {
    if (isAuthenticated) {
      dispatch({ type: 'loading' });
      try {
        const result = await clearCart({
          apiBase,
          token: authToken
        });
        startTransition(() => {
          dispatch({ type: 'replace', cart: result.cart, message: 'Cart cleared.' });
        });
        return result.cart;
      } catch (error) {
        dispatch({ type: 'error', error: error.message });
        throw error;
      }
    }

    clearGuestCartState();
    const emptyGuestCart = summarizeGuestCart(createGuestCartState({ items: [] }));
    startTransition(() => {
      dispatch({ type: 'replace', cart: emptyGuestCart, message: 'Cart cleared.' });
    });
    return emptyGuestCart;
  }

  async function applyCouponCode(code) {
    dispatch({ type: 'loading' });
    try {
      if (isAuthenticated) {
        const result = await applyCoupon({
          apiBase,
          token: authToken,
          code
        });
        startTransition(() => {
          dispatch({ type: 'replace', cart: result.cart, message: result.message || 'Coupon applied.' });
        });
        return result.cart;
      }

      const guestState = readGuestCartState();
      const result = await applyCoupon({
        apiBase,
        code,
        ...guestPayloadFromState(guestState)
      });
      const guestCart = writeGuestCartFromServerCart(result.cart);
      startTransition(() => {
        dispatch({ type: 'replace', cart: guestCart, message: result.message || 'Coupon applied.' });
      });
      return guestCart;
    } catch (error) {
      dispatch({ type: 'error', error: error.message });
      throw error;
    }
  }

  async function removeCouponCode() {
    if (isAuthenticated) {
      dispatch({ type: 'loading' });
      try {
        const result = await removeCoupon({
          apiBase,
          token: authToken
        });
        startTransition(() => {
          dispatch({ type: 'replace', cart: result.cart, message: 'Coupon removed.' });
        });
        return result.cart;
      } catch (error) {
        dispatch({ type: 'error', error: error.message });
        throw error;
      }
    }

    const guestState = readGuestCartState();
    const nextGuestState = createGuestCartState({
      ...guestState,
      couponCode: '',
      appliedCoupon: null,
      couponMessage: '',
      updatedAt: new Date().toISOString()
    });
    return replaceGuestCart(nextGuestState, 'Coupon removed.');
  }

  async function validateCheckoutFlow() {
    if (!isAuthenticated) {
      throw new Error('Log in before checkout. Guest carts merge automatically after login.');
    }

    dispatch({ type: 'loading' });
    try {
      const result = await validateCheckout({
        apiBase,
        token: authToken
      });
      startTransition(() => {
        dispatch({ type: 'replace', cart: result.cart, message: result.message || 'Checkout validated.' });
      });
      return result.cart;
    } catch (error) {
      dispatch({ type: 'error', error: error.message });
      throw error;
    }
  }

  const contextValue = {
    ...state,
    isAuthenticated,
    addItem,
    applyCouponCode,
    clearAll,
    removeCouponCode,
    removeItem,
    updateQuantity,
    validateCheckoutFlow
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside a CartProvider.');
  }
  return context;
}
