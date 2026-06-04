import React from 'react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ShoppingBag } from 'lucide-react';
import Header from '../components/Header.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { assetUrl } from '../lib/api.js';
import { getProductDisplayPrice, getProductRegularPrice, getProductSalePrice } from '../lib/productPricing.js';

const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export default function ProductPage() {
  const { slug } = useParams();
  const { products, addToCart } = useStore();
  const product = useMemo(() => products.find((item) => item.slug === slug || String(item.productId) === slug), [products, slug]);
  const [image, setImage] = useState('');
  const [size, setSize] = useState('M');

  if (!product) {
    return (
      <main>
        <Header />
        <section className="empty-state">Product not found.</section>
      </main>
    );
  }

  const activeImage = image || product.images?.[0] || product.image;
  const salePrice = getProductSalePrice(product);
  const displayPrice = getProductDisplayPrice(product);
  const regularPrice = getProductRegularPrice(product);

  return (
    <main>
      <Header />
      <section className="product-detail">
        <div className="gallery">
          <img className="main-product-image" src={assetUrl(activeImage)} alt={product.name} loading="eager" />
          <div className="thumbnail-row">
            {(product.images?.length ? product.images : [product.image]).map((src) => (
              <button key={src} className="thumbnail" type="button" onClick={() => setImage(src)}>
                <img src={assetUrl(src)} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
        <div className="product-info-panel">
          <Link className="back-link" to="/"><ChevronLeft size={16} /> Back to shop</Link>
          <p className="eyebrow">{product.categoryName || 'Collection'}</p>
          <h1>{product.name}</h1>
          <p className={`price${salePrice ? ' is-sale' : ''}`}>
            <span>{money.format(displayPrice)}</span>
            {salePrice ? <span className="compare-price">{money.format(regularPrice)}</span> : null}
          </p>
          <div className="option-group">
            <span>Size</span>
            <div className="segmented">
              {sizes.map((value) => (
                <button key={value} className={size === value ? 'selected' : ''} type="button" onClick={() => setSize(value)}>
                  {value}
                </button>
              ))}
            </div>
          </div>
          <button className="primary-button" type="button" onClick={() => addToCart(product, { size })}>
            <ShoppingBag size={18} /> Add to cart
          </button>
          <dl className="product-meta">
            <div><dt>Stock</dt><dd>{product.stockQuantity || 0} available</dd></div>
            <div><dt>Delivery</dt><dd>Lagos 1-2 business days</dd></div>
            <div><dt>Checkout</dt><dd>Paystack card, transfer, and mobile money</dd></div>
          </dl>
        </div>
      </section>
    </main>
  );
}
