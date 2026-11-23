import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brand } from '../components/AppShell.jsx';
import Icon from '../components/Icon.jsx';
import { OrbitScene } from '../components/Illustrations.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import * as api from '../lib/api.js';
import { friendlyError } from '../lib/errors.js';
import { afterAuthPath } from '../lib/invites.js';

export default function Welcome() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => { if (status === 'signedIn') navigate(afterAuthPath(), { replace: true }); }, [status, navigate]);

  const tryDemo = async () => {
    try { await api.auth.signIn({ email: 'aarav@demo.dayorbit.app', password: 'demo' }); } catch (e) { toast(friendlyError(e), { tone: 'warn' }); }
  };

  return (
    <div className="auth-page">
      <header className="row-between" style={{ minHeight: 48 }}>
        <Brand />
        <Link className="link-btn" to="/signin">Sign in</Link>
      </header>
      <div style={{ marginTop: 8 }}><OrbitScene /></div>
      <div className="mt-auto">
        <h1 className="page-title" style={{ fontSize: 38, lineHeight: '44px' }}>
          Your life.<br />Your people.<br /><span style={{ color: '#4B4FD8' }}>Your space.</span>
        </h1>
        <p className="page-sub" style={{ fontSize: 16 }}>Plan your day privately. Share lists, plans and bills only with the people you choose.</p>
      </div>
      <div className="stack-sm" style={{ marginTop: 22 }}>
        <Link className="btn btn-primary btn-lg btn-block" to="/signup">Get started <Icon name="arrowRight" size={18} stroke={2.4} /></Link>
        {api.isDemo ? (
          <button type="button" className="btn btn-secondary btn-block" onClick={tryDemo}>Try the demo with sample data</button>
        ) : (
          <Link className="btn btn-secondary btn-block" to="/signin">I already have an account</Link>
        )}
      </div>
      <p className="small muted" style={{ marginTop: 14, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', fontWeight: 600 }}>
        <Icon name="shield" size={14} /> Private by default. Nothing is shared until you choose.
      </p>
    </div>
  );
}
