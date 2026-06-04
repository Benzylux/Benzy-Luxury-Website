import React from 'react';
import { useEffect, useState } from 'react';
import { BarChart3, Boxes, LifeBuoy, MailCheck, PackageCheck, Send, UsersRound } from 'lucide-react';
import Header from '../components/Header.jsx';
import { api } from '../lib/api.js';
import { useStore } from '../context/StoreContext.jsx';

const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export default function AdminPage() {
  const { products, user } = useStore();
  const [snapshot, setSnapshot] = useState({ orders: [], users: [], products, emailLogs: [], segments: {}, supportMessages: [] });
  const [campaign, setCampaign] = useState({
    segment: 'customers',
    subject: '',
    message: '',
    ctaLabel: 'Shop Benzy Luxury',
    ctaUrl: ''
  });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.allSettled([api.adminOrders(), api.adminUsers(), api.adminProducts(), api.adminEmailLogs(), api.adminSegments(), api.adminSupportMessages()])
      .then(([orders, users, adminProducts, emailLogs, segments, supportMessages]) => {
        setSnapshot({
          orders: orders.status === 'fulfilled' ? orders.value.orders || [] : [],
          users: users.status === 'fulfilled' ? users.value.users || [] : [],
          products: adminProducts.status === 'fulfilled' ? adminProducts.value.products || products : products,
          emailLogs: emailLogs.status === 'fulfilled' ? emailLogs.value.logs || [] : [],
          segments: segments.status === 'fulfilled' ? segments.value.segments || {} : {},
          supportMessages: supportMessages.status === 'fulfilled' ? supportMessages.value.messages || [] : []
        });
        if (orders.status === 'rejected' || users.status === 'rejected') {
          setError('Sign in with an admin account to unlock protected dashboard data.');
        }
      });
  }, [products]);

  const revenue = snapshot.orders.reduce((sum, order) => sum + Number(order.total || order.totalNgn || 0), 0);
  const orderBuckets = snapshot.orders.reduce((acc, order) => {
    const status = String(order.orderStatus || order.status || 'pending').toLowerCase().replace(/\s+/g, '_');
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const segmentOptions = Object.keys(snapshot.segments).length ? Object.keys(snapshot.segments) : ['customers', 'vipCustomers', 'newsletterSubscribers'];

  async function sendCampaign(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const payload = await api.sendEmailCampaign(campaign);
      setNotice(`Campaign queued: ${payload.campaign?.sent || 0} sent, ${payload.campaign?.failed || 0} failed.`);
      const logs = await api.adminEmailLogs();
      setSnapshot((current) => ({ ...current, emailLogs: logs.logs || current.emailLogs }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function setSupportStatus(messageId, status) {
    const payload = await api.updateSupportMessage(messageId, { status });
    setSnapshot((current) => ({
      ...current,
      supportMessages: current.supportMessages.map((message) => (
        message.messageId === messageId ? payload.message : message
      ))
    }));
  }

  return (
    <main>
      <Header />
      <section className="admin-shell">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">Admin dashboard</p>
            <h1>Operations overview</h1>
          </div>
          <span>{user?.role === 'host' ? 'Host access' : 'Preview mode'}</span>
        </div>
        {error && <p className="status-message">{error}</p>}
        {notice && <p className="status-message">{notice}</p>}
        <div className="metric-grid">
          <div><BarChart3 /><span>Revenue</span><strong>{money.format(revenue)}</strong></div>
          <div><PackageCheck /><span>Orders</span><strong>{snapshot.orders.length}</strong></div>
          <div><Boxes /><span>Products</span><strong>{snapshot.products.length}</strong></div>
          <div><UsersRound /><span>Customers</span><strong>{snapshot.users.length}</strong></div>
          <div><MailCheck /><span>Email logs</span><strong>{snapshot.emailLogs.length}</strong></div>
          <div><LifeBuoy /><span>Support</span><strong>{snapshot.supportMessages.length}</strong></div>
        </div>
        <div className="admin-table-wrap">
          <h2>Order management</h2>
          <div className="status-grid">
            {['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested'].map((status) => (
              <div key={status}><span>{status.replace('_', ' ')}</span><strong>{orderBuckets[status] || 0}</strong></div>
            ))}
          </div>
        </div>
        <div className="admin-table-wrap">
          <h2>Customer segments</h2>
          <div className="status-grid">
            {Object.entries(snapshot.segments).map(([name, count]) => (
              <div key={name}><span>{name.replace(/([A-Z])/g, ' $1')}</span><strong>{count}</strong></div>
            ))}
          </div>
        </div>
        <div className="admin-table-wrap">
          <h2>Product catalog</h2>
          <table>
            <thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Price</th></tr></thead>
            <tbody>
              {snapshot.products.map((product) => (
                <tr key={product.productId}>
                  <td>{product.name}</td>
                  <td>{product.categoryName}</td>
                  <td>{product.stockQuantity}</td>
                  <td>{money.format(product.price || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-table-wrap">
          <h2>Email campaign management</h2>
          <form className="campaign-form" onSubmit={sendCampaign}>
            <select value={campaign.segment} onChange={(event) => setCampaign({ ...campaign, segment: event.target.value })}>
              {segmentOptions.map((name) => (
                <option key={name} value={name}>{name.replace(/([A-Z])/g, ' $1')}</option>
              ))}
            </select>
            <input placeholder="Subject" value={campaign.subject} onChange={(event) => setCampaign({ ...campaign, subject: event.target.value })} />
            <input placeholder="CTA label" value={campaign.ctaLabel} onChange={(event) => setCampaign({ ...campaign, ctaLabel: event.target.value })} />
            <input placeholder="CTA URL" value={campaign.ctaUrl} onChange={(event) => setCampaign({ ...campaign, ctaUrl: event.target.value })} />
            <textarea placeholder="Campaign message" value={campaign.message} onChange={(event) => setCampaign({ ...campaign, message: event.target.value })} />
            <button className="primary-button" type="submit"><Send size={16} /> Send campaign</button>
          </form>
          <table>
            <thead><tr><th>Type</th><th>Recipient</th><th>Status</th><th>Created</th></tr></thead>
            <tbody>
              {snapshot.emailLogs.slice(0, 8).map((log) => (
                <tr key={log.id}>
                  <td>{log.type}</td>
                  <td>{log.toEmail}</td>
                  <td>{log.status}</td>
                  <td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-table-wrap">
          <h2>Customer support management</h2>
          <table>
            <thead><tr><th>Customer</th><th>Subject</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {snapshot.supportMessages.slice(0, 10).map((message) => (
                <tr key={message.messageId}>
                  <td>{message.name}<br /><span className="muted-copy">{message.email}</span></td>
                  <td>{message.subject}</td>
                  <td>{message.status}</td>
                  <td>
                    <button className="secondary-button" type="button" onClick={() => setSupportStatus(message.messageId, 'in_progress')}>In progress</button>
                    <button className="secondary-button" type="button" onClick={() => setSupportStatus(message.messageId, 'resolved')}>Resolved</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
