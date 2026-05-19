import React, { useState } from 'react';
import { useCart } from '../cart/CartContext';

function formatMoney(amount) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
}

export default function CheckoutValidationExample() {
  const { isAuthenticated, validateCheckoutFlow, cart } = useCart();
  const [validatedCart, setValidatedCart] = useState(null);

  async function handleValidate() {
    const freshCart = await validateCheckoutFlow();
    setValidatedCart(freshCart);
  }

  return (
    <section>
      <h2>Checkout Validation</h2>
      <p>
        This step fetches the latest server cart, rechecks stock, revalidates the coupon,
        and returns the final payable amount before you hand the order to Paystack.
      </p>

      {!isAuthenticated ? (
        <p>Login is required before checkout can continue.</p>
      ) : (
        <button type="button" onClick={() => void handleValidate()}>
          Validate checkout
        </button>
      )}

      {validatedCart ? (
        <div>
          <p>Subtotal: {formatMoney(validatedCart.summary.subtotal)}</p>
          <p>Discount: {formatMoney(validatedCart.summary.discount)}</p>
          <p>Shipping: {formatMoney(validatedCart.summary.shippingFee)}</p>
          <p>Total payable: {formatMoney(validatedCart.summary.total)}</p>
          {validatedCart.summary.couponMessage ? <p>{validatedCart.summary.couponMessage}</p> : null}

          <pre>{JSON.stringify(validatedCart, null, 2)}</pre>

          <p>
            Hook Paystack here:
            pass `validatedCart.summary.total` and the validated item snapshot to your checkout initializer,
            instead of trusting stale frontend totals.
          </p>
        </div>
      ) : null}

      {!validatedCart && cart.summary.couponMessage ? <p>{cart.summary.couponMessage}</p> : null}
    </section>
  );
}
