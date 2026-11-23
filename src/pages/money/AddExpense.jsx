import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { EmptyState, LoadError, Loading } from '../../components/Controls.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSpace } from '../../context/SpaceContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useLoad } from '../../hooks/useLoad.js';
import * as api from '../../lib/api.js';
import { todayISO } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { newRequestId } from '../../lib/ids.js';
import { formatINR, parseRupees, toRupeeInput } from '../../lib/money.js';
import { SPLIT_METHODS, computeSplit, largestRemainder, splitStatusText } from '../../lib/split.js';
import { CostIcon, SPLIT_CATEGORIES } from './moneyUi.jsx';

const defaultDate = (group) => {
  const today = todayISO();
  return group?.ends_on && today > group.ends_on ? group.ends_on : today;
};
// 100% shared out in 0.01% steps; earlier people take any extra 0.01%.
const equalPercents = (n) => (n ? largestRemainder(10000, Array(n).fill(1)).map((bp) => String(bp / 100)) : []);
const equalRupees = (totalMinor, n) => (n && totalMinor > 0 ? largestRemainder(totalMinor, Array(n).fill(1)).map(toRupeeInput) : Array(n).fill(''));

function inputFromAllocation(method, a) {
  if (method === 'exact') return toRupeeInput(Number(a.input_value ?? a.share_minor));
  if (method === 'percent') return String(Number(a.input_value));
  if (method === 'shares') return Number(a.input_value) || 1;
  return '';
}

