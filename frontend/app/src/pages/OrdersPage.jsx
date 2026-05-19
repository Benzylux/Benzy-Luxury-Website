import React from 'react';
import { useState } from 'react';
import { PackageSearch } from 'lucide-react';
import Header from '../components/Header.jsx';
import { api } from '../lib/api.js';

export default function OrdersPage() {
  const [lookup, setLookup] = useState({ orderId: '', email: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function track(event) {
    event.preventDefault();
    setError('');
    try {
      const payload = await api.trackOrder(lookup);
      setResult(payload.order || payload);
    } catch (err) {
      setResult(null);
      setError(err.message);
    }
  }

  return (
    <main>
      <Header />
      <section className="narrow-page">
        <p className="eyebrow">Order tracking</p>
        <h1>Track your delivery</h1>
        <form className="form-grid" onSubmit={track}>
          <input required placeholder="Order ID" value={lookup.orderId} onChange={(event) => setLookup({ ...lookup, orderId: event.target.value })} />
          <input required type="email" placeholder="Email" value={lookup.email} onChange={(event) => setLookup({ ...lookup, email: event.target.value })} />
          <button className="primary-button" type="submit"><PackageSearch size={18} /> Track order</button>
        </form>
        {error && <p className="status-message error">{error}</p>}
        {result && (
          <article className="tracking-card">
            <h2>{result.orderId}</h2>
            <p>Status: <strong>{result.orderStatus || result.status}</strong></p>
            <p>Payment: <strong>{result.paymentStatus || 'pending'}</strong></p>
          </article>
        )}
      </section>
    </main>
  );
}
