import { useCallback, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSpace } from '../context/SpaceContext.jsx';
import { ShellContext } from '../context/ShellContext.js';
import { isDemo } from '../lib/api.js';
import Icon from './Icon.jsx';
import QuickAdd from './QuickAdd.jsx';
import SpaceSwitcher from './SpaceSwitcher.jsx';
import SpacePill from './SpacePill.jsx';

const MENU_PATHS = ['/menu', '/calendar', '/health', '/spaces', '/profile'];

function Brand() {
  return (
    <span className="brand">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="14" r="11" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="14" cy="14" r="4.5" fill="#4B4FD8" />
        <circle cx="21.8" cy="6.2" r="3.4" fill="#FFC83D" stroke="var(--surface)" strokeWidth="2" />
      </svg>
      DayOrbit
    </span>
  );
}
export { Brand };

export default function AppShell() {
  const [quick, setQuick] = useState(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const { space, isPersonal, has } = useSpace();
  const { pathname } = useLocation();

  const bump = useCallback(() => setDataVersion((v) => v + 1), []);
  const shell = useMemo(() => ({
    openQuickAdd: (type) => setQuick({ type: type || null }),
    openSwitcher: () => setSwitcherOpen(true),
    dataVersion,
    bump,
  }), [dataVersion, bump]);

  if (!space) {
    return <div className="splash"><div className="spinner" role="status" aria-label="Loading your spaces" /></div>;
  }

  const menuActive = MENU_PATHS.some((p) => pathname.startsWith(p));
  const tab = (to, label, icon, active) => (
    <NavLink to={to} className={({ isActive }) => `nav-item ${isActive || active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
      <span className="nav-item__icon"><Icon name={icon} size={21} /></span>
      {label}
    </NavLink>
  );
  const sideLink = (to, label, icon, active) => (
    <NavLink to={to} className={({ isActive }) => `sidebar__link ${isActive || active ? 'active' : ''}`}>
      <Icon name={icon} size={19} /> {label}
    </NavLink>
  );

  return (
    <ShellContext.Provider value={shell}>
      <a href="#main" className="sr-only">Skip to content</a>
      <div className="app">
        <aside className="sidebar" aria-label="Sections">
          <Link to="/home" style={{ color: 'inherit', textDecoration: 'none', padding: '0 8px' }}><Brand /></Link>
          <SpacePill />
          <nav className="sidebar__nav">
            {sideLink('/home', 'Home', 'home')}
            {sideLink('/lists', 'Lists', 'list')}
            {sideLink('/money', 'Money', 'wallet')}
            {has('calendar') && sideLink('/calendar', 'Calendar', 'calendar')}
            {isPersonal && has('health') && sideLink('/health', 'Health', 'heart')}
            {sideLink('/spaces/settings', 'Space settings', 'sliders')}
            {sideLink('/profile', 'Profile & privacy', 'user')}
          </nav>
          <button type="button" className="btn btn-accent sidebar__add" onClick={() => setQuick({ type: null })}>
            <Icon name="plus" size={18} stroke={2.6} /> Add something
          </button>
          {isDemo && <p className="tiny muted" style={{ padding: '0 8px' }}>Demo mode: data stays in this browser.</p>}
        </aside>
        <main className="app-main" id="main">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Main">
        {tab('/home', 'Home', 'home')}
        {tab('/lists', 'Lists', 'list')}
        <button type="button" className="nav-add" aria-label="Add something" onClick={() => setQuick({ type: null })}>
          <span><Icon name="plus" size={26} stroke={2.6} /></span>
        </button>
        {tab('/money', 'Money', 'wallet')}
        {tab('/menu', 'Menu', 'grid', menuActive)}
      </nav>

      <QuickAdd open={!!quick} initialType={quick?.type} onClose={() => setQuick(null)} onSaved={bump} />
      <SpaceSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
      {isDemo && <span className="demo-ribbon" aria-hidden="true">Demo</span>}
    </ShellContext.Provider>
  );
}
