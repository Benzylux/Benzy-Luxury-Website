import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Moon, ShoppingBag, Sun, UserRound } from 'lucide-react';
import { useStore } from '../context/StoreContext.jsx';

export default function Header() {
  const { cart, theme, setTheme, user, logout } = useStore();
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="site-header">
      <Link to="/" className="brand">BENZY LUXURY</Link>
      <nav className="desktop-nav">
        <NavLink to="/">Shop</NavLink>
        <NavLink to="/orders">Track</NavLink>
        <NavLink to="/admin">Admin</NavLink>
      </nav>
      <div className="header-actions">
        <button
          className="icon-button"
          type="button"
          title="Toggle theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        {user ? (
          <button className="profile-chip" type="button" onClick={logout} title="Sign out">
            <UserRound size={16} />
            <span>{user.name?.split(' ')[0] || 'Account'}</span>
          </button>
        ) : (
          <Link to="/checkout" className="profile-chip">
            <UserRound size={16} />
            <span>Sign in</span>
          </Link>
        )}
        <Link to="/cart" className="cart-link" title="Open cart">
          <ShoppingBag size={18} />
          <span>{itemCount}</span>
        </Link>
      </div>
    </header>
  );
}
