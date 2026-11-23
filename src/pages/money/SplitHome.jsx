import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import BottomSheet from '../../components/BottomSheet.jsx';
import { AvatarStack } from '../../components/Avatar.jsx';
import { BeachScene, PartyScene } from '../../components/Illustrations.jsx';
import { EmptyState, LoadError, Loading, Segmented } from '../../components/Controls.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSpace } from '../../context/SpaceContext.jsx';
import { useShell } from '../../context/ShellContext.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useLoad } from '../../hooks/useLoad.js';
import * as api from '../../lib/api.js';
import { formatRange } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { formatINR } from '../../lib/money.js';
import { BalanceBadge, netColor, pickGroup } from './moneyUi.jsx';

export default function SplitHome() {
  const { user } = useAuth();
  const { space, nameOf } = useSpace();
  const { dataVersion } = useShell();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data, error, loading, reload } = useLoad(() => api.loadSplit(space.id), [space.id, dataVersion]);

  const creating = params.get('new') === '1';
  const setCreating = (open) => {
    const next = new URLSearchParams(params);
    if (open) next.set('new', '1'); else next.delete('new');
    setParams(next, { replace: true });
  };

  const { groups, older, overall } = useMemo(() => {
    if (!data) return { groups: [], older: null, overall: 0 };
    const list = data.groups.map((g) => {
      const v = pickGroup(data, g.id);
      const people = new Set();
      for (const e of v.expenses) { people.add(e.paid_by); e.allocations.forEach((a) => people.add(a.user_id)); }
      return { ...g, total: v.total, count: v.expenses.length, myNet: v.balances.get(user.id)?.net || 0, people: [...people] };
    }).sort((a, b) => (b.starts_on || b.created_at).localeCompare(a.starts_on || a.created_at));
    const o = pickGroup(data, 'older');
    const olderInfo = o.group ? { total: o.total, count: o.expenses.length, payments: o.settlements.length, myNet: o.balances.get(user.id)?.net || 0 } : null;
    const sum = list.reduce((s, g) => s + g.myNet, 0) + (olderInfo?.myNet || 0);
    return { groups: list, older: olderInfo, overall: sum };
  }, [data, user.id]);

  if (loading && !data) return <Loading rows={3} />;

  return (
    <div className="stack">
      <LoadError error={error} onRetry={reload} />

      {data && (groups.length > 0 || older) && (
        <section className="card row" style={{ minHeight: 0 }}>
          <div className="grow">
            <p className="eyebrow">Overall in {space.name}</p>
            <p className="display tabular" style={{ fontSize: 28, fontWeight: 800, lineHeight: '34px', color: netColor(overall) }}>
              {overall === 0 ? 'All settled' : overall > 0 ? `You get back ${formatINR(overall)}` : `You owe ${formatINR(-overall)}`}
            </p>
            <p className="small muted bold">Each trip or event keeps its own balance.</p>
          </div>
        </section>
      )}

      <div className="row-between" style={{ marginTop: 18 }}>
        <h2 className="section-title">Trips & events</h2>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} stroke={2.6} /> New
        </button>
      </div>

      {data && groups.length === 0 && (
        <div className="card">
          <EmptyState mood="hello" title="Plan a trip or event" action={<button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={18} /> New trip or event</button>}>
            Add costs as you go. DayOrbit works out who owes who, to the paisa.
          </EmptyState>
        </div>
      )}

      {groups.map((g) => (
        <Link key={g.id} to={`/money/group/${g.id}`} className="postcard" aria-label={`${g.name}. ${g.myNet > 0 ? `You get back ${formatINR(g.myNet)}` : g.myNet < 0 ? `You owe ${formatINR(-g.myNet)}` : 'Settled'}`}>
          <div className="postcard__art">
            {g.kind === 'event' ? <PartyScene /> : <BeachScene sway={false} />}
            <span className="postcard__tag badge" style={{ background: '#fff', color: '#14161c' }}>
              <Icon name={g.kind === 'event' ? 'gift' : 'pin'} size={12} stroke={2.4} />
              {g.kind === 'event' ? 'Event' : 'Trip'}{g.starts_on ? ` · ${formatRange(g.starts_on, g.ends_on)}` : ''}
            </span>
          </div>
          <div className="postcard__body">
            <div className="grow">
              <p className="display" style={{ fontSize: 21, fontWeight: 800, lineHeight: '26px' }}>{g.name}</p>
              <p className="small muted bold" style={{ marginTop: 2 }}>
                {g.count ? `${formatINR(g.total)} spent · ${g.count} ${g.count === 1 ? 'cost' : 'costs'}` : 'No costs yet — add the first one'}
              </p>
              <div style={{ marginTop: 8 }}><BalanceBadge net={g.myNet} /></div>
            </div>
            {g.people.length > 0 && <AvatarStack people={g.people.map((id) => ({ id, name: nameOf(id, { you: false }) }))} max={4} size={30} />}
          </div>
        </Link>
      ))}

      {older && (
        <Link to="/money/group/older" className="card card--flat row row--button" style={{ padding: '12px 16px' }}>
          <span className="icon-tile bg-sky ink-sky"><Icon name="archive" size={19} /></span>
          <span className="row__main">
            <span className="row__title">Older costs</span>
            <span className="row__meta">{older.count} {older.count === 1 ? 'cost' : 'costs'} from before trips & events · {formatINR(older.total)}</span>
            <span style={{ display: 'block', marginTop: 6 }}><BalanceBadge net={older.myNet} /></span>
          </span>
          <Icon name="chevronRight" size={16} />
        </Link>
      )}

      <GroupSheet open={creating} onClose={() => setCreating(false)} onSaved={(g) => { setCreating(false); navigate(`/money/group/${g.id}`); }} />
    </div>
  );
}

