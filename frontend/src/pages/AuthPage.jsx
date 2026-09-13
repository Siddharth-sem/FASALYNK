import { useState } from 'react'
import { roles } from '../data/navigation.js'
import { apiRequest, saveSession } from '../lib/api.js'

const emptyForm = { fullName: '', username: '', email: '', password: '', confirmPassword: '', phone: '', otp: '', newPassword: '' }

export default function AuthPage({ mode, navigate, onAuthenticated }) {
  const [step, setStep] = useState(mode === 'register' ? 'register' : mode === 'forgot-password' ? 'forgot' : 'login')
  const [form, setForm] = useState(emptyForm)
  const [role, setRole] = useState('farmer')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function change(event) { setForm({ ...form, [event.target.name]: event.target.value }) }
  async function submit(event) {
    event.preventDefault()
    setMessage('')
    if (step === 'reset' && form.newPassword !== form.confirmPassword) return setMessage('Passwords do not match.')
    setBusy(true)
    try {
      let data
      if (step === 'login') data = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: form.identifier, password: form.password }) })
      if (step === 'register') data = await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify({ ...form, role }) })
      if (step === 'register-verify') data = await apiRequest('/auth/register/verify', { method: 'POST', body: JSON.stringify({ email: form.email, otp: form.otp }) })
      if (step === 'forgot') data = await apiRequest('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: form.email }) })
      if (step === 'forgot-verify') data = await apiRequest('/auth/forgot-password/verify', { method: 'POST', body: JSON.stringify({ email: form.email, otp: form.otp }) })
      if (step === 'reset') data = await apiRequest('/auth/reset-password', { method: 'POST', body: JSON.stringify({ resetToken: form.resetToken, newPassword: form.newPassword }) })
      if (step === 'register') { setStep('register-verify'); setMessage(data.message); return }
      if (step === 'forgot') { setStep('forgot-verify'); setMessage(data.message); return }
      if (step === 'forgot-verify') { setForm({ ...form, resetToken: data.resetToken }); setStep('reset'); setMessage('Email verified. Set your new password.'); return }
      if (step === 'reset' || step === 'register-verify' || step === 'login') { saveSession(data); onAuthenticated(data.user); return }
    } catch (error) { setMessage(error.message) } finally { setBusy(false) }
  }

  const verifying = step === 'register-verify' || step === 'forgot-verify'
  const title = step === 'login' ? 'Welcome back.' : step === 'register' ? 'Join the first transaction.' : verifying ? 'Verify your email.' : step === 'forgot' ? 'Find your way back.' : 'Choose a new password.'
  const intro = step === 'login' ? 'Sign in with your username or email.' : step === 'register' ? 'Choose a role and create your account.' : verifying ? `Enter the 6-digit code sent to ${form.email}.` : step === 'forgot' ? 'Enter your registered email to receive an OTP.' : 'Your password will change after this verified step.'

  return <main className="auth-page"><section className="auth-panel auth-page-panel"><button className="auth-page-back" type="button" onClick={() => navigate('/')}>← Back to FASALYNK</button>{verifying && <div className="otp-window-mark">@</div>}<p className="eyebrow">{verifying ? 'Email verification' : 'FASALYNK account'}</p><h1>{title}</h1><p className="auth-intro">{intro}</p>{verifying && <p className="otp-email-note">Code sent to <strong>{form.email}</strong><br /><span>It expires in 10 minutes.</span></p>}<form onSubmit={submit} className="auth-form">
    {step === 'register' && <><label>Full name<input name="fullName" value={form.fullName} onChange={change} required /></label><label>Username<input name="username" pattern="[a-zA-Z0-9_]{3,40}" value={form.username} onChange={change} required /></label><label>Email<input name="email" type="email" value={form.email} onChange={change} required /></label><label>Phone <span className="optional">optional</span><input name="phone" value={form.phone} onChange={change} /></label><div className="auth-role-choice"><span className="input-label">I am joining as</span><div className="auth-role-buttons">{roles.map((item) => <button className={role === item.id ? 'selected' : ''} type="button" key={item.id} onClick={() => setRole(item.id)}>{item.label}</button>)}</div></div></>}
    {step === 'login' && <label>Username or email<input name="identifier" value={form.identifier || ''} onChange={change} required /></label>}
    {step === 'forgot' && <label>Email<input name="email" type="email" value={form.email} onChange={change} required /></label>}
    {verifying && <label className="otp-field">Verification code<input name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" placeholder="000000" value={form.otp} onChange={change} autoFocus required /></label>}
    {step === 'reset' && <><label>New password<input name="newPassword" type="password" minLength="8" value={form.newPassword} onChange={change} required /></label><label>Confirm new password<input name="confirmPassword" type="password" minLength="8" value={form.confirmPassword} onChange={change} required /></label></>}
    {step === 'login' && <label>Password<input name="password" type="password" value={form.password} onChange={change} required /></label>}
    {message && <p className="auth-error" role="alert">{message}</p>}<button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait...' : step === 'login' ? 'Sign in' : step === 'register' ? 'Create account' : verifying ? 'Verify email' : step === 'forgot' ? 'Send OTP' : 'Reset password'}</button>
  </form>{step === 'login' && <button className="auth-switch" type="button" onClick={() => { setStep('forgot'); setForm(emptyForm()); setMessage('') }}>Forgot password?</button>}{(step === 'login' || step === 'forgot') && <button className="auth-switch" type="button" onClick={() => { setStep('register'); setForm(emptyForm()); setMessage('') }}>Need an account? Register</button>}{step === 'register' && <button className="auth-switch" type="button" onClick={() => setStep('login')}>Already registered? Sign in</button>}</section></main>
}
