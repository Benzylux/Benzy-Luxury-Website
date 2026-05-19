import React from 'react';
import { useState } from 'react';
import { CreditCard, LockKeyhole, LogIn } from 'lucide-react';
import Header from '../components/Header.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { api, assetUrl } from '../lib/api.js';

const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export default function CheckoutPage() {
  const { cart, subtotal, shipping, tax, total, user, setUser, clearCart } = useStore();
  const [mode, setMode] = useState('login');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    city: 'Lagos',
    country: 'Nigeria'
  });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function authenticate(event) {
    event.preventDefault();
    const payload = mode === 'login'
      ? await api.login({ email: form.email, password: form.password })
      : await api.signup({ name: form.name, email: form.email, password: form.password });
    setUser(payload.user, payload.token);
    setMessage(`Signed in as ${payload.user.name}.`);
  }

  async function placeOrder(event) {
    event.preventDefault();
    if (!cart.length) {
      setMessage('Add at least one product before checkout.');
      return;
    }

    const customer = {
      name: user?.name || form.name,
      email: user?.email || form.email,
      phone: form.phone,
      address: form.address,
      city: form.city,
      country: form.country
    };

    const payload = {
      customer,
      items: cart,
      subtotal,
      shipping,
      tax,
      total,
      currency: 'NGN',
      paymentMethod: 'paystack'
    };

    try {
      const paystack = await api.initializePaystack(payload);
      setMessage(paystack.authorizationUrl ? 'Paystack checkout initialized. Open the returned authorization URL to complete payment.' : 'Order is ready for Paystack payment.');
      if (paystack.authorizationUrl) window.location.href = paystack.authorizationUrl;
    } catch {
      const order = await api.createOrder(payload);
      clearCart();
      setMessage(`Order ${order.order?.orderId || order.orderId || 'created'} saved. Configure Paystack keys for live payment redirect.`);
    }
  }

  return (
    <main>
      <Header />
      <section className="checkout-layout">
        <div className="checkout-panel">
          <p className="eyebrow">Secure checkout</p>
          <h1>Delivery and payment</h1>
          {!user && (
            <form className="form-grid" onSubmit={authenticate}>
              <div className="segmented wide">
                <button type="button" className={mode === 'login' ? 'selected' : ''} onClick={() => setMode('login')}>Login</button>
                <button type="button" className={mode === 'signup' ? 'selected' : ''} onClick={() => setMode('signup')}>Create account</button>
              </div>
              {mode === 'signup' && <input required placeholder="Full name" value={form.name} onChange={(event) => update('name', event.target.value)} />}
              <input required type="email" placeholder="Email" value={form.email} onChange={(event) => update('email', event.target.value)} />
              <input required type="password" placeholder="Password" value={form.password} onChange={(event) => update('password', event.target.value)} />
              <button className="secondary-button" type="submit"><LogIn size={18} /> Continue</button>
            </form>
          )}
          <form className="form-grid" onSubmit={placeOrder}>
            <input required placeholder="Full name" value={user?.name || form.name} onChange={(event) => update('name', event.target.value)} />
            <input required type="email" placeholder="Email" value={user?.email || form.email} onChange={(event) => update('email', event.target.value)} />
            <input required placeholder="Phone" value={form.phone} onChange={(event) => update('phone', event.target.value)} />
            <input required placeholder="Delivery address" value={form.address} onChange={(event) => update('address', event.target.value)} />
            <input required placeholder="City" value={form.city} onChange={(event) => update('city', event.target.value)} />
            <input required placeholder="Country" value={form.country} onChange={(event) => update('country', event.target.value)} />
            <button className="primary-button" type="submit"><CreditCard size={18} /> Pay with Paystack</button>
          </form>
          {message && <p className="status-message">{message}</p>}
        </div>
        <aside className="summary-panel">
          <h2><LockKeyhole size={18} /> Order total</h2>
          {cart.length > 0 && (
            <div className="checkout-items">
              {cart.map((item) => (
                <article className="checkout-item" key={item.key}>
                  <img src={assetUrl(item.image)} alt={item.name} loading="lazy" />
                  <div>
                    <h3>{item.name}</h3>
                    <span>Qty {item.quantity}</span>
                  </div>
                  <strong>{money.format(item.price * item.quantity)}</strong>
                </article>
              ))}
            </div>
          )}
          <p><span>Subtotal</span><strong>{money.format(subtotal)}</strong></p>
          <p><span>Shipping</span><strong>{money.format(shipping)}</strong></p>
          <p><span>Tax</span><strong>{money.format(tax)}</strong></p>
          <p className="total"><span>Total</span><strong>{money.format(total)}</strong></p>
        </aside>
      </section>
    </main>
  );
}
