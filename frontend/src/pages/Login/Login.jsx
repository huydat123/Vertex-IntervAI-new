import { useState } from 'react'
import { demoAccounts, loginWithDemoAccount } from '../../services/authService.js'
import './Login.css'

export default function Login({ onLogin = () => {} }) {
  const [email, setEmail] = useState(demoAccounts[0].email)
  const [password, setPassword] = useState(demoAccounts[0].password)
  const [error, setError] = useState('')
  const selectedAccount = demoAccounts.find((account) => account.email === email) ?? demoAccounts[0]

  function handleSubmit(event) {
    event.preventDefault()
    setError('')

    try {
      const user = loginWithDemoAccount(email, password)
      onLogin(user)
    } catch (loginError) {
      setError(loginError.message)
    }
  }

  function fillAccount(account) {
    setEmail(account.email)
    setPassword(account.password)
    setError('')
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        <div className="login-brand-panel">
          <div className="login-brand">
            <div className="login-mark"><Icon name="brain" /></div>
            <div>
              <strong>Vertex-IntervAI</strong>
              <span>Talent Graph AI</span>
            </div>
          </div>

          <div className="login-copy">
            <p className="login-eyebrow">Secure Workspace</p>
            <h1>Sign in to continue your AI interview workflow</h1>
            <p>Role-aware access for candidate practice and admin review.</p>
          </div>

          <div className="role-preview">
            <span className={`role-badge ${selectedAccount.role}`}>{selectedAccount.role}</span>
            <strong>{selectedAccount.fullName}</strong>
            <small>{selectedAccount.email}</small>
          </div>
        </div>

        <form className="login-form-panel" onSubmit={handleSubmit}>
          <div className="login-form-header">
            <p>Account Login</p>
            <h2>Welcome back</h2>
          </div>

          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error ? <p className="login-error">{error}</p> : null}

          <button className="login-submit" type="submit">
            <Icon name="login" />
            Sign In
          </button>

          <div className="demo-account-list" aria-label="Demo accounts">
            {demoAccounts.map((account) => (
              <button
                className={`demo-account ${account.role}`}
                type="button"
                key={account.email}
                onClick={() => fillAccount(account)}
              >
                <span>{account.initials}</span>
                <div>
                  <strong>{account.role === 'admin' ? 'Admin' : 'User'}</strong>
                  <small>{account.email}</small>
                </div>
              </button>
            ))}
          </div>
        </form>
      </section>
    </main>
  )
}

function Icon({ name }) {
  const paths = {
    brain: <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v1a3 3 0 0 0 5 2.2M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 0 6v1a3 3 0 0 1-5 2.2M12 5v14M8 10h3M13 10h3M8 15h3M13 15h3" />,
    login: <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />,
  }

  return (
    <svg className="login-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
