import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import Orbi from '../../components/Orbi.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as api from '../../lib/api.js';
import { friendlyError } from '../../lib/errors.js';
import { afterAuthPath } from '../../lib/invites.js';

function AuthLayout({ title, sub, children, back = '/welcome' }) {
  return (
    <div className="auth-page">
      <header className="topbar">
        <Link className="back-btn" to={back}><Icon name="chevronLeft" size={20} stroke={2.4} /> Back</Link>
      </header>
      <h1 className="page-title" style={{ marginTop: 20 }}>{title}</h1>
      {sub && <p className="page-sub">{sub}</p>}
      <div style={{ marginTop: 20 }}>{children}</div>
    </div>
  );
}

function useRedirectWhenSignedIn() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (status === 'signedIn') navigate(location.state?.from && location.state.from !== '/' ? location.state.from : afterAuthPath(), { replace: true });
  }, [status, navigate, location.state]);
}

function PasswordField({ id, label, value, onChange, autoComplete, help }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <div className="input-row">
        <input id={id} className="input" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required minLength={8} />
        <button type="button" className="icon-btn" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow((s) => !s)} style={{ height: 52, width: 52 }}>
          <Icon name={show ? 'eyeOff' : 'shield'} size={20} />
        </button>
      </div>
      {help && <p className="help">{help}</p>}
    </div>
  );
}

export function SignIn() {
  useRedirectWhenSignedIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try { await api.auth.signIn({ email: email.trim(), password }); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }

  return (
    <AuthLayout title="Welcome back" sub="Sign in to your spaces.">
      <form className="stack" onSubmit={submit} noValidate>
        <div className="field">
          <label className="label" htmlFor="si-email">Email</label>
          <input id="si-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <PasswordField id="si-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        <Link className="link-btn" to="/forgot">Forgot your password?</Link>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {api.isDemo && <p className="notice"><Icon name="info" size={16} />Demo mode: any email and password signs you in with sample data.</p>}
        <p className="center muted" style={{ fontWeight: 600 }}>New here? <Link className="link-btn" to="/signup">Create an account</Link></p>
      </form>
    </AuthLayout>
  );
}

export function SignUp() {
  useRedirectWhenSignedIn();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Tell us your name — it’s how people in your spaces will see you.'); return; }
    if (form.password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    setBusy(true);
    try {
      const { needsConfirmation } = await api.auth.signUp({ email: form.email.trim(), password: form.password, fullName: form.name.trim() });
      if (needsConfirmation) setSentTo(form.email.trim());
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" back="/signin">
        <div className="card center stack">
          <Orbi mood="thinking" size={120} />
          <p style={{ fontWeight: 600 }}>We sent a link to <strong>{sentTo}</strong>. Open it on this device to finish creating your account.</p>
          <button type="button" className="btn btn-secondary btn-block" onClick={async () => {
            try { await api.auth.resend(sentTo); toast('Sent again'); } catch (err) { toast(friendlyError(err), { tone: 'warn' }); }
          }}>Send the link again</button>
          <p className="small muted">Got an invite to a space? We’ll take you there after you confirm.</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" sub="It takes a minute. Your My Space is ready as soon as you’re in.">
      <form className="stack" onSubmit={submit} noValidate>
        <div className="field">
          <label className="label" htmlFor="su-name">Your name</label>
          <input id="su-name" className="input" autoComplete="name" value={form.name} onChange={set('name')} required />
          <p className="help">People in your shared spaces see this name.</p>
        </div>
        <div className="field">
          <label className="label" htmlFor="su-email">Email</label>
          <input id="su-email" className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
        </div>
        <PasswordField id="su-password" label="Password" value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} autoComplete="new-password" help="At least 8 characters." />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="center muted" style={{ fontWeight: 600 }}>Already have one? <Link className="link-btn" to="/signin">Sign in</Link></p>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try { await api.auth.resetPassword(email.trim()); setSent(true); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }

  return (
    <AuthLayout title="Reset your password" sub="We’ll email you a link to choose a new one." back="/signin">
      {sent ? (
        <p className="notice notice--ok"><Icon name="check" size={16} />If an account exists for {email}, a reset link is on its way.</p>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <div className="field">
            <label className="label" htmlFor="fp-email">Email</label>
            <input id="fp-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    setBusy(true);
    try { await api.auth.updatePassword(password); toast('Password updated'); navigate('/home', { replace: true }); } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }

  return (
    <AuthLayout title="Choose a new password" back="/signin">
      {status === 'signedOut' ? (
        <p className="notice notice--warn"><Icon name="alert" size={16} />This link has expired. Ask for a new reset link and open it on this device.</p>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <PasswordField id="rp-password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" help="At least 8 characters." />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
        </form>
      )}
    </AuthLayout>
  );
}