export default function AddExpense() {
  const { groupId, expenseId } = useParams();
  const editing = Boolean(expenseId);
  const { user } = useAuth();
  const { space, ready, activeMembers, nameOf } = useSpace();
  const navigate = useNavigate();
  const toast = useToast();
  const requestId = useRef(newRequestId());
  const back = `/money/group/${groupId}`;

  const { data, error, loading, reload } = useLoad(async () => {
    const split = await api.loadSplit(space.id);
    const group = groupId === 'older' ? { id: 'older', name: 'Older costs' } : split.groups.find((g) => g.id === groupId) || null;
    const expense = editing ? split.expenses.find((e) => e.id === expenseId) || null : null;
    return { group, expense };
  }, [space.id, groupId, expenseId]);

  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [showMore, setShowMore] = useState(false);

  // People who can share: me first, then everyone else in the space.
  const people = [...activeMembers]
    .sort((a, b) => (a.user_id === user.id ? -1 : b.user_id === user.id ? 1 : 0))
    .map((m) => ({ id: m.user_id, name: m.display_name }));
  const order = people.map((p) => p.id);

  useEffect(() => {
    if (!data || !ready || form) return;
    const e = data.expense;
    if (e) {
      const inputs = {};
      for (const a of e.allocations) inputs[a.user_id] = inputFromAllocation(e.method, a);
      setForm({
        title: e.title, amount: toRupeeInput(Number(e.amount_minor)), paidBy: e.paid_by, spentOn: e.spent_on, method: e.method,
        included: e.allocations.map((a) => a.user_id), inputs, category: e.category || null, notes: e.notes || '',
      });
      if (e.category || e.notes) setShowMore(true);
    } else {
      setForm({
        title: '', amount: '', paidBy: user.id, spentOn: defaultDate(data.group), method: 'equal',
        included: activeMembers.map((m) => m.user_id), inputs: {}, category: null, notes: '',
      });
    }
  }, [data, ready, form, activeMembers, user.id]);

  if (loading && !data) return <div className="page"><Loading rows={5} /></div>;
  if (error && !data) return <div className="page"><LoadError error={error} onRetry={reload} /></div>;
  if (data && (!data.group || (editing && !data.expense) || (groupId === 'older' && !editing))) {
    return (
      <div className="page">
        <div className="topbar"><Link className="back-btn" to="/money?tab=split"><Icon name="chevronLeft" size={20} stroke={2.4} /> Money</Link></div>
        <EmptyState mood="thinking" title={groupId === 'older' && !editing ? 'Add new costs to a trip or event' : 'This cost isn’t here any more'} action={<Link className="btn btn-secondary" to="/money?tab=split">Back to trips & events</Link>}>
          {groupId === 'older' && !editing ? 'Older costs are kept for history. New costs go into a trip or event so balances never mix.' : 'It may have been deleted by someone else.'}
        </EmptyState>
      </div>
    );
  }
  if (!form) return <div className="page"><Loading rows={5} /></div>;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const totalMinor = parseRupees(form.amount);
  const amountOk = Number.isInteger(totalMinor) && totalMinor > 0;
  const participants = order.filter((id) => form.included.includes(id));
  const raw = participants.map((id) => (form.method === 'shares' ? form.inputs[id] ?? 1 : form.inputs[id] ?? ''));
  const result = computeSplit(amountOk ? totalMinor : 0, form.method, raw);
  const shareOf = new Map(participants.map((id, i) => [id, result.shares?.[i] ?? 0]));
  const statusText = !amountOk ? 'Type the total amount first.' : splitStatusText(result, totalMinor);
  const ok = amountOk && result.ok;
  const activeIds = new Set(activeMembers.map((m) => m.user_id));
  const someoneLeft = editing && [form.paidBy, ...form.included].some((id) => !activeIds.has(id));
  const allOn = participants.length === order.length;

  function setMethod(method) {
    setForm((f) => {
      const ids = order.filter((id) => f.included.includes(id));
      const inputs = { ...f.inputs };
      if (method === 'shares') ids.forEach((id) => { inputs[id] = 1; });
      if (method === 'percent') equalPercents(ids.length).forEach((v, i) => { inputs[ids[i]] = v; });
      if (method === 'exact') equalRupees(parseRupees(f.amount), ids.length).forEach((v, i) => { inputs[ids[i]] = v; });
      return { ...f, method, inputs };
    });
  }

  function togglePerson(id) {
    setForm((f) => {
      const on = f.included.includes(id);
      const included = on ? f.included.filter((x) => x !== id) : [...f.included, id];
      let inputs = f.inputs;
      if (f.method === 'percent') {
        const ids = order.filter((x) => included.includes(x));
        inputs = { ...inputs };
        equalPercents(ids.length).forEach((v, i) => { inputs[ids[i]] = v; });
      }
      if (f.method === 'shares' && !on) inputs = { ...inputs, [id]: inputs[id] ?? 1 };
      return { ...f, included, inputs };
    });
  }

  const toggleAll = () => set({ included: allOn ? [] : [...order] });
  const setInput = (id, value) => setForm((f) => ({ ...f, inputs: { ...f.inputs, [id]: value } }));

  async function save(e) {
    e.preventDefault();
    setFormError('');
    if (!amountOk) { setFormError('Type the total amount, like 1500 or 1500.50.'); return; }
    if (!form.title.trim()) { setFormError('Add what it was for, like “Dinner”.'); return; }
    if (!result.ok) { setFormError(statusText); return; }
    setBusy(true);
    try {
      const common = {
        title: form.title.trim(), amount: totalMinor, paidBy: form.paidBy, spentOn: form.spentOn || todayISO(), method: form.method,
        participants, inputs: result.inputs, category: form.category, notes: form.notes.trim() || null,
      };
      if (editing) await api.updateSplitExpense({ expenseId, ...common });
      else await api.createSplitExpense({ spaceId: space.id, groupId, requestId: requestId.current, ...common });
      toast(editing ? 'Cost updated' : `Added ${formatINR(totalMinor)} to ${data.group.name}`);
      navigate(back, { replace: true });
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const methodHelp = SPLIT_METHODS.find((m) => m.id === form.method)?.help;

  return (
    <form className="page" onSubmit={save} noValidate>
      <div className="topbar">
        <Link className="back-btn" to={back}><Icon name="chevronLeft" size={20} stroke={2.4} /> {data.group.name}</Link>
      </div>
      <h1 className="page-title" style={{ marginTop: 12 }}>{editing ? 'Edit cost' : 'Add a cost'}</h1>
      <p className="page-sub">{editing ? 'Changes update everyone’s balance.' : `In ${data.group.name}. Only the people you tick share it.`}</p>

      {someoneLeft && <p className="notice notice--warn" style={{ marginTop: 12 }}><Icon name="alert" size={16} />Someone in this cost has left the space, so it can’t be changed. You can still delete it.</p>}

      <section className="card stack" style={{ marginTop: 16 }}>
        <div className="field">
          <label className="label" htmlFor="ae-amount">Total amount</label>
          <div className="amount-input">
            <span aria-hidden="true">₹</span>
            <input id="ae-amount" inputMode="decimal" autoComplete="off" placeholder="0" value={form.amount} autoFocus={!editing}
              onChange={(e) => {
                const amount = e.target.value;
                setForm((f) => {
                  if (f.method !== 'exact') return { ...f, amount };
                  // Keep exact amounts in step while they still match an equal split of the old total.
                  const ids = order.filter((id) => f.included.includes(id));
                  const before = equalRupees(parseRupees(f.amount), ids.length);
                  const untouched = ids.every((id, i) => (f.inputs[id] ?? '') === before[i]);
                  if (!untouched) return { ...f, amount };
                  const inputs = { ...f.inputs };
                  equalRupees(parseRupees(amount), ids.length).forEach((v, i) => { inputs[ids[i]] = v; });
                  return { ...f, amount, inputs };
                });
              }} />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="ae-title">What was it for?</label>
          <div className="input-row" style={{ alignItems: 'center' }}>
            <CostIcon title={form.title} category={form.category} />
            <input id="ae-title" className="input" value={form.title} placeholder="e.g. Dinner at the shack" onChange={(e) => set({ title: e.target.value })} />
          </div>
        </div>
        <div className="input-row">
          <div className="field grow">
            <label className="label" htmlFor="ae-payer">Paid by</label>
            <select id="ae-payer" className="select" value={form.paidBy} onChange={(e) => set({ paidBy: e.target.value })}>
              {!activeIds.has(form.paidBy) && <option value={form.paidBy}>{nameOf(form.paidBy)}</option>}
              {people.map((p) => <option key={p.id} value={p.id}>{p.id === user.id ? 'You' : p.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ width: 168, flex: 'none', marginTop: 0 }}>
            <label className="label" htmlFor="ae-date">Date</label>
            <input id="ae-date" className="input" type="date" value={form.spentOn} onChange={(e) => set({ spentOn: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }} aria-labelledby="ae-who">
        <div className="row-between">
          <h2 id="ae-who" className="section-title" style={{ fontSize: 20 }}>Who shared it?</h2>
          <button type="button" className="link-btn" onClick={toggleAll}>{allOn ? 'Untick all' : 'Tick everyone'}</button>
        </div>
        <div className="chips" role="radiogroup" aria-label="How to split" style={{ marginTop: 8 }}>
          {SPLIT_METHODS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={form.method === m.id} className="chip chip--dark chip--sm" onClick={() => setMethod(m.id)}>{m.label}</button>
          ))}
        </div>
        <p className="help" style={{ marginTop: 6 }}>{methodHelp}</p>

        <div style={{ marginTop: 4 }}>
          {people.map((p) => {
            const on = form.included.includes(p.id);
            const label = p.id === user.id ? 'You' : p.name;
            const shares = Number(form.inputs[p.id] ?? 1);
            return (
              <div key={p.id} className="person-row">
                <button type="button" role="checkbox" aria-checked={on} className="person-toggle" onClick={() => togglePerson(p.id)}>
                  <span className={`check__box check__box--square ${on ? 'check__box--on' : ''}`} aria-hidden="true">
                    {on && <Icon name="check" size={16} stroke={3.2} />}
                  </span>
                  <Avatar id={p.id} name={p.name} size={36} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="row__title" style={{ fontSize: 15 }}>
                      {label}{p.id === form.paidBy && <span className="badge badge--neutral" style={{ marginLeft: 6 }}>paid</span>}
                    </span>
                    <span className="row__meta tabular">{on ? (amountOk ? formatINR(shareOf.get(p.id) || 0) : 'Sharing') : 'Not sharing'}</span>
                  </span>
                </button>
                {on && form.method === 'exact' && (
                  <label className="mini-input" style={{ width: 118, flex: 'none' }}>
                    <span aria-hidden="true">₹</span>
                    <input inputMode="decimal" aria-label={`Amount for ${label}`} value={form.inputs[p.id] ?? ''} onChange={(e) => setInput(p.id, e.target.value)} placeholder="0" />
                  </label>
                )}
                {on && form.method === 'percent' && (
                  <label className="mini-input" style={{ width: 98, flex: 'none' }}>
                    <input inputMode="decimal" aria-label={`Percentage for ${label}`} value={form.inputs[p.id] ?? ''} onChange={(e) => setInput(p.id, e.target.value)} placeholder="0" />
                    <span aria-hidden="true">%</span>
                  </label>
                )}
                {on && form.method === 'shares' && (
                  <div className="stepper" role="group" aria-label={`Shares for ${label}`}>
                    <button type="button" aria-label={`Fewer shares for ${label}`} disabled={shares <= 1} onClick={() => setInput(p.id, Math.max(1, shares - 1))}>
                      <span><Icon name="minus" size={16} stroke={2.6} /></span>
                    </button>
                    <output aria-live="polite">{shares}</output>
                    <button type="button" aria-label={`More shares for ${label}`} disabled={shares >= 99} onClick={() => setInput(p.id, Math.min(99, shares + 1))}>
                      <span><Icon name="plus" size={16} stroke={2.6} /></span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className={`status-line ${ok ? 'ok' : form.amount.trim() ? 'bad' : ''}`} role="status" style={{ marginTop: 10, color: !ok && !form.amount.trim() ? 'var(--ink-2)' : undefined }}>
          <Icon name={ok ? 'check' : form.amount.trim() ? 'alert' : 'info'} size={18} stroke={2.4} /> <span>{statusText}</span>
        </p>
      </section>

      <section className="card" style={{ marginTop: 14, paddingTop: 6, paddingBottom: 6 }}>
        <button type="button" className="row row--button" aria-expanded={showMore} onClick={() => setShowMore((s) => !s)}>
          <span className="row__main">
            <span className="row__title" style={{ fontSize: 15 }}>Category & note</span>
            <span className="row__meta">{form.category || 'Optional'}</span>
          </span>
          <Icon name={showMore ? 'chevronUp' : 'chevronDown'} size={18} stroke={2.4} />
        </button>
        {showMore && (
          <div className="stack" style={{ paddingBottom: 12 }}>
            <div className="chips">
              {SPLIT_CATEGORIES.map((c) => (
                <button key={c} type="button" className="chip chip--sm" aria-pressed={form.category === c} onClick={() => set({ category: form.category === c ? null : c })}>{c}</button>
              ))}
            </div>
            <div className="field">
              <label className="label" htmlFor="ae-notes">Note</label>
              <textarea id="ae-notes" className="textarea" rows={2} maxLength={500} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. Includes tip" />
            </div>
          </div>
        )}
      </section>

      {formError && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{formError}</p>}
      <div className="sticky-footer">
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || someoneLeft}>
          {busy ? 'Saving…' : editing ? 'Save changes' : amountOk ? `Add ${formatINR(totalMinor)}` : 'Add cost'}
        </button>
      </div>
    </form>
  );
}
