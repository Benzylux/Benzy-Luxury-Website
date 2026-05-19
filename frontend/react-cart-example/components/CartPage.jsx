import React, { useState } from 'react';
import { useCart } from '../cart/CartContext';

function formatMoney(amount) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
}

export default function CartPage() {
  const {
    cart,
    loading,
    error,
    success,
    isAuthenticated,
    updateQuantity,
    removeItem,
    clearAll,
    applyCouponCode,
    removeCouponCode
  } = useCart();
  const [couponCode, setCouponCode] = useState('');

  async function handleCouponSubmit(event) {
    event.preventDefault();
    if (!couponCode.trim()) return;
    await applyCouponCode(couponCode.trim());
    setCouponCode('');
  }

  if (!cart.items.length) {
    return (
      <section>
        <h1>Your cart is empty</h1>
        <p>Add something from the catalog to start your checkout flow.</p>
        {error ? <p role="alert">{error}</p> : null}
      </section>
    );
  }

  return (
    <section>
      <header>
        <h1>Cart</h1>
        <p>{isAuthenticated ? 'Signed-in cart' : 'Guest cart saved in localStorage'}</p>
      </header>

      {loading ? <p>Updating cart...</p> : null}
      {success ? <p>{success}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      <ul>
        {cart.items.map((item) => (
          <li key={item.id || item.lineKey}>
            <img src={item.image} alt={item.name} width="96" height="96" />
            <div>
              <strong>{item.name}</strong>
              <p>Size: {item.size || 'Default'} | Color: {item.color || 'Default'}</p>
              <p>{formatMoney(item.price)}</p>
              <label>
                Qty
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(event) => void updateQuantity(item.id || item.productId, Number(event.target.value))}
                />
              </label>
              <button type="button" onClick={() => void removeItem(item.id || item.productId)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={handleCouponSubmit}>
        <label htmlFor="coupon-code">Coupon code</label>
        <input
          id="coupon-code"
          value={couponCode}
          onChange={(event) => setCouponCode(event.target.value)}
          placeholder="WELCOME10"
        />
        <button type="submit">Apply coupon</button>
        {cart.summary.appliedCoupon ? (
          <button type="button" onClick={() => void removeCouponCode()}>
            Remove coupon
          </button>
        ) : null}
      </form>

      {cart.summary.couponMessage ? <p>{cart.summary.couponMessage}</p> : null}

      <div>
        <p>Subtotal: {formatMoney(cart.summary.subtotal)}</p>
        <p>Discount: {formatMoney(cart.summary.discount)}</p>
        <p>Shipping: {formatMoney(cart.summary.shippingFee)}</p>
        <p>Total: {formatMoney(cart.summary.total)}</p>
      </div>

      {!isAuthenticated ? (
        <p>Guests can add items and apply coupons, but login is required before checkout.</p>
      ) : null}

      <button type="button" onClick={() => void clearAll()}>
        Clear cart
      </button>
    </section>
  );
}
