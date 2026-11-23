import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import BottomSheet from '../../components/BottomSheet.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { BeachScene, PartyScene } from '../../components/Illustrations.jsx';
import { EmptyState, LoadError, Loading } from '../../components/Controls.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSpace } from '../../context/SpaceContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useLoad } from '../../hooks/useLoad.js';
import * as api from '../../lib/api.js';
import { formatDay, formatRange, formatShort } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { formatINR } from '../../lib/money.js';
import { PAY_METHODS } from '../../lib/spaceTypes.js';
import { suggestTransfers } from '../../lib/split.js';
import { GroupSheet } from './SplitHome.jsx';
import { CostIcon, METHOD_WORDS, netColor, pickGroup } from './moneyUi.jsx';

export default function GroupDetail() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const { space, spaces, ready, isOwner, members, nameOf, switchTo } = useSpace();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => api.loadSplit(space.id), [space.id]);
  const view = useMemo(() => (data ? pickGroup(data, groupId) : null), [data, groupId]);

  const [openCost, setOpenCost] = useState(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(null); // { kind: 'group' | 'legacy' | 'cost' | 'payment', ... }
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lookup, setLookup] = useState('idle'); // finding a trip that lives in another of my spaces

  useEffect(() => {
    if (!data || view?.group || groupId === 'older' || lookup !== 'idle') return;
    setLookup('pending');
    api.findGroup(groupId)
      .then((g) => {
        const home = g && spaces.find((s) => s.id === g.space_id);
        if (home && home.id !== space.id) {
          switchTo(home.id);
          toast(`Switched to ${home.name}`);
        }
      })
      .catch(() => {})
      .finally(() => setLookup('done'));
  }, [data, view, groupId, lookup, spaces, space.id, switchTo, toast]);

  if ((loading && !data) || lookup === 'pending') return <div className="page"><Loading rows={4} /></div>;
  if (error && !data) return <div className="page"><LoadError error={error} onRetry={reload} /></div>;
  if (!view?.group) {
    if (loading) return <div className="page"><Loading rows={4} /></div>;
    return (
      <div className="page">
        <div className="topbar"><Link className="back-btn" to="/money?tab=split"><Icon name="chevronLeft" size={20} stroke={2.4} /> Money</Link></div>
        <EmptyState mood="thinking" title="Nothing here" action={<Link className="btn btn-secondary" to="/money?tab=split">Back to trips & events</Link>}>
          This trip or event may have been deleted, or it belongs to another space.
        </EmptyState>
      </div>
    );
  }

  const { group, legacy, expenses, settlements, total, balances } = view;
  const me = balances.get(user.id) || { paid: 0, share: 0, net: 0 };
  const transfers = suggestTransfers(balances);
  const person = (id) => nameOf(id);
  const object = (id) => (id === user.id ? 'you' : nameOf(id));
  const canChangeGroup = isOwner || group.created_by === user.id;
  const memberIds = new Set(members.filter((m) => !m.left_at).map((m) => m.user_id));

  const everyone = [...new Set([...memberIds, ...balances.keys()])]
    .map((id) => ({ id, ...(balances.get(id) || { paid: 0, share: 0, net: 0 }) }))
    .filter((p) => memberIds.has(p.id) || p.net !== 0 || p.paid !== 0)
    .sort((a, b) => (a.id === user.id ? -1 : b.id === user.id ? 1 : b.net - a.net));

  const activity = [
    ...expenses.map((e) => ({ kind: 'cost', id: e.id, date: e.spent_on, created: e.created_at, item: e })),
    ...settlements.map((s) => ({ kind: 'payment', id: s.id, date: s.paid_on, created: s.created_at, item: s })),
  ].sort((a, b) => b.date.localeCompare(a.date) || String(b.created).localeCompare(String(a.created)));

  async function run(action, success, after) {
    setBusy(true);
    try {
      const result = await action();
      toast(typeof success === 'function' ? success(result) : success);
      setConfirm(null);
      setOpenCost(null);
      if (after) after(); else reload();
    } catch (err) {
      toast(friendlyError(err), { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  }

  async function askDeleteLegacy() {
    try {
      const counts = await api.legacySummary(space.id);
      setConfirm({ kind: 'legacy', counts });
    } catch (err) {
      toast(friendlyError(err), { tone: 'warn' });
    }
  }

  const art = group.kind === 'event' ? <PartyScene /> : group.kind === 'trip' ? <BeachScene sway={false} /> : null;

  return (
    <div className="page">
      <div className="topbar">
        <Link className="back-btn" to="/money?tab=split"><Icon name="chevronLeft" size={20} stroke={2.4} /> Money</Link>
        <span className="grow" />
        {!legacy && <button type="button" className="icon-btn" aria-label={`Edit ${group.name}`} onClick={() => setEditing(true)}><Icon name="edit" size={20} /></button>}
      </div>

      <section className="postcard" style={{ marginTop: 12 }} aria-labelledby="grp-title">
        {art && (
          <div className="postcard__art">
            {art}
            <span className="postcard__tag badge" style={{ background: '#fff', color: '#14161c' }}>
              {group.kind === 'event' ? 'Event' : 'Trip'}{group.starts_on ? ` · ${formatRange(group.starts_on, group.ends_on)}` : ''}
            </span>
          </div>
        )}
        <div style={{ padding: 16 }}>
          <h1 id="grp-title" className="page-title" style={{ fontSize: 30, lineHeight: '34px' }}>{group.name}</h1>
          <p className="small muted bold" style={{ marginTop: 2 }}>
            {expenses.length ? `${formatINR(total)} spent · ${expenses.length} ${expenses.length === 1 ? 'cost' : 'costs'}` : 'No costs yet'}
            {group.description ? ` · ${group.description}` : ''}
          </p>
          <hr className="sep" />
          <p className="eyebrow">Your balance</p>
          <p className="bold" style={{ marginTop: 4 }}>{me.net > 0 ? 'You get back' : me.net < 0 ? 'You owe' : 'You’re all settled'}</p>
          {me.net !== 0 && <p className="money-big" style={{ color: netColor(me.net) }}>{formatINR(Math.abs(me.net))}</p>}
          <p className="small muted bold">You paid {formatINR(me.paid)} · Your share {formatINR(me.share)}</p>
          <div className="stack-sm" style={{ marginTop: 14 }}>
            {!legacy && <Link className="btn btn-primary btn-block" to={`/money/group/${groupId}/add`}><Icon name="plus" size={18} stroke={2.6} /> Add a cost</Link>}
            <Link className="btn btn-secondary btn-block" to={`/money/group/${groupId}/pay`}><Icon name="swap" size={18} /> Record a payment</Link>
          </div>
        </div>
      </section>

      {legacy && (
        <section className="card stack" style={{ marginTop: 14 }}>
          <p className="notice"><Icon name="info" size={16} /><span>These costs were added before trips & events existed. They still count until they are moved or deleted.</span></p>
          {data.groups.length > 0 && expenses.length > 0 && (
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setMoving(true)}><Icon name="arrowRight" size={18} /> Move costs into a trip or event</button>
          )}
          {isOwner ? (
            <button type="button" className="btn btn-danger-text btn-block" onClick={askDeleteLegacy}><Icon name="trash" size={18} /> Delete all older costs</button>
          ) : (
            <p className="small muted bold center">Only the space owner can delete older costs.</p>
          )}
        </section>
      )}

      <section className="card card--tight" style={{ marginTop: 14 }} aria-labelledby="h-settle">
        <div className="card-head"><h2 id="h-settle" className="section-title" style={{ fontSize: 20 }}>Settle up</h2></div>
        {transfers.length === 0 ? (
          <p className="status-line ok" style={{ padding: '4px 0 12px' }}><Icon name="check" size={18} stroke={2.6} /> Everyone is settled. Nice!</p>
        ) : (
          <ul className="list">
            {transfers.map((t) => {
              const mine = t.from === user.id || t.to === user.id;
              return (
                <li key={`${t.from}-${t.to}`}>
                  <Link className="row row--button" to={`/money/group/${groupId}/pay?from=${t.from}&to=${t.to}&amount=${t.amount}`} aria-label={`Record: ${person(t.from)} paid ${object(t.to)} ${formatINR(t.amount)}`}>
                    <Avatar id={t.from} name={nameOf(t.from, { you: false })} size={36} />
                    <span className="row__main">
                      <span className="row__title" style={{ fontSize: 15 }}>{person(t.from)} {t.from === user.id ? 'pay' : 'pays'} {object(t.to)}</span>
                      <span className="row__meta">{mine ? 'Tap to record it once paid' : 'Suggested payment'}</span>
                    </span>
                    <span className="row__amount">{formatINR(t.amount)}</span>
                    <Icon name="chevronRight" size={16} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <p className="tiny muted bold" style={{ paddingBottom: 12 }}>DayOrbit never moves money. Pay by UPI or cash, then record it here.</p>
      </section>

      <section className="card card--tight" style={{ marginTop: 14 }} aria-labelledby="h-people">
        <div className="card-head"><h2 id="h-people" className="section-title" style={{ fontSize: 20 }}>Everyone</h2></div>
        <ul className="list">
          {everyone.map((p) => (
            <li key={p.id} className="row">
              <Avatar id={p.id} name={nameOf(p.id, { you: false })} size={36} />
              <span className="row__main">
                <span className="row__title" style={{ fontSize: 15 }}>{person(p.id)}</span>
                <span className="row__meta">Paid {formatINR(p.paid)} · Share {formatINR(p.share)}</span>
              </span>
              <span className="row__amount" style={{ color: netColor(p.net) }}>
                {p.net === 0 ? 'Settled' : formatINR(p.net, { sign: true })}
                <span className="tiny" style={{ display: 'block', fontWeight: 700 }}>{p.net > 0 ? 'gets back' : p.net < 0 ? 'owes' : ''}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card card--tight" style={{ marginTop: 14 }} aria-labelledby="h-activity">
        <div className="card-head"><h2 id="h-activity" className="section-title" style={{ fontSize: 20 }}>Activity</h2></div>
        {activity.length === 0 && (
          <EmptyState mood="hello" title="No costs yet" action={!legacy && <Link className="btn btn-primary btn-sm" to={`/money/group/${groupId}/add`}><Icon name="plus" size={16} /> Add the first cost</Link>}>
            Add costs as they happen. Tick only the people who shared each one.
          </EmptyState>
        )}
        <ul className="list">
          {activity.map(({ kind, id, item }) => {
            if (kind === 'cost') {
              const mine = item.allocations.find((a) => a.user_id === user.id)?.share_minor || 0;
              return (
                <li key={id}>
                  <button type="button" className="row row--button" onClick={() => setOpenCost(item)}>
                    <CostIcon title={item.title} category={item.category} />
                    <span className="row__main">
                      <span className="row__title" style={{ fontSize: 15 }}>{item.title}</span>
                      <span className="row__meta">{person(item.paid_by)} paid · {formatShort(item.spent_on)}</span>
                    </span>
                    <span className="row__amount">
                      {formatINR(item.amount_minor)}
                      <span className="tiny muted" style={{ display: 'block', fontWeight: 700 }}>{mine ? `your share ${formatINR(mine)}` : 'not in it'}</span>
                    </span>
                  </button>
                </li>
              );
            }
            const method = PAY_METHODS.find((m) => m.id === item.method)?.label || 'Other';
            const canDelete = isOwner || [item.recorded_by, item.from_user, item.to_user].includes(user.id);
            return (
              <li key={id} className="row">
                <span className="icon-tile bg-mint ink-mint" aria-hidden="true"><Icon name="swap" size={19} /></span>
                <span className="row__main">
                  <span className="row__title" style={{ fontSize: 15 }}>{person(item.from_user)} paid {object(item.to_user)}</span>
                  <span className="row__meta">Payment · {method} · {formatShort(item.paid_on)}{item.note ? ` · ${item.note}` : ''}</span>
                </span>
                <span className="row__amount" style={{ color: 'var(--get)' }}>{formatINR(item.amount_minor)}</span>
                {canDelete && (
                  <button type="button" className="icon-btn icon-btn--ghost icon-btn--sm" aria-label="Delete this payment" onClick={() => setConfirm({ kind: 'payment', item })}>
                    <Icon name="trash" size={18} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <CostSheet
        cost={openCost}
        onClose={() => setOpenCost(null)}
        onEdit={(c) => navigate(`/money/group/${groupId}/expense/${c.id}/edit`)}
        onDelete={(c) => setConfirm({ kind: 'cost', item: c })}
      />

      {!legacy && (
        <GroupSheet
          open={editing}
          group={group}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); reload(); }}
          onDelete={canChangeGroup ? () => { setEditing(false); setConfirm({ kind: 'group' }); } : undefined}
        />
      )}

      {legacy && moving && (
        <MoveSheet
          expenses={expenses}
          groups={data.groups}
          onClose={() => setMoving(false)}
          onMove={(ids, target) => run(() => api.moveToGroup(ids, target.id), (n) => `Moved ${n ?? ids.length} to ${target.name}`, () => { setMoving(false); reload(); })}
          busy={busy}
        />
      )}

      <ConfirmDialog
        open={confirm?.kind === 'group'}
        title={`Delete ${group.name}?`}
        danger
        requireText="DELETE"
        confirmLabel="Delete for everyone"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api.deleteGroup(group.id), (r) => `Deleted ${group.name}${r ? ` (${r.expenses} costs, ${r.settlements} payments)` : ''}`, () => navigate('/money?tab=split', { replace: true }))}
      >
        <p>This removes {expenses.length} {expenses.length === 1 ? 'cost' : 'costs'} and {settlements.length} {settlements.length === 1 ? 'payment' : 'payments'} for everyone in {space.name}. It can’t be undone.</p>
        {transfers.length > 0 && <p className="notice notice--warn"><Icon name="alert" size={16} />Some people still owe money here. Their balances will disappear too.</p>}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm?.kind === 'legacy'}
        title="Delete all older costs?"
        danger
        requireText="DELETE"
        confirmLabel="Delete older costs"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(
          () => api.deleteLegacy(space.id, confirm.counts.expenses, confirm.counts.settlements),
          (r) => `Deleted ${r?.expenses ?? 0} costs and ${r?.settlements ?? 0} payments`,
          () => navigate('/money?tab=split', { replace: true }),
        )}
      >
        {confirm?.kind === 'legacy' && (
          <>
            <p>This deletes <strong>{confirm.counts.expenses} {confirm.counts.expenses === 1 ? 'cost' : 'costs'}</strong> ({formatINR(confirm.counts.total_minor)}) and <strong>{confirm.counts.settlements} {confirm.counts.settlements === 1 ? 'payment' : 'payments'}</strong> for everyone in {space.name}. Trips and events are not touched.</p>
            {transfers.length > 0 && <p className="notice notice--warn"><Icon name="alert" size={16} />People still owe money in these costs. Settle up first if you want to keep a record.</p>}
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm?.kind === 'cost'}
        title="Delete this cost?"
        danger
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api.deleteSplitExpense(confirm.item.id), 'Cost deleted')}
      >
        {confirm?.kind === 'cost' && <p>“{confirm.item.title}” ({formatINR(confirm.item.amount_minor)}) will be removed and everyone’s balance updates.</p>}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm?.kind === 'payment'}
        title="Delete this payment?"
        danger
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api.deleteSettlement(confirm.item.id), 'Payment deleted')}
      >
        {confirm?.kind === 'payment' && <p>The record of {person(confirm.item.from_user)} paying {object(confirm.item.to_user)} {formatINR(confirm.item.amount_minor)} will be removed. Balances go back to how they were.</p>}
      </ConfirmDialog>

      {ready && <span className="sr-only" aria-live="polite">{busy ? 'Working' : ''}</span>}
    </div>
  );
}

function CostSheet({ cost, onClose, onEdit, onDelete }) {
  const { user } = useAuth();
  const { isOwner, members, nameOf } = useSpace();
  if (!cost) return null;
  const canChange = isOwner || cost.created_by === user.id || cost.paid_by === user.id;
  const active = new Set(members.filter((m) => !m.left_at).map((m) => m.user_id));
  const someoneLeft = [cost.paid_by, ...cost.allocations.map((a) => a.user_id)].some((id) => !active.has(id));
  const inputLabel = (a) => {
    if (cost.method === 'percent' && a.input_value != null) return `${Number(a.input_value)}%`;
    if (cost.method === 'shares' && a.input_value != null) return `${Number(a.input_value)} ${Number(a.input_value) === 1 ? 'share' : 'shares'}`;
    return null;
  };

  return (
    <BottomSheet open={!!cost} onClose={onClose} title={cost.title}>
      <div className="stack">
        <div className="row" style={{ minHeight: 0 }}>
          <CostIcon title={cost.title} category={cost.category} />
          <div className="grow">
            <p className="display tabular" style={{ fontSize: 32, fontWeight: 800, lineHeight: '38px' }}>{formatINR(cost.amount_minor)}</p>
            <p className="small muted bold">{nameOf(cost.paid_by)} paid · {formatDay(cost.spent_on)}</p>
          </div>
        </div>
        <div>
          <p className="eyebrow">{METHOD_WORDS[cost.method]} · {cost.allocations.length} {cost.allocations.length === 1 ? 'person' : 'people'}</p>
          <ul className="list" style={{ marginTop: 4 }}>
            {cost.allocations.map((a) => (
              <li key={a.user_id} className="row" style={{ minHeight: 52 }}>
                <Avatar id={a.user_id} name={nameOf(a.user_id, { you: false })} size={32} />
                <span className="row__main">
                  <span className="row__title" style={{ fontSize: 15 }}>{nameOf(a.user_id)}</span>
                  {inputLabel(a) && <span className="row__meta">{inputLabel(a)}</span>}
                </span>
                <span className="row__amount">{formatINR(a.share_minor)}</span>
              </li>
            ))}
          </ul>
        </div>
        {cost.notes && <p className="notice"><Icon name="info" size={16} />{cost.notes}</p>}
        {someoneLeft && <p className="notice notice--warn"><Icon name="alert" size={16} />Someone in this cost has left the space, so it can’t be edited. It can still be deleted.</p>}
        {canChange ? (
          <div className="btn-row">
            <button type="button" className="btn btn-secondary" disabled={someoneLeft} onClick={() => onEdit(cost)}><Icon name="edit" size={18} /> Edit</button>
            <button type="button" className="btn btn-secondary" style={{ color: 'var(--danger)' }} onClick={() => onDelete(cost)}><Icon name="trash" size={18} /> Delete</button>
          </div>
        ) : (
          <p className="small muted bold center">Only the person who added it, the person who paid, or the owner can change this.</p>
        )}
        {cost.legacy && <p className="tiny muted center">Added before trips & events.</p>}
      </div>
    </BottomSheet>
  );
}

function MoveSheet({ expenses, groups, onClose, onMove, busy }) {
  const [picked, setPicked] = useState(() => new Set(expenses.map((e) => e.id)));
  const [target, setTarget] = useState(groups[0]?.id || '');
  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const group = groups.find((g) => g.id === target);

  return (
    <BottomSheet open onClose={onClose} title="Move into a trip or event">
      <div className="stack">
        <div className="field">
          <label className="label" htmlFor="move-target">Move to</label>
          <select id="move-target" className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <ul className="list">
          {expenses.map((e) => (
            <li key={e.id} className="row" style={{ minHeight: 52 }}>
              <button type="button" role="checkbox" aria-checked={picked.has(e.id)} className="person-toggle" onClick={() => toggle(e.id)}>
                <span className={`check__box check__box--square ${picked.has(e.id) ? 'check__box--on' : ''}`} aria-hidden="true">
                  {picked.has(e.id) && <Icon name="check" size={16} stroke={3.2} />}
                </span>
                <span className="grow">
                  <span className="row__title" style={{ fontSize: 15 }}>{e.title}</span>
                  <span className="row__meta">{formatShort(e.spent_on)}</span>
                </span>
                <span className="row__amount">{formatINR(e.amount_minor)}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="notice"><Icon name="info" size={16} />Payments stay in Older costs. Balances move with the costs.</p>
        <button type="button" className="btn btn-primary btn-lg btn-block" disabled={busy || !picked.size || !group} onClick={() => onMove([...picked], group)}>
          {busy ? 'Moving…' : `Move ${picked.size} ${picked.size === 1 ? 'cost' : 'costs'}`}
        </button>
      </div>
    </BottomSheet>
  );
}