/** Create or edit a trip/event. */
export function GroupSheet({ open, onClose, group = null, onSaved, onDelete }) {
  const { space } = useSpace();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', kind: 'trip', starts_on: '', ends_on: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!open) return;
    setForm({
      name: group?.name || '', kind: group?.kind || 'trip', starts_on: group?.starts_on || '', ends_on: group?.ends_on || '', description: group?.description || '',
    });
    setError('');
  }, [open, group]);

  async function save(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError(form.kind === 'trip' ? 'Give it a name, like “Goa Trip”.' : 'Give it a name, like “Diya’s birthday”.'); return; }
    if (form.kind === 'trip' && form.starts_on && form.ends_on && form.ends_on < form.starts_on) { setError('The last day is before the first day.'); return; }
    const row = {
      name: form.name.trim(),
      kind: form.kind,
      starts_on: form.starts_on || null,
      ends_on: form.kind === 'trip' ? form.ends_on || null : null,
      description: form.description.trim() || null,
    };
    setBusy(true);
    try {
      const saved = group ? await api.updateGroup(group.id, row) : await api.createGroup(space.id, row);
      toast(group ? 'Saved' : `${row.name} is ready`);
      onSaved?.(saved);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={group ? 'Edit details' : 'New trip or event'}>
      <form className="stack" onSubmit={save} noValidate>
        <Segmented kind="radio" label="Is it a trip or an event?" options={[{ value: 'trip', label: 'Trip' }, { value: 'event', label: 'Event' }]} value={form.kind} onChange={(v) => set({ kind: v })} />
        <div className="field">
          <label className="label" htmlFor="grp-name">Name</label>
          <input id="grp-name" className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={form.kind === 'trip' ? 'e.g. Goa Trip' : 'e.g. Diya’s birthday'} autoFocus={!group} />
        </div>
        {form.kind === 'trip' ? (
          <div className="input-row">
            <div className="field grow">
              <label className="label" htmlFor="grp-start">First day</label>
              <input id="grp-start" className="input" type="date" value={form.starts_on} onChange={(e) => set({ starts_on: e.target.value })} />
            </div>
            <div className="field grow" style={{ marginTop: 0 }}>
              <label className="label" htmlFor="grp-end">Last day</label>
              <input id="grp-end" className="input" type="date" value={form.ends_on} min={form.starts_on || undefined} onChange={(e) => set({ ends_on: e.target.value })} />
            </div>
          </div>
        ) : (
          <div className="field">
            <label className="label" htmlFor="grp-date">Date <span className="muted">(optional)</span></label>
            <input id="grp-date" className="input" type="date" value={form.starts_on} onChange={(e) => set({ starts_on: e.target.value })} />
          </div>
        )}
        <div className="field">
          <label className="label" htmlFor="grp-desc">Note <span className="muted">(optional)</span></label>
          <input id="grp-desc" className="input" value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="e.g. Villa in Anjuna" />
        </div>
        {!group && <p className="notice"><Icon name="info" size={16} />Each trip or event keeps its own balance, so costs never get mixed up.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Saving…' : group ? 'Save changes' : `Create ${form.kind}`}</button>
        {group && onDelete && (
          <button type="button" className="btn btn-danger-text btn-block" onClick={onDelete}>
            <Icon name="trash" size={18} /> Delete this {group.kind}
          </button>
        )}
      </form>
    </BottomSheet>
  );
}
