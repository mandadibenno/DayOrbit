import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../lib/api.js';
import { applyTheme } from '../lib/theme.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, profile: null });
  const loadedFor = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(async (user) => {
    if (!user) {
      loadedFor.current = null;
      setState({ status: 'signedOut', user: null, profile: null });
      return;
    }
    if (loadedFor.current === user.id) return;
    loadedFor.current = user.id;
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      await api.ensureSetup(); // creates profile + My Space for new or older accounts
    } catch (error) {
      console.warn('ensure_my_setup failed', error);
    }
    const profile = await api.getProfile(user.id).catch(() => null);
    if (profile?.theme) applyTheme(profile.theme);
    setState({ status: 'signedIn', user, profile });
  }, []);

  useEffect(() => {
    let alive = true;
    api.auth.getUser().then((user) => alive && load(user)).catch(() => alive && load(null));
    const off = api.auth.onChange((event, user) => {
      if (event === 'PASSWORD_RECOVERY') navigate('/reset');
      if (event === 'SIGNED_OUT') load(null);
      else if (user) load(user);
    });
    return () => { alive = false; off(); };
  }, [load, navigate]);

  const refreshProfile = useCallback(async () => {
    if (!state.user) return null;
    const profile = await api.getProfile(state.user.id);
    setState((s) => ({ ...s, profile }));
    return profile;
  }, [state.user]);

  const signOut = useCallback(async () => {
    try { await api.auth.signOut(); } finally {
      loadedFor.current = null;
      setState({ status: 'signedOut', user: null, profile: null });
      navigate('/welcome');
    }
  }, [navigate]);

  const value = useMemo(() => ({
    ...state,
    refreshProfile,
    setProfile: (profile) => setState((s) => ({ ...s, profile })),
    signOut,
  }), [state, refreshProfile, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
