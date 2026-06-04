import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Bell, Download, Heart, Home, MailCheck, Package, ReceiptText, RotateCcw, ShieldCheck, Upload, UserRound } from 'lucide-react';
import Header from '../components/Header.jsx';
import { api } from '../lib/api.js';
import { useStore } from '../context/StoreContext.jsx';

const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

function emptyAddress() {
  return { label: 'Home', name: '', phone: '', address: '', city: '', state: '', country: 'Nigeria', postalCode: '', isDefault: true };
}

export default function AccountPage() {
  const { user, setUser, products } = useStore();
  const [mode, setMode] = useState('login');
  const [auth, setAuth] = useState({ name: '', email: '', password: '', code: '' });
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', profilePicture: '' });
  const [addresses, setAddresses] = useState([emptyAddress()]);
  const [wishlist, setWishlist] = useState([]);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api.accountDashboard()
      .then((payload) => {
        const nextUser = payload.user || user;
        setProfile({
          name: nextUser.name || '',
          email: nextUser.email || '',
          phone: nextUser.phone || '',
          profilePicture: nextUser.profilePicture || ''
        });
        setAddresses(nextUser.addresses?.length ? nextUser.addresses : [emptyAddress()]);
        setWishlist(nextUser.wishlist || []);
        setOrders(payload.orders || []);
        setSummary(payload.orderSummary || {});
        setNotifications(payload.notifications || []);
        setUser(nextUser);
      })
      .catch((err) => setError(err.message));
  }, [user?.id]);

  const wishlistChoices = useMemo(() => products.slice(0, 6), [products]);

  async function submitAuth(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      if (mode === 'signup') {
        const payload = await api.signup(auth);
        setUser(payload.user, payload.token);
        setNotice('Account created. Check your inbox for the verification code.');
      } else if (mode === 'otp') {
        if (auth.code) {
          const payload = await api.verifyOtp({ email: auth.email, code: auth.code });
          setUser(payload.user, payload.token);
          setNotice('Signed in with OTP.');
        } else {
          await api.requestOtp({ email: auth.email });
          setNotice('OTP sent to your email.');
        }
      } else if (mode === 'forgot') {
        if (auth.code && auth.password) {
          const payload = await api.resetPassword({ email: auth.email, code: auth.code, password: auth.password });
          setUser(payload.user, payload.token);
          setNotice('Password reset complete.');
        } else {
          await api.forgotPassword({ email: auth.email });
          setNotice('Reset email sent if that account exists.');
        }
      } else {
        const payload = await api.login({ email: auth.email, password: auth.password });
        setUser(payload.user, payload.token);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError('');
    const payload = await api.updateProfile(profile).catch((err) => {
      setError(err.message);
      return null;
    });
    if (!payload) return;
    setUser(payload.user, payload.token);
    setNotice('Profile saved.');
  }

  async function saveAddresses() {
    const payload = await api.updateAddresses(addresses);
    setAddresses(payload.addresses || []);
    setNotice('Addresses saved.');
  }

  async function saveWishlist(nextWishlist) {
    setWishlist(nextWishlist);
    const payload = await api.updateWishlist(nextWishlist);
    setWishlist(payload.wishlist || nextWishlist);
  }

  async function verifyEmail() {
    const payload = await api.verifyEmail({ code: auth.code });
    setUser(payload.user);
    setNotice('Email verified.');
  }

  async function downloadOrderDocument(orderId, type) {
    const token = localStorage.getItem('blx-token');
    const response = await fetch(`${api.baseUrl}/api/orders/${encodeURIComponent(orderId)}/${type}.pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) throw new Error(`Unable to download ${type}.`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${orderId}-${type}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function uploadProfilePicture(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfile((current) => ({ ...current, profilePicture: String(reader.result || '') }));
    reader.readAsDataURL(file);
  }

  if (!user) {
    return (
      <main>
        <Header />
        <section className="account-auth">
          <div>
            <p className="eyebrow">Customer account</p>
            <h1>Sign in to manage BLX orders, receipts, addresses, and notifications.</h1>
          </div>
          <form className="account-panel form-grid" onSubmit={submitAuth}>
            <div className="segmented wide">
              {['login', 'signup', 'otp', 'forgot'].map((item) => (
                <button key={item} type="button" className={mode === item ? 'selected' : ''} onClick={() => setMode(item)}>{item}</button>
              ))}
            </div>
            {mode === 'signup' && <input placeholder="Full name" value={auth.name} onChange={(event) => setAuth({ ...auth, name: event.target.value })} />}
            <input type="email" required placeholder="Email" value={auth.email} onChange={(event) => setAuth({ ...auth, email: event.target.value })} />
            {mode !== 'otp' && <input type="password" placeholder={mode === 'forgot' ? 'New password' : 'Password'} value={auth.password} onChange={(event) => setAuth({ ...auth, password: event.target.value })} />}
            {(mode === 'otp' || mode === 'forgot') && <input placeholder="Email code" value={auth.code} onChange={(event) => setAuth({ ...auth, code: event.target.value })} />}
            <button className="primary-button" type="submit"><ShieldCheck size={18} /> Continue</button>
            {notice && <p className="status-message">{notice}</p>}
            {error && <p className="status-message error">{error}</p>}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main>
      <Header />
      <section className="account-shell">
        <div className="account-heading">
          <div>
            <p className="eyebrow">Customer dashboard</p>
            <h1>{user.name}</h1>
          </div>
          <span>{user.customerSegment || 'customers'}</span>
        </div>

        <div className="metric-grid">
          <div><Package /><span>Orders</span><strong>{summary.total || 0}</strong></div>
          <div><ReceiptText /><span>Delivered</span><strong>{summary.delivered || 0}</strong></div>
          <div><RotateCcw /><span>Returns</span><strong>{summary.returnRequests || 0}</strong></div>
          <div><Heart /><span>Wishlist</span><strong>{wishlist.length}</strong></div>
        </div>

        <div className="account-grid">
          <form className="account-panel form-grid" onSubmit={saveProfile}>
            <h2><UserRound size={20} /> Profile</h2>
            <label className="avatar-upload">
              {profile.profilePicture ? <img src={profile.profilePicture} alt="" /> : <UserRound size={34} />}
              <input type="file" accept="image/*" onChange={uploadProfilePicture} />
              <span><Upload size={16} /> Upload photo</span>
            </label>
            <input placeholder="Name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
            <input type="email" placeholder="Email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} />
            <input placeholder="Phone" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} />
            <button className="primary-button" type="submit">Save profile</button>
            {!user.emailVerified && (
              <div className="inline-actions">
                <input placeholder="Verification code" value={auth.code} onChange={(event) => setAuth({ ...auth, code: event.target.value })} />
                <button className="secondary-button" type="button" onClick={verifyEmail}><MailCheck size={18} /> Verify</button>
              </div>
            )}
          </form>

          <section className="account-panel">
            <h2><Home size={20} /> Saved addresses</h2>
            {addresses.map((address, index) => (
              <div className="address-grid" key={index}>
                {['label', 'name', 'phone', 'address', 'city', 'state', 'country'].map((field) => (
                  <input key={field} placeholder={field} value={address[field] || ''} onChange={(event) => {
                    const next = [...addresses];
                    next[index] = { ...address, [field]: event.target.value };
                    setAddresses(next);
                  }} />
                ))}
              </div>
            ))}
            <div className="inline-actions">
              <button className="secondary-button" type="button" onClick={() => setAddresses([...addresses, emptyAddress()])}>Add address</button>
              <button className="primary-button" type="button" onClick={saveAddresses}>Save addresses</button>
            </div>
          </section>

          <section className="account-panel">
            <h2><Heart size={20} /> Wishlist</h2>
            <div className="wishlist-grid">
              {wishlistChoices.map((product) => {
                const selected = wishlist.some((item) => item.productId === product.productId);
                return (
                  <button key={product.productId} type="button" className={selected ? 'selected' : ''} onClick={() => {
                    const next = selected
                      ? wishlist.filter((item) => item.productId !== product.productId)
                      : [...wishlist, { productId: product.productId, name: product.name, image: product.image, price: product.price }];
                    saveWishlist(next);
                  }}>
                    {product.name}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="account-panel">
            <h2><Bell size={20} /> Notification center</h2>
            {notifications.length ? notifications.map((item) => (
              <p className="notification-row" key={item.id}><strong>{item.title}</strong><span>{item.body}</span></p>
            )) : <p className="muted-copy">No notifications yet.</p>}
          </section>
        </div>

        <section className="account-panel">
          <h2><Package size={20} /> Order history</h2>
          <div className="order-list">
            {orders.map((order) => (
              <article key={order.orderId} className="order-row">
                <div>
                  <strong>{order.orderId}</strong>
                  <span>{order.orderStatus || order.status} · {money.format(order.total || order.totalNaira || 0)}</span>
                </div>
                <div className="inline-actions">
                  <button className="secondary-button" type="button" onClick={() => downloadOrderDocument(order.orderId, 'invoice')}><Download size={16} /> Invoice</button>
                  <button className="secondary-button" type="button" onClick={() => downloadOrderDocument(order.orderId, 'receipt')}><Download size={16} /> Receipt</button>
                  <button className="secondary-button" type="button" onClick={() => api.requestReturn(order.orderId, { reason: 'Customer dashboard request' }).then((payload) => {
                    setOrders((current) => current.map((entry) => entry.orderId === order.orderId ? payload.order : entry));
                  })}><RotateCcw size={16} /> Return</button>
                </div>
              </article>
            ))}
          </div>
        </section>
        {notice && <p className="status-message">{notice}</p>}
        {error && <p className="status-message error">{error}</p>}
      </section>
    </main>
  );
}
