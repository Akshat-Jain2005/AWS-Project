import { useState } from 'react'
import { GoogleButton } from '../auth'
import { useAuth } from '../auth-context'
import river from '../assets/river-hero.jpg'
import logoMark from '../assets/logo-mark.png'

const ROLES = [
  { id: 'operator', label: 'Operator' },
  { id: 'reporter', label: 'Verified reporter' },
  { id: 'citizen', label: 'Citizen' },
]

// Split sign-in: a branded river panel on the left, a role-aware card on the
// right. Operators and verified reporters sign in with work email + password +
// a 6-digit TOTP code (invite-only). Citizens sign in or create an account
// (open), with Google as an option.
export default function Auth({ initialRole = 'operator', initialMode = 'signin', onBack }) {
  const {
    clientId, devEnabled, passwordEnabled, staffEnabled,
    loginWithPassword, register, staffLogin, devSignIn,
    busy, notice, configLoading, configError, loadConfig,
  } = useAuth()
  const [role, setRole] = useState(ROLES.some((r) => r.id === initialRole) ? initialRole : 'operator')
  const [mode, setMode] = useState(initialMode === 'register' ? 'register' : 'signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [formError, setFormError] = useState(null)
  const [showDev, setShowDev] = useState(false)
  const [devToken, setDevToken] = useState('')

  const isStaff = role === 'operator' || role === 'reporter'
  const isRegister = role === 'citizen' && mode === 'register'
  const formEnabled = isStaff ? staffEnabled : passwordEnabled
  const heading = isStaff ? `${role === 'operator' ? 'Operator' : 'Verified reporter'} sign-in`
    : isRegister ? 'Create account' : 'Sign in'

  const switchRole = (next) => { setRole(next); setFormError(null); setCode('') }

  const submit = async (event) => {
    event.preventDefault(); setFormError(null)
    if (busy) return
    if (isStaff) {
      if (!email.trim() || !password || !code.trim()) return setFormError('Enter your email, password, and authenticator code.')
      try { await staffLogin(role, email.trim(), password, code.trim()) } catch { /* notice set by context */ }
      return
    }
    if (isRegister) {
      if (!name.trim()) return setFormError('Please enter your name.')
      if (password.length < 8) return setFormError('Password must be at least 8 characters.')
      if (password !== confirm) return setFormError('Passwords do not match.')
      try { await register({ name: name.trim(), email: email.trim(), password }) } catch { /* notice set by context */ }
      return
    }
    if (!email.trim() || !password) return setFormError('Enter your email and password.')
    try { await loginWithPassword(email.trim(), password) } catch { /* notice set by context */ }
  }

  return (
    <div className="site site-auth-screen">
      <div className="site-auth">
        <div className="site-auth-media" style={{ backgroundImage: `url(${river})` }}>
          <div className="site-auth-media-inner">
            <img src={logoMark} alt="" className="site-auth-logo" />
            <h2>Bio-Sentinel</h2>
            <p>Operator access for the Yamuna command center. Sign in to monitor
              stations, review field reports, control gates, and send alerts.</p>
          </div>
        </div>

        <div className="site-auth-form">
          <h2>{heading}</h2>
          <div className="site-seg" role="tablist" aria-label="Sign-in audience">
            {ROLES.map((r) => (
              <button key={r.id} type="button" role="tab" aria-selected={role === r.id}
                className={`site-seg-btn ${role === r.id ? 'is-active' : ''}`}
                onClick={() => switchRole(r.id)}>{r.label}</button>
            ))}
          </div>
          {formEnabled ? (
            <form onSubmit={submit} noValidate>
              {isRegister && (
                <label className="site-field">
                  <span>Full name</span>
                  <input type="text" autoComplete="name" value={name} placeholder="Your name"
                    onChange={(e) => setName(e.target.value)} />
                </label>
              )}
              <label className="site-field">
                <span>{isStaff ? 'Work email' : 'Email'}</span>
                <input type="email" autoComplete="email" value={email}
                  placeholder={isStaff ? 'you@djb.example' : 'you@example.com'}
                  onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="site-field">
                <span>Password</span>
                <div className="site-input-wrap">
                  <input type={showPw ? 'text' : 'password'} value={password} placeholder="Password"
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className="site-reveal" onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}>{showPw ? 'Hide' : 'Show'}</button>
                </div>
                {isRegister && <p className="site-hint">At least 8 characters.</p>}
              </label>
              {isRegister && (
                <label className="site-field">
                  <span>Confirm password</span>
                  <input type={showPw ? 'text' : 'password'} value={confirm} placeholder="Re-enter password"
                    autoComplete="new-password" onChange={(e) => setConfirm(e.target.value)} />
                </label>
              )}
              {isStaff && (
                <label className="site-field">
                  <span>6-digit authenticator code</span>
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code}
                    placeholder="123 456" maxLength={7} onChange={(e) => setCode(e.target.value)} />
                </label>
              )}
              {formError && <p className="site-error" role="alert">{formError}</p>}
              <div className="site-form-foot">
                <span className="site-hint">{busy ? 'Verifying…' : ''}</span>
                <button type="submit" className="site-ticket" disabled={busy}>
                  {isRegister ? 'Create account' : 'Sign in'}
                </button>
              </div>
            </form>
          ) : (
            <p className="site-notice">{isStaff
              ? 'Operator & reporter sign-in is not configured on this server.'
              : 'Email sign-in is not configured on this server.'}</p>
          )}
          {role === 'citizen' && formEnabled && (
            <p className="site-auth-switch">
              {isRegister ? 'Already have an account? ' : 'New here? '}
              <button type="button" onClick={() => { setMode(isRegister ? 'signin' : 'register'); setFormError(null) }}>
                {isRegister ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          )}

          {isStaff && (
            <p className="site-auth-note">Access is invite-only. Citizens don’t need an account —{' '}
              <button type="button" className="site-linkbtn" onClick={onBack}>use the public dashboard</button>.</p>
          )}

          {notice && <p className="site-error" role="alert">{notice}</p>}

          {role !== 'reporter' && clientId && (
            <>
              <p className="site-or">or</p>
              <div className="site-google"><GoogleButton /></div>
            </>
          )}
          {configLoading && <p className="site-notice" role="status">Loading sign-in options…</p>}
          {configError && (
            <p className="site-error" role="alert">{configError}{' '}
              <button type="button" className="site-linkbtn" onClick={loadConfig}>Retry connection</button>
            </p>
          )}

          {devEnabled && (
            <div>
              <button type="button" className="site-dev-toggle" aria-expanded={showDev}
                onClick={() => setShowDev((v) => !v)}>
                {showDev ? 'Hide developer access' : 'Developer access'}
              </button>
              {showDev && (
                <form className="site-field" onSubmit={(e) => { e.preventDefault(); if (devToken.trim() && !busy) devSignIn(devToken) }}>
                  <span>Operator token (local / development)</span>
                  <div className="site-input-wrap">
                    <input type="password" value={devToken} autoComplete="off" placeholder="dev-operator-1"
                      onChange={(e) => setDevToken(e.target.value)} />
                    <button type="submit" className="site-ticket" disabled={!devToken.trim() || busy}>Enter</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {onBack && <button type="button" className="site-auth-back" onClick={onBack}>← Back to overview</button>}
        </div>
      </div>
    </div>
  )
}
