import React from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useStore } from '../context/StoreContext.jsx';
import { assetUrl } from '../lib/api.js';
import { getProductDisplayPrice, getProductRegularPrice, getProductSalePrice } from '../lib/productPricing.js';

const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

export default function ProductCard({ product }) {
  const { addToCart } = useStore();
  const salePrice = getProductSalePrice(product);
  const displayPrice = getProductDisplayPrice(product);
  const regularPrice = getProductRegularPrice(product);

  return (
    <article className="product-card">
      <Link to={`/products/${product.slug || product.productId}`} className="product-image-wrap">
        <img src={assetUrl(product.image || product.images?.[0])} alt={product.name} loading="lazy" />
      </Link>
      <div className="product-card-body">
        <div>
          <p className="eyebrow">{product.categoryName || 'Collection'}</p>
          <h3>{product.name}</h3>
          <p className={`card-price${salePrice ? ' is-sale' : ''}`}>
            <span>{money.format(displayPrice)}</span>
            {salePrice ? <span className="compare-price">{money.format(regularPrice)}</span> : null}
          </p>
        </div>
        <button className="icon-button solid" type="button" title="Add to cart" onClick={() => addToCart(product)}>
          <Plus size={18} />
        </button>
      </div>
    </article>
  );
}
