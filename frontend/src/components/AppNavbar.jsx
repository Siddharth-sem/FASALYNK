import { useState } from 'react'
import Brand from './Brand.jsx'
import cover from '../assets/cover.jpeg'
import { clearSession, readSession } from '../lib/api.js'

export default function AppNavbar({ navigate, user: providedUser, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const user = providedUser || readSession()

  function go(path) {
    setNavOpen(false)
    navigate(path)
  }

  function isActive(path) {
    return window.location.pathname === path || (path !== '/' && window.location.pathname.startsWith(path))
  }

  function signOut() {
    clearSession()
    setMenuOpen(false)
    if (onSignOut) onSignOut()
    else navigate('/')
  }

  function dashboardPath() {
    return user ? `/${user.role.toLowerCase()}/dashboard` : '/login'
  }

  function marketplacePath() {
    if (!user) return '/marketplace'
    if (user.role === 'FARMER') return '/farmer/crops'
    if (user.role === 'TRANSPORTER') return '/transporter/jobs'
    return '/buyer/marketplace'
  }

  function marketplaceLabel() {
    if (!user) return 'Marketplace'
    if (user.role === 'FARMER') return 'My Crop Lots'
    if (user.role === 'TRANSPORTER') return 'Transport Jobs'
    return 'Marketplace'
  }

  return <nav className="app-navbar" style={{ '--navbar-cover': `url(${cover})` }}><div className="app-navbar-left"><button className="navbar-menu-toggle" type="button" aria-label="Toggle navigation" aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}><span /><span /><span /></button><div className={`app-navbar-links ${navOpen ? 'is-open' : ''}`}><button className={isActive('/') ? 'is-active' : ''} type="button" onClick={() => go('/')}>Home</button><button className={isActive(marketplacePath()) ? 'is-active' : ''} type="button" onClick={() => go(marketplacePath())}>{marketplaceLabel()}</button><button className={isActive('/how-it-works') ? 'is-active' : ''} type="button" onClick={() => go('/how-it-works')}>How It Works</button><button className={isActive('/about') ? 'is-active' : ''} type="button" onClick={() => go('/about')}>About Us</button></div></div><div className="navbar-brand-center"><Brand onClick={() => go('/')} /></div><div className="app-navbar-right"><button className="navbar-dashboard" type="button" onClick={() => go(dashboardPath())}>Dashboard</button>{user ? <div className="user-menu"><button className="username-button" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{user.username || user.fullName}<span aria-hidden="true">⌄</span></button>{menuOpen && <div className="user-dropdown"><button type="button" onClick={() => { setMenuOpen(false); go(dashboardPath()) }}>Dashboard</button><button type="button" onClick={() => { setMenuOpen(false); go('/profile') }}>Profile</button><button type="button" onClick={() => { setMenuOpen(false); go('/settings') }}>Settings</button><button type="button" onClick={signOut}>Sign out</button></div>}</div> : <button className="navbar-login" type="button" onClick={() => go('/login')}>Sign in / Login</button>}</div></nav>
}
