import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as api from '../../lib/api.js';
import { friendlyError } from '../../lib/errors.js';
import { pendingInvite } from '../../lib/invites.js';
import { SHARED_TYPES, SPACE_TYPES, COLORS } from '../../lib/spaceTypes.js';

function Steps({ step }) {
  return (
    <header className="topbar">
      {step > 1 ? <Link className="icon-btn" to="/onboarding/about" aria-label="Back"><Icon name="chevronLeft" size={20} stroke={2.4} /></Link> : <span style={{ width: 48 }} />}
      <div className="stepper-dots grow" aria-hidden="true">
        {[1, 2, 3].map((n) => <span key={n} className={n <= step + 1 ? 'on' : ''} />)}
      </div>
      <span className="small bold muted">Step {step + 1} of 3</span>
    </header>
  );
}

export function AboutYou() {
  const { user, profile, setProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.display_name || '');
  const [details, setDetails] = useState({ phone_country: '+91', phone: '', age: '', gender: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPrivateDetails(user.id).then((d) => d && setDetails({
      phone_country: d.phone_country || '+91', phone: d.phone || '', age: d.age ?? '', gender: d.gender || '',
    })).catch(() => {});
  }, [user.id]);

  async function next(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Add the name people in your spaces will see.'); return; }
    const age = details.age === '' ? null : Number(details.age);
    if (age !== null && (!Number.isInteger(age) || age < 1 || age > 130)) { setError('Age should be a whole number, or leave it empty.'); return; }
    setBusy(true);
    try {
      const updated = await api.updateProfile(user.id, { display_name: name.trim() });
      if (updated) setProfile(updated);
      await api.savePrivateDetails(user.id, { phone_country: details.phone_country, phone: details.phone.trim() || null, age, gender: details.gender || null });
      navigate('/onboarding/spaces');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <Steps step={1} />
      <h1 className="page-title" style={{ marginTop: 20 }}>Nice to meet you</h1>
      <p className="page-sub">A few details to personalise DayOrbit. Everything except your name is optional.</p>
      <form className="stack" style={{ marginTop: 18 }} onSubmit={next} noValidate>
        <div className="row" style={{ minHeight: 0 }}>
          <Avatar id={user.id} name={name || 'You'} size={56} />
          <div className="field grow">
            <label className="label" htmlFor="ob-name">Display name</label>
            <input id="ob-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
        </div>
        <p className="help" style={{ marginTop: -6 }}>People in your shared spaces see this name.</p>

        <section className="card stack">
          <div className="row" style={{ minHeight: 0 }}>
            <span className="icon-tile bg-lavender ink-lavender"><Icon name="lock" size={18} /></span>
            <div className="grow">
              <h2 style={{ fontSize: 15, fontWeight: 800 }}>Private details</h2>
              <p className="small muted bold">Only you can see these</p>
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="ob-phone">Phone <span className="muted">· optional</span></label>
            <div className="input-row">
              <select className="select" aria-label="Country code" style={{ width: 96, flex: 'none' }} value={details.phone_country} onChange={(e) => setDetails((d) => ({ ...d, phone_country: e.target.value }))}>
                {['+91', '+1', '+44', '+61', '+65', '+971'].map((c) => <option key={c}>{c}</option>)}
              </select>
              <input id="ob-phone" className="input" type="tel" inputMode="tel" autoComplete="tel-national" value={details.phone} onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))} />
            </div>
          </div>
          <div className="input-row">
            <div className="field" style={{ width: 100, flex: 'none' }}>
              <label className="label" htmlFor="ob-age">Age</label>
              <input id="ob-age" className="input" inputMode="numeric" value={details.age} onChange={(e) => setDetails((d) => ({ ...d, age: e.target.value.replace(/\D/g, '').slice(0, 3) }))} />
            </div>
            <div className="field grow" style={{ marginTop: 0 }}>
              <label className="label" htmlFor="ob-gender">Gender</label>
              <select id="ob-gender" className="select" value={details.gender} onChange={(e) => setDetails((d) => ({ ...d, gender: e.target.value }))}>
                <option value="">Prefer not to say</option>
                <option>Woman</option>
                <option>Man</option>
                <option>Non-binary</option>
                <option>Self-describe</option>
              </select>
            </div>
          </div>
          <p className="notice"><Icon name="info" size={16} /><span><strong>Why we ask:</strong> age can tailor health features; phone is for account recovery. Space members never see either.</span></p>
        </section>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Saving…' : 'Continue'}</button>
        <Link className="btn btn-quiet btn-block" to="/onboarding/spaces">Skip for now · edit any time in Profile</Link>
      </form>
    </div>
  );
}

