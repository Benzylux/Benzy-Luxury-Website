import React from 'react';
import { useEffect, useState } from 'react';
import { BarChart3, Boxes, PackageCheck, UsersRound } from 'lucide-react';
import Header from '../components/Header.jsx';
import { api } from '../lib/api.js';
import { useStore } from '../context/StoreContext.jsx';

const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export default function AdminPage() {
  const { products, user } = useStore();
  const [snapshot, setSnapshot] = useState({ orders: [], users: [], products });
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.allSettled([api.adminOrders(), api.adminUsers(), api.adminProducts()])
      .then(([orders, users, adminProducts]) => {
        setSnapshot({
          orders: orders.status === 'fulfilled' ? orders.value.orders || [] : [],
          users: users.status === 'fulfilled' ? users.value.users || [] : [],
          products: adminProducts.status === 'fulfilled' ? adminProducts.value.products || products : products
        });
        if (orders.status === 'rejected' || users.status === 'rejected') {
          setError('Sign in with an admin account to unlock protected dashboard data.');
        }
      });
  }, [products]);

  const revenue = snapshot.orders.reduce((sum, order) => sum + Number(order.total || order.totalNgn || 0), 0);

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
        <div className="metric-grid">
          <div><BarChart3 /><span>Revenue</span><strong>{money.format(revenue)}</strong></div>
          <div><PackageCheck /><span>Orders</span><strong>{snapshot.orders.length}</strong></div>
          <div><Boxes /><span>Products</span><strong>{snapshot.products.length}</strong></div>
          <div><UsersRound /><span>Customers</span><strong>{snapshot.users.length}</strong></div>
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
      </section>
    </main>
  );
}
