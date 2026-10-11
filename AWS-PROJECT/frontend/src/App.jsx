import { useState } from 'react'
import { AuthProvider } from './auth'
import { useAuth } from './auth-context'
import Auth from './views/Auth'
import Home from './views/Home'
import LiveDashboard from './views/LiveDashboard'
import logoMark from './assets/logo-mark.png'
import DonationCheckout from './components/donation/DonationCheckout'

function PortalNav({ user, onSignIn, onSignOut, onLiveDashboard, onDonate }) {
  const member = Boolean(user?.role && user.role !== 'public')
  return (
    <nav className="site-nav" aria-label="Primary">
      <div className="site-brand">
        <img className="site-logo" src={logoMark} alt="Bio-Sentinel" />
        <span className="site-brand-name">Bio-Sentinel</span>
      </div>
      <div className="site-nav-links">
        <a href="#gap" className="site-nav-link">The gap</a>
        <a href="#sensor" className="site-nav-link">The sensor</a>
        <a href="#how-it-works" className="site-nav-link">How it works</a>
        <a href="#roles" className="site-nav-link">Roles</a>
      </div>
      <div className="site-nav-actions">
        <button type="button" className="site-nav-donate-btn" onClick={onDonate}>
          Donate 💧
        </button>
        {member ? (
          <>
            <span className="site-userchip">{user.name}</span>
            <button type="button" className="site-nav-login" onClick={onSignOut}>Sign out</button>
            <button type="button" className="site-nav-dashboard" onClick={onLiveDashboard}>Live dashboard →</button>
          </>
        ) : (
          <>
            <button type="button" className="site-nav-login" onClick={onSignIn}>Sign in</button>
            <button type="button" className="site-nav-dashboard" onClick={onLiveDashboard}>Live dashboard →</button>
          </>
        )}
      </div>
    </nav>
  )
}

function Portal() {
  const { user, signOut, notice } = useAuth()
  const [view, setView] = useState('home') // 'home' | 'auth' | 'dashboard' | 'donate'
  const [authRole, setAuthRole] = useState('operator') // 'operator' | 'reporter' | 'citizen'
  const [authMode, setAuthMode] = useState('signin') // 'signin' | 'register'
  const member = Boolean(user?.role && user.role !== 'public')

  const openAuth = (role, mode = 'signin', targetView = null) => {
    setAuthRole(role)
    setAuthMode(mode)
    setView('auth')
  }

  // Live dashboard is strictly protected behind authorization wall:
  const openDashboard = () => {
    if (!member) {
      openAuth('operator', 'signin')
    } else {
      setView('dashboard')
    }
  }

  // Donation is locked behind authorization wall:
  const openDonate = () => {
    if (!member) {
      openAuth('citizen', 'signin')
    } else {
      setView('donate')
    }
  }

  // If user just authenticated while on auth view, go directly into live dashboard:
  const effectiveView = (member && view === 'auth') ? 'dashboard' : view

  if (effectiveView === 'auth') {
    return <Auth initialRole={authRole} initialMode={authMode} onBack={() => setView('home')} />
  }

  if (effectiveView === 'dashboard') {
    if (!member) {
      return <Auth initialRole={authRole} initialMode={authMode} onBack={() => setView('home')} />
    }
    return (
      <LiveDashboard
        onBack={() => setView('home')}
        onOpenAuth={openAuth}
        user={user}
        onSignOut={() => {
          setView('home')
          signOut()
        }}
      />
    )
  }

  if (effectiveView === 'donate') {
    if (!member) {
      return <Auth initialRole="citizen" initialMode="signin" onBack={() => setView('home')} />
    }
    return (
      <div className="portal-donation-wrapper">
        <div className="donation-back-banner">
          <button type="button" className="btn-donation-back" onClick={() => setView('home')}>
            ← Return to Landing Page
          </button>
        </div>
        <DonationCheckout onBack={() => setView('home')} />
      </div>
    )
  }

  return (
    <div className="site">
      <PortalNav
        user={user}
        onSignIn={() => openAuth('operator')}
        onRegister={() => openAuth('citizen', 'register')}
        onSignOut={() => { setView('home'); signOut() }}
        onLiveDashboard={openDashboard}
        onDonate={openDonate}
      />
      {notice && <p className="site-portal-notice" role="alert">{notice}</p>}
      <Home onOpenAuth={openAuth} onOpenDashboard={openDashboard} onOpenDonate={openDonate} />
    </div>
  )
}

function Gate() {
  const { ready } = useAuth()
  if (!ready) return <div className="splash">Resolving session…</div>
  return <Portal />
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
