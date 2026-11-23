import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const SpaceContext = createContext(null);
export const useSpace = () => useContext(SpaceContext);

const KEY = 'dayorbit-space';
const readStored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

export function SpaceProvider({ children }) {
  const { user } = useAuth();
  const [spaces, setSpaces] = useState(null);
  const [currentId, setCurrentId] = useState(readStored);
  const [details, setDetails] = useState({ spaceId: null, members: [], features: {} });
  const [error, setError] = useState(null);

  const refreshSpaces = useCallback(async () => {
    try {
      const list = await api.listSpaces();
      setSpaces(list);
      setError(null);
      return list;
    } catch (e) {
      setError(e);
      return [];
    }
  }, []);

  useEffect(() => { refreshSpaces(); }, [refreshSpaces, user?.id]);

  const space = useMemo(() => {
    if (!spaces?.length) return null;
    return spaces.find((s) => s.id === currentId) || spaces.find((s) => s.type === 'personal') || spaces[0];
  }, [spaces, currentId]);

  useEffect(() => {
    if (!space) return;
    try { localStorage.setItem(KEY, space.id); } catch { /* ignore */ }
    document.documentElement.dataset.accent = space.color;
  }, [space]);

  const refreshDetails = useCallback(async () => {
    if (!space) return;
    const [members, features] = await Promise.all([api.listMembers(space.id), api.getFeatures(space.id)]);
    setDetails({ spaceId: space.id, members, features });
  }, [space]);

  useEffect(() => { refreshDetails().catch(setError); }, [refreshDetails]);

  const value = useMemo(() => {
    const ready = details.spaceId === space?.id;
    const members = ready ? details.members : [];
    const features = ready ? details.features : {};
    const activeMembers = members.filter((m) => !m.left_at);
    const nameOf = (id, { you = true } = {}) => {
      if (id === user?.id && you) return 'You';
      const m = members.find((x) => x.user_id === id);
      if (!m) return 'Someone';
      return m.left_at ? `${m.display_name} (left)` : m.display_name;
    };
    return {
      spaces: spaces || [],
      space,
      ready,
      error,
      members,
      activeMembers,
      features,
      has: (key) => !!features[key],
      isOwner: space?.role === 'owner',
      isPersonal: space?.type === 'personal',
      nameOf,
      switchTo: (id) => setCurrentId(id),
      refreshSpaces,
      refreshDetails,
    };
  }, [spaces, space, details, error, user?.id, refreshSpaces, refreshDetails]);

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}
