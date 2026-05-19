import React from 'react';
import { useMemo, useState } from 'react';
import { Filter, Search } from 'lucide-react';
import Header from './components/Header.jsx';
import ProductCard from './components/ProductCard.jsx';
import { useStore } from './context/StoreContext.jsx';
import { assetUrl } from './lib/api.js';

export default function App() {
  const { products } = useStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const categories = useMemo(() => {
    const names = products.map((product) => product.categoryName || product.categoryId || 'Collection');
    return ['all', ...Array.from(new Set(names))];
  }, [products]);

  const filteredProducts = products.filter((product) => {
    const matchesCategory = category === 'all' || product.categoryName === category || product.categoryId === category;
    const matchesSearch = product.name.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <main>
      <Header />
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">New season essentials</p>
          <h1>BENZY LUXURY</h1>
          <p>Jerseys, tops, outerwear, and accessories built for daily rotation.</p>
        </div>
        <div className="hero-product-strip" aria-hidden="true">
          {products.slice(0, 3).map((product) => (
            <img key={product.productId} src={assetUrl(product.image || product.images?.[0])} alt="" loading="lazy" />
          ))}
        </div>
      </section>

      <section className="toolbar">
        <label className="search-field">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" />
        </label>
        <label className="select-field">
          <Filter size={18} />
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((name) => (
              <option key={name} value={name}>{name === 'all' ? 'All categories' : name}</option>
            ))}
          </select>
        </label>
      </section>

      <section className="product-grid">
        {filteredProducts.map((product) => <ProductCard key={product.productId} product={product} />)}
      </section>
    </main>
  );
}
