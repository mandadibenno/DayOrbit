import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import * as api from '../lib/api.js';
import { friendlyError } from '../lib/errors.js';

export default function Profile() {
  const { user, profile, setProfile, signOut } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile?.display_name || '');
  const [details, setDetails] = useState({ phone_country: '+91', phone: '', age: '', gender: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    api.getPrivateDetails(user.id).then((d) => d && setDetails({
      phone_country: d.phone_country || '+91', phone: d.phone || '', age: d.age ?? '', gender: d.gender || '',
    })).catch(() => {});
  }, [user.id]);

  async function save(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Your name can’t be empty — it’s how people in your spaces see you.'); return; }
    const age = details.age === '' ? null : Number(details.age);
    if (age !== null && (!Number.isInteger(age) || age < 1 || age > 130)) { setError('Age should be a whole number, or leave it empty.'); return; }
    setBusy(true);
    try {
      const updated = await api.updateProfile(user.id, { display_name: name.trim() });
      if (updated) setProfile(updated);
      await api.savePrivateDetails(user.id, { phone_country: details.phone_country, phone: details.phone.trim() || null, age, gender: details.gender || null });
      toast('Profile saved');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (password.length < 8) { toast('Use at least 8 characters.', { tone: 'warn' }); return; }
    setPwBusy(true);
    try { await api.auth.updatePassword(password); setPassword(''); toast('Password changed'); } catch (err) { toast(friendlyError(err), { tone: 'warn' }); } finally { setPwBusy(false); }
  }

  return (
    <div className="page">
      <div className="topbar"><Link className="back-btn" to="/menu"><Icon name="chevronLeft" size={20} stroke={2.4} /> Menu</Link></div>
      <h1 className="page-title" style={{ marginTop: 12 }}>Profile & privacy</h1>

      <form className="stack" style={{ marginTop: 16 }} onSubmit={save} noValidate>
        <section className="card stack">
          <div className="row" style={{ minHeight: 0 }}>
            <Avatar id={user.id} name={name || 'You'} size={56} />
            <div className="field grow">
              <label className="label" htmlFor="pf-name">Display name</label>
              <input id="pf-name" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
          </div>
          <p className="help">People in your shared spaces see this name.</p>
          <div className="field">
            <p className="label">Email</p>
            <p className="bold">{user.email}</p>
          </div>
        </section>

        <section className="card stack">
          <div className="row" style={{ minHeight: 0 }}>
            <span className="icon-tile bg-lavender ink-lavender"><Icon name="lock" size={18} /></span>
            <div className="grow">
              <h2 style={{ fontSize: 15, fontWeight: 800 }}>Private details</h2>
              <p className="small muted bold">Only you can see these</p>
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="pf-phone">Phone</label>
            <div className="input-row">
              <select className="select" aria-label="Country code" style={{ width: 96, flex: 'none' }} value={details.phone_country} onChange={(e) => setDetails((d) => ({ ...d, phone_country: e.target.value }))}>
                {['+91', '+1', '+44', '+61', '+65', '+971'].map((c) => <option key={c}>{c}</option>)}
              </select>
              <input id="pf-phone" className="input" type="tel" inputMode="tel" autoComplete="tel-national" value={details.phone} onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))} />
            </div>
          </div>
          <div className="input-row">
            <div className="field" style={{ width: 100, flex: 'none' }}>
              <label className="label" htmlFor="pf-age">Age</label>
              <input id="pf-age" className="input" inputMode="numeric" value={details.age} onChange={(e) => setDetails((d) => ({ ...d, age: e.target.value.replace(/\D/g, '').slice(0, 3) }))} />
            </div>
            <div className="field grow" style={{ marginTop: 0 }}>
              <label className="label" htmlFor="pf-gender">Gender</label>
              <select id="pf-gender" className="select" value={details.gender} onChange={(e) => setDetails((d) => ({ ...d, gender: e.target.value }))}>
                <option value="">Prefer not to say</option>
                <option>Woman</option>
                <option>Man</option>
                <option>Non-binary</option>
                <option>Self-describe</option>
              </select>
            </div>
          </div>
        </section>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      </form>

      <section className="card" style={{ marginTop: 14 }} aria-labelledby="h-who">
        <h2 id="h-who" className="bold">Who sees what</h2>
        <ul className="stack-sm" style={{ listStyle: 'none', marginTop: 10 }}>
          <li className="row" style={{ minHeight: 0, alignItems: 'flex-start' }}><Icon name="users" size={18} /><span className="small" style={{ fontWeight: 600 }}><strong>People in a shared space</strong> see your name and what you add in that space.</span></li>
          <li className="row" style={{ minHeight: 0, alignItems: 'flex-start' }}><Icon name="lock" size={18} /><span className="small" style={{ fontWeight: 600 }}><strong>Only you</strong> see My Space, your phone, age, gender, medicines and cycle.</span></li>
          <li className="row" style={{ minHeight: 0, alignItems: 'flex-start' }}><Icon name="heart" size={18} /><span className="small" style={{ fontWeight: 600 }}><strong>Your partner</strong> sees cycle dates only if you turn sharing on in a Couple space.</span></li>
        </ul>
      </section>

      {!api.isDemo && (
        <form className="card stack" style={{ marginTop: 14 }} onSubmit={changePassword}>
          <h2 className="bold">Change password</h2>
          <div className="field">
            <label className="label" htmlFor="pf-pw">New password</label>
            <input id="pf-pw" className="input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="help">At least 8 characters.</p>
          </div>
          <button type="submit" className="btn btn-secondary btn-block" disabled={pwBusy || !password}>{pwBusy ? 'Saving…' : 'Change password'}</button>
        </form>
      )}

      <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 14 }} onClick={signOut}><Icon name="logout" size={18} /> Sign out</button>
    </div>
  );
}
