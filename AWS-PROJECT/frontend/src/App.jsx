import { useEffect, useState } from 'react'
import { AuthProvider } from './auth'
import { useAuth } from './auth-context'
import { usePoll } from './api'
import { ReadState } from './ui'
import { conditionMeta, fmtClock } from './format'
import Auth from './views/Auth'
import Home from './views/Home'
import Overview from './views/Overview'
import Incidents from './views/Incidents'
import GateControl from './views/GateControl'
import Alerts from './views/Alerts'
import Audit from './views/Audit'
import Reports from './views/Reports'
import StationWatch from './views/StationWatch'
import LiveDashboard from './views/LiveDashboard'
import logoMark from './assets/logo-mark.png'
import DonationCheckout from './components/donation/DonationCheckout'

const TABS = [
  { id: 'overview', label: 'Overview', c: Overview },
  { id: 'watch', label: 'Station watch', c: StationWatch },
  { id: 'incidents', label: 'Incidents', c: Incidents },
  { id: 'gate', label: 'Intake Gate', c: GateControl },
  { id: 'alerts', label: 'Alerts', c: Alerts },
  { id: 'reports', label: 'Field reports', c: Reports },
  { id: 'audit', label: 'Audit', c: Audit },
]

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

function ConditionBand({ status, user, onSignOut }) {
  const hasReadings = status?.stations?.some((station) => station.updated_at)
  const cond = conditionMeta(hasReadings || status?.incident ? status?.overall : null)
  const shut = status && status.intake_status !== 'OPEN'
  const now = useNow()
  return (
    <div className={`condition-band sev-${cond.sev}`}>
      <div className="condition-lead">
        <span className="condition-kind">Corridor condition</span>
        <strong className="condition-word">{cond.label}</strong>
        <span className="condition-note">{cond.note}</span>
      </div>
      <div className="condition-intake">
        <span className="k">Wazirabad intake</span>
        <strong className={!status ? 'muted' : shut ? 'sev-critical' : 'sev-normal'}>{!status ? 'UNKNOWN' : status.intake_status === 'DIVERTED_TO_BYPASS' ? 'BYPASSED' : shut ? 'CLOSED' : 'OPEN'}</strong>
        {status?.deficit_mgd ? <span className="k">−{status.deficit_mgd} MGD</span> : null}
      </div>
      <div className="condition-ops">
        <span className="clock" aria-label="current time">{fmtClock(Math.floor(now / 1000))}</span>
        <span className="op-name">{user?.name}</span>
        <button type="button" className="btn-ghost" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  )
}

function Console() {
  const { user, signOut } = useAuth()
  const [tab, setTab] = useState('overview')
  const { data, error, loading, refresh } = usePoll('/status', 5000)
  const status = error ? null : data
  const Active = TABS.find((t) => t.id === tab).c

  return (
    <div className="console">
      <a className="skip-link" href="#console-main">Skip to console content</a>
      <ConditionBand status={status} user={user} onSignOut={() => signOut()} />
      <nav className="masthead" aria-label="Operator console">
        <div className="brand">
          <img className="brand-logo" src={logoMark} alt="" />
          <span className="brand-name">Bio-Sentinel</span>
          <span className="brand-sub">Yamuna River Defense · Operator Advisory</span>
        </div>
        <div className="tabs" role="tablist" aria-label="Console views">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-controls="console-main"
              tabIndex={tab === t.id ? 0 : -1}
              aria-selected={tab === t.id}
              className={`tab ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => setTab(t.id)}
              onKeyDown={(event) => {
                const i = TABS.findIndex((item) => item.id === tab)
                const next = event.key === 'ArrowRight' ? (i + 1) % TABS.length
                  : event.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length
                    : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : null
                if (next !== null) {
                  event.preventDefault(); setTab(TABS[next].id)
                  document.getElementById(`tab-${TABS[next].id}`)?.focus()
                }
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <main className="view" id="console-main" tabIndex={-1}>
        <ReadState loading={loading} error={error} retry={refresh} />
        <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
          <Active status={status} refreshStatus={refresh} onNavigate={setTab} />
        </div>
      </main>
    </div>
  )
}

function PortalNav({ user, onSignIn, onSignOut, onLiveDashboard }) {
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
        {member ? (
          <>
            <span className="site-userchip">{user.name}</span>
            <button type="button" className="site-nav-login" onClick={onSignOut}>Sign out</button>
            <button type="button" className="site-nav-dashboard" onClick={onLiveDashboard}>Live dashboard →</button>
          </>
        ) : (
          <>
            <button type="button" className="site-nav-login" onClick={onSignIn}>Operator login</button>
            <button type="button" className="site-nav-dashboard" onClick={onLiveDashboard}>Live dashboard →</button>
          </>
        )}
      </div>
    </nav>
  )
}

// Public portal: everyone lands here. Members get the signed-in experience;
// operators are routed to the Console by Gate. The auth screen is a sub-view.
function Portal() {
  const { user, signOut, notice } = useAuth()
  const [view, setView] = useState('home')   // 'home' | 'auth' | 'dashboard'
  const [authRole, setAuthRole] = useState('operator')  // 'operator' | 'reporter' | 'citizen'
  const [authMode, setAuthMode] = useState('signin')    // citizen: 'signin' | 'register'
  const member = Boolean(user?.role && user.role !== 'public')
  const openAuth = (role, mode = 'signin') => { setAuthRole(role); setAuthMode(mode); setView('auth') }
  const openDashboard = () => setView('dashboard')
  // Members never see the auth screen, but may open the public live dashboard.
  const effectiveView = (member && view === 'auth') ? 'home' : view

  if (effectiveView === 'auth') {
    return <Auth initialRole={authRole} initialMode={authMode} onBack={() => setView('home')} />
  }
  if (effectiveView === 'dashboard') {
    return <LiveDashboard onBack={() => setView('home')} onOpenAuth={openAuth} />
  }
  return (
    <div className="site">
      <PortalNav
        user={user}
        onSignIn={() => openAuth('operator')}
        onRegister={() => openAuth('citizen', 'register')}
        onSignOut={() => { setView('home'); signOut() }}
        onLiveDashboard={openDashboard}
      />
      {notice && <p className="site-portal-notice" role="alert">{notice}</p>}
      <Home onOpenAuth={openAuth} onOpenDashboard={openDashboard} />
    </div>
  )
}

function Gate() {
  const { ready, user } = useAuth()
  if (!ready) return <div className="splash">Resolving session…</div>
  if (user?.role === 'operator') return <Console />
  return <Portal />
}

const isDonateRoute = () =>
  window.location.pathname.startsWith('/donate') || window.location.hash.startsWith('#/donate')

export default function App() {
  const [donate, setDonate] = useState(isDonateRoute)
  useEffect(() => {
    const sync = () => setDonate(isDonateRoute())
    window.addEventListener('hashchange', sync); window.addEventListener('popstate', sync)
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync) }
  }, [])
  if (donate) return <DonationCheckout />
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