export function YourSpaces() {
  const { user, setProfile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [invite, setInvite] = useState(null);
  const token = pendingInvite();

  useEffect(() => {
    if (token) api.invitePreview(token).then(setInvite).catch(() => setInvite(null));
  }, [token]);

  async function finish(next) {
    try {
      const updated = await api.updateProfile(user.id, { onboarded: true });
      if (updated) setProfile(updated);
      navigate(next, { replace: true });
    } catch (err) {
      toast(friendlyError(err), { tone: 'warn' });
    }
  }

  return (
    <div className="auth-page">
      <Steps step={2} />
      {invite?.status === 'valid' && (
        <p className="notice notice--ok" role="status" style={{ marginTop: 14 }}>
          <Icon name="link" size={16} />
          <span><strong>{invite.inviter_name}</strong> invited you to <strong>{invite.name}</strong>. We’ll ask to join when you finish.</span>
        </p>
      )}
      <h1 className="page-title" style={{ marginTop: 16 }}>Your spaces</h1>
      <p className="page-sub">A space keeps things for one group of people. Things you add stay inside that space.</p>

      <section className="card row" style={{ marginTop: 14, border: '2px solid #4B4FD8', minHeight: 0, padding: '14px 16px' }}>
        <span className="icon-tile icon-tile--lg" style={{ background: '#4B4FD8', color: '#fff' }}><Icon name="user" size={23} /></span>
        <span className="grow">
          <span className="row__title" style={{ fontSize: 17, fontWeight: 800 }}>My Space <span className="small" style={{ color: '#3A3EB8' }}>· ready</span></span>
          <span className="row__meta">Just for you. Nobody else can see it.</span>
        </span>
        <Icon name="check" size={22} stroke={3} label="Created" />
      </section>

      <h2 style={{ marginTop: 18, fontSize: 15, fontWeight: 800 }}>Share with people? <span className="muted" style={{ fontWeight: 600 }}>You can skip this</span></h2>
      <ul className="list stack-sm" style={{ marginTop: 8 }}>
        {SHARED_TYPES.filter((t) => t !== 'custom').map((t) => {
          const info = SPACE_TYPES[t];
          const hex = COLORS.find((c) => c.id === info.color).hex;
          return (
            <li key={t}>
              <button type="button" className="row row--button card card--flat" style={{ padding: '6px 14px 6px 8px', minHeight: 60 }} onClick={() => finish(`/spaces/new?type=${t}`)}>
                <span className="icon-tile" style={{ background: hex, color: '#fff' }}><Icon name={info.icon} size={21} /></span>
                <span className="row__main">
                  <span className="row__title" style={{ fontSize: 15, fontWeight: 800 }}>{info.label}</span>
                  <span className="row__meta">{info.blurb}</span>
                </span>
                <Icon name="chevronRight" size={16} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="stack-sm" style={{ marginTop: 'auto', paddingTop: 20 }}>
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => finish(token ? `/join/${token}` : '/home')}>
          {token ? 'Continue to the invite' : 'Go to My Space'} <Icon name="arrowRight" size={18} stroke={2.4} />
        </button>
        <p className="center small muted bold">You can add more spaces any time.</p>
      </div>
    </div>
  );
}
