import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomSheet from './BottomSheet.jsx';
import Icon from './Icon.jsx';
import { useSpace } from '../context/SpaceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import * as api from '../lib/api.js';
import { COLORS, SPACE_TYPES } from '../lib/spaceTypes.js';
import { friendlyError } from '../lib/errors.js';
import { spaceSubtitle } from './SpacePill.jsx';

const colorHex = (id) => COLORS.find((c) => c.id === id)?.hex || '#4B4FD8';

export function tokenFromLink(text) {
  const t = String(text || '').trim();
  const m = t.match(/join\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{8,}$/.test(t) ? t : null;
}

export default function SpaceSwitcher({ open, onClose }) {
  const { spaces, space, switchTo } = useSpace();
  const navigate = useNavigate();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [joining, setJoining] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setJoining(false); setLink(''); setError('');
    api.listMyJoinRequests().then((r) => setRequests(r.filter((x) => x.status === 'pending'))).catch(() => setRequests([]));
  }, [open]);

  const pick = (id) => { switchTo(id); onClose(); navigate('/home'); };

  const join = (e) => {
    e.preventDefault();
    const token = tokenFromLink(link);
    if (!token) { setError('That doesn’t look like a DayOrbit invite link.'); return; }
    onClose();
    navigate(`/join/${token}`);
  };

  const cancel = async (r) => {
    try {
      await api.cancelJoinRequest(r.space_id);
      setRequests((list) => list.filter((x) => x.id !== r.id));
      toast('Request cancelled');
    } catch (err) { toast(friendlyError(err), { tone: 'warn' }); }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Your spaces">
      <p className="muted" style={{ fontWeight: 600, marginTop: -4 }}>Each space is separate. What you add stays in the space you’re in.</p>
      <ul className="list stack-sm" style={{ marginTop: 14 }}>
        {spaces.map((s) => {
          const current = s.id === space?.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                className="row row--button"
                aria-current={current ? 'true' : undefined}
                onClick={() => pick(s.id)}
                style={{ padding: '8px 12px', borderRadius: 18, border: current ? `2px solid ${colorHex(s.color)}` : '1px solid var(--line)', minHeight: 66 }}
              >
                <span className="icon-tile" style={{ background: colorHex(s.color), color: '#fff' }}><Icon name={s.icon} size={21} /></span>
                <span className="row__main">
                  <span className="row__title">{s.name}</span>
                  <span className="row__meta">{s.type === 'personal' ? 'Only you' : `${SPACE_TYPES[s.type]?.label} · ${spaceSubtitle(s).replace('Shared with ', '')}`}</span>
                </span>
                {current ? <span className="badge">You’re here</span> : <Icon name="chevronRight" size={16} />}
              </button>
            </li>
          );
        })}
        {requests.map((r) => (
          <li key={r.id} className="row" style={{ padding: '8px 12px', borderRadius: 18, border: '1.5px dashed var(--line)', minHeight: 66 }}>
            <span className="icon-tile" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}><Icon name="clock" size={21} /></span>
            <span className="row__main">
              <span className="row__title">{r.space_name}</span>
              <span className="row__meta">Waiting for {r.owner_name} to let you in</span>
            </span>
            <button type="button" className="btn btn-sm btn-quiet" onClick={() => cancel(r)}>Cancel</button>
          </li>
        ))}
      </ul>

      {joining ? (
        <form className="stack" style={{ marginTop: 16 }} onSubmit={join}>
          <div className="field">
            <label className="label" htmlFor="join-link">Paste the invite link</label>
            <input id="join-link" className="input" autoFocus value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…/join/…" />
            {error && <p className="error-text" role="alert"><Icon name="alert" size={14} />{error}</p>}
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={() => setJoining(false)}>Back</button>
            <button type="submit" className="btn btn-primary">Continue</button>
          </div>
        </form>
      ) : (
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={() => { onClose(); navigate('/spaces/new'); }}>
            <Icon name="plus" size={18} stroke={2.6} /> New space
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setJoining(true)}>
            <Icon name="link" size={18} /> Join with a link
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
