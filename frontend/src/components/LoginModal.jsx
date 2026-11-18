import { useState } from 'react'

const MODES = [
  { value: 'login', label: 'Log In' },
  { value: 'signup', label: 'Sign Up' },
]

// Username/password is the primary path (recoverable from any browser).
// Guest stays as a lower-friction fallback for a quick look. Google/
// Facebook are modeled on the backend but not wired up here yet.
function LoginModal({ onClose, onLoginGuest, onRegisterPassword, onLoginPassword, required = false }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [guestUsername, setGuestUsername] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    if (!username.trim() || !password) {
      setError('Enter a username and password.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'signup') {
        await onRegisterPassword(username.trim(), password)
      } else {
        await onLoginPassword(username.trim(), password)
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Something went wrong - try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGuestSubmit(event) {
    event.preventDefault()
    if (!guestUsername.trim()) {
      setError('Enter a username first.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onLoginGuest(guestUsername.trim())
      onClose()
    } catch (err) {
      setError(err.message || 'Something went wrong - try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="account-backdrop" onClick={onClose}>
      <section className="account-modal" onClick={(event) => event.stopPropagation()}>
        <button className="account-modal-close" onClick={onClose}>✕</button>
        <div className="account-modal-kicker">SHARED LOGIN</div>
        <h2>Sign In</h2>
        <p>{required ? 'Sign in (or create an account) to play.' : 'Log in (or create an account) to appear on the leaderboard.'}</p>

        <div className="account-mode-switch">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              className={mode === m.value ? 'active' : ''}
              onClick={() => { setMode(m.value); setError(null) }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <form onSubmit={handlePasswordSubmit} className="account-guest-form">
          <input
            type="text"
            className="account-username-input"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            maxLength={20}
            autoFocus
          />
          <input
            type="password"
            className="account-username-input"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
          />
          <button type="submit" className="account-guest-submit" disabled={submitting}>
            {submitting ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Log In'}
          </button>
        </form>

        <div className="account-divider">or</div>

        <form onSubmit={handleGuestSubmit} className="account-guest-form">
          <input
            type="text"
            className="account-username-input"
            placeholder="Guest username"
            value={guestUsername}
            onChange={(event) => setGuestUsername(event.target.value)}
            maxLength={20}
          />
          <button type="submit" className="account-guest-submit" disabled={submitting}>
            Continue as Guest
          </button>
        </form>

        {error && <p className="account-error">{error}</p>}

        <div className="account-divider">or</div>

        <button type="button" className="account-provider-button" disabled title="Coming soon">
          <span aria-hidden="true">G</span> Sign in with Google
        </button>
        <button type="button" className="account-provider-button" disabled title="Coming soon">
          <span aria-hidden="true">f</span> Sign in with Facebook
        </button>
      </section>
    </div>
  )
}

export default LoginModal
