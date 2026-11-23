import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import SpacePill from '../components/SpacePill.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { Segmented } from '../components/Controls.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSpace } from '../context/SpaceContext.jsx';
import { useShell } from '../context/ShellContext.js';
import * as api from '../lib/api.js';
import { applyTheme, storedTheme } from '../lib/theme.js';

export default function Menu() {
  const { user, profile, setProfile, signOut } = useAuth();
  const { has, isPersonal, isOwner } = useSpace();
  const { openSwitcher } = useShell();
  const [theme, setTheme] = useState(storedTheme());
  const [resetting, setResetting] = useState(false);

  async function changeTheme(value) {
    setTheme(value);
    applyTheme(value);
    try {
      const updated = await api.updateProfile(user.id, { theme: value });
      if (updated) setProfile(updated);
    } catch { /* the choice still applies on this device */ }
  }

  const tiles = [
    has('calendar') && { to: '/calendar', icon: 'calendar', label: 'Calendar', sub: 'Events and due dates', tone: 'sky' },
    isPersonal && has('health') && { to: '/health', icon: 'heart', label: 'Health', sub: 'Private to you', tone: 'blush' },
    { to: '/spaces/settings', icon: 'sliders', label: 'Space settings', sub: isOwner && !isPersonal ? 'Members, invites, features' : 'Features and members', tone: 'lavender' },
    { to: '/profile', icon: 'user', label: 'Profile & privacy', sub: 'Your name and details', tone: 'mint' },
    { onClick: openSwitcher, icon: 'swap', label: 'Switch space', sub: 'Or join with a link', tone: 'butter' },
    { to: '/spaces/new', icon: 'plus', label: 'New space', sub: 'Family, friends, couple…', tone: 'peach' },
  ].filter(Boolean);

  return (
    <div className="page">
      <h1 className="page-title" style={{ marginTop: 8 }}>Menu</h1>

      <Link to="/profile" className="card row row--button" style={{ marginTop: 14, padding: '12px 16px' }}>
        <Avatar id={user.id} name={profile?.display_name || 'You'} size={48} />
        <span className="row__main">
          <span className="row__title" style={{ fontSize: 17, fontWeight: 800 }}>{profile?.display_name || 'You'}</span>
          <span className="row__meta">{user.email}</span>
        </span>
        <Icon name="chevronRight" size={16} />
      </Link>

      <div style={{ marginTop: 14 }}><SpacePill /></div>

      <div className="qa-grid" style={{ marginTop: 14 }}>
        {tiles.map((t) => {
          const body = (
            <>
              <span className={`qa-tile__icon ink-${t.tone}`}><Icon name={t.icon} size={22} stroke={2.2} /></span>
              <span>
                <span className="qa-tile__name">{t.label}</span>
                <span className={`qa-tile__blurb ink-${t.tone}`}>{t.sub}</span>
              </span>
            </>
          );
          return t.to
            ? <Link key={t.label} to={t.to} className={`qa-tile bg-${t.tone}`} style={{ textDecoration: 'none' }}>{body}</Link>
            : <button key={t.label} type="button" className={`qa-tile bg-${t.tone}`} onClick={t.onClick}>{body}</button>;
        })}
      </div>

      <section className="card" style={{ marginTop: 14 }} aria-labelledby="h-look">
        <h2 id="h-look" className="bold" style={{ marginBottom: 10 }}>Appearance</h2>
        <Segmented kind="radio" label="Theme" value={theme} onChange={changeTheme} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </section>

      <div className="stack-sm" style={{ marginTop: 14 }}>
        {api.isDemo && (
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setResetting(true)}>
            <Icon name="refresh" size={18} /> Reset demo data
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-block" onClick={signOut}><Icon name="logout" size={18} /> Sign out</button>
      </div>
      <p className="tiny muted bold center" style={{ marginTop: 16, display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
        <Icon name="shield" size={13} /> Private by default · DayOrbit {api.isDemo ? '· demo mode' : ''}
      </p>

      <ConfirmDialog
        open={resetting}
        title="Reset the demo?"
        confirmLabel="Reset"
        onCancel={() => setResetting(false)}
        onConfirm={() => { api.resetDemo(); window.location.reload(); }}
      >
        <p>Everything you changed in the demo goes back to the sample data.</p>
      </ConfirmDialog>
    </div>
  );
}
