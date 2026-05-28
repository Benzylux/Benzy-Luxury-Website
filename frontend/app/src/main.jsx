import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { StoreProvider } from './context/StoreContext.jsx';
import App from './App.jsx';
import './styles.css';

const ProductPage = lazy(() => import('./pages/ProductPage.jsx'));
const CartPage = lazy(() => import('./pages/CartPage.jsx'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));
const OrdersPage = lazy(() => import('./pages/OrdersPage.jsx'));

inject();
injectSpeedInsights();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <Suspense fallback={<div className="route-loading">Loading Benzy Luxury...</div>}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/products/:slug" element={<ProductPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/dashboard" element={<AdminPage />} />
          </Routes>
        </Suspense>
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>
);
