import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import Orbi from '../../components/Orbi.jsx';
import { Brand } from '../../components/AppShell.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as api from '../../lib/api.js';
import { friendlyError } from '../../lib/errors.js';
import { forgetInvite, rememberInvite } from '../../lib/invites.js';
import { COLORS, SPACE_TYPES } from '../../lib/spaceTypes.js';

const hexOf = (id) => COLORS.find((c) => c.id === id)?.hex || '#4B4FD8';

/** Opening an invite link. Works signed out (preview only) and signed in (ask to join). */
export default function JoinSpace() {
  const { token } = useParams();
  const { status, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [preview, setPreview] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    let alive = true;
    setFailed(false);
    api.invitePreview(token).then((p) => alive && setPreview(p)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [token, status]);

  // Signed-in people who haven't finished onboarding do that first; the invite is remembered.
  useEffect(() => {
    if (status === 'signedIn' && profile && !profile.onboarded) {
      rememberInvite(token);
      navigate('/onboarding/about', { replace: true });
    }
  }, [status, profile, token, navigate]);

  async function ask() {
    setBusy(true);
    try {
      const result = await api.requestToJoin(token);
      forgetInvite();
      if (result === 'already_member' || result === 'owner') setPreview((p) => ({ ...p, my_status: 'member' }));
      else if (result === 'pending') { setPreview((p) => ({ ...p, my_status: 'pending' })); toast('Request sent'); }
      else setPreview((p) => ({ ...p, status: result }));
    } catch (err) {
      toast(friendlyError(err), { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await api.cancelJoinRequest(preview.space_id);
      setPreview((p) => ({ ...p, my_status: 'none' }));
      toast('Request cancelled');
    } catch (err) {
      toast(friendlyError(err), { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  }

  function openSpace() {
    try { localStorage.setItem('dayorbit-space', preview.space_id); } catch { /* ignore */ }
    forgetInvite();
    navigate('/home', { replace: true });
  }

  function goAuth(path) {
    rememberInvite(token);
    navigate(path);
  }

  const shell = (children) => (
    <div className="auth-page">
      <header className="row-between" style={{ minHeight: 48 }}>
        <Brand />
        {status === 'signedIn' && <Link className="link-btn" to="/home">Go to my spaces</Link>}
      </header>
      <div className="mt-auto" style={{ marginBottom: 'auto', paddingTop: 24 }}>{children}</div>
    </div>
  );

  if (failed) {
    return shell(
      <div className="center stack">
        <Orbi mood="thinking" size={120} />
        <h1 className="page-title">We couldn’t open this link</h1>
        <p className="page-sub">Check your connection and try again.</p>
        <button type="button" className="btn btn-primary btn-block" onClick={() => window.location.reload()}>Try again</button>
      </div>,
    );
  }
  if (!preview) return shell(<div className="center"><div className="spinner" role="status" aria-label="Opening invite" /></div>);

  const mine = preview.my_status;
  if (preview.status !== 'valid' && mine !== 'member' && mine !== 'owner') {
    const words = {
      expired: ['This invite has expired', 'Invite links work for 14 days. Ask for a new one.'],
      revoked: ['This invite was turned off', 'The owner turned this link off. Ask them for a new one.'],
    }[preview.status] || ['This invite link doesn’t work', 'It may be mistyped or no longer exist. Ask for a new link.'];
    return shell(
      <div className="center stack">
        <Orbi mood="sleepy" size={120} />
        <h1 className="page-title">{words[0]}</h1>
        <p className="page-sub">{words[1]}</p>
        <Link className="btn btn-secondary btn-block" to={status === 'signedIn' ? '/home' : '/welcome'}>{status === 'signedIn' ? 'Go to my spaces' : 'Go to DayOrbit'}</Link>
      </div>,
    );
  }

  const info = SPACE_TYPES[preview.type] || SPACE_TYPES.custom;
  const card = (
    <section className="card center" style={{ padding: 22 }}>
      <span className="icon-tile icon-tile--lg" style={{ background: hexOf(preview.color), color: '#fff', margin: '0 auto' }}><Icon name={preview.icon || info.icon} size={26} /></span>
      <p className="small bold muted" style={{ marginTop: 12 }}>{preview.inviter_name} invited you to</p>
      <h1 className="page-title" style={{ fontSize: 32, lineHeight: '38px' }}>{preview.name}</h1>
      <p className="small bold muted">{info.label} space · {preview.member_count} {Number(preview.member_count) === 1 ? 'member' : 'members'}</p>
    </section>
  );

  if (status !== 'signedIn') {
    return shell(
      <div className="stack">
        {card}
        <p className="notice"><Icon name="info" size={16} />Create an account or sign in to ask to join. Your own My Space stays private.</p>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => goAuth('/signup')}>Create an account</button>
        <button type="button" className="btn btn-secondary btn-block" onClick={() => goAuth('/signin')}>I already have an account</button>
      </div>,
    );
  }

  if (mine === 'member' || mine === 'owner') {
    return shell(
      <div className="stack">
        {card}
        <p className="notice notice--ok"><Icon name="check" size={16} stroke={2.6} />You’re already in {preview.name}.</p>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={openSpace}>Open {preview.name}</button>
      </div>,
    );
  }

  if (mine === 'pending') {
    return shell(
      <div className="stack">
        {card}
        <div className="center"><Orbi mood="thinking" size={96} /></div>
        <p className="notice"><Icon name="clock" size={16} />Waiting for {preview.inviter_name || 'the owner'} to approve you. You’ll see {preview.name} in your space switcher once you’re in.</p>
        <Link className="btn btn-primary btn-block" to="/home">Go to my spaces</Link>
        <button type="button" className="btn btn-quiet btn-block" disabled={busy} onClick={cancel}>Cancel my request</button>
      </div>,
    );
  }

  return shell(
    <div className="stack">
      {card}
      {mine === 'rejected' && <p className="notice notice--warn"><Icon name="alert" size={16} />Your last request wasn’t approved. You can ask again.</p>}
      <p className="notice"><Icon name="shield" size={16} />The owner approves everyone who joins. They’ll see your name — never your My Space or health.</p>
      <button type="button" className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={ask}>{busy ? 'Sending…' : `Ask to join ${preview.name}`}</button>
      <Link className="btn btn-quiet btn-block" to="/home" onClick={() => forgetInvite()}>Not now</Link>
    </div>,
  );
}
