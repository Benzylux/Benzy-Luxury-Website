import React from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2 } from 'lucide-react';
import Header from '../components/Header.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { assetUrl } from '../lib/api.js';

const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export default function CartPage() {
  const { cart, subtotal, shipping, tax, total, updateQuantity, removeFromCart } = useStore();

  return (
    <main>
      <Header />
      <section className="checkout-layout">
        <div>
          <p className="eyebrow">Cart</p>
          <h1>Your bag</h1>
          {cart.length === 0 ? (
            <div className="empty-state">Your cart is empty. <Link to="/">Shop the collection</Link></div>
          ) : cart.map((item) => (
            <article className="cart-line" key={item.key}>
              <img src={assetUrl(item.image)} alt={item.name} loading="lazy" />
              <div>
                <h3>{item.name}</h3>
                <p>{item.size} {item.color ? `• ${item.color}` : ''}</p>
                <strong>{money.format(item.price)}</strong>
              </div>
              <div className="quantity-control">
                <button type="button" onClick={() => updateQuantity(item.key, item.quantity - 1)}><Minus size={16} /></button>
                <span>{item.quantity}</span>
                <button type="button" onClick={() => updateQuantity(item.key, item.quantity + 1)}><Plus size={16} /></button>
              </div>
              <button className="icon-button" type="button" title="Remove item" onClick={() => removeFromCart(item.key)}>
                <Trash2 size={17} />
              </button>
            </article>
          ))}
        </div>
        <aside className="summary-panel">
          <h2>Summary</h2>
          <p><span>Subtotal</span><strong>{money.format(subtotal)}</strong></p>
          <p><span>Shipping</span><strong>{money.format(shipping)}</strong></p>
          <p><span>Tax</span><strong>{money.format(tax)}</strong></p>
          <p className="total"><span>Total</span><strong>{money.format(total)}</strong></p>
          <Link className="primary-button" to="/checkout">Checkout</Link>
        </aside>
      </section>
    </main>
  );
}
