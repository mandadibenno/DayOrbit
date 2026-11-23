import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { PAY_METHODS } from '../../lib/spaceTypes.js';
import { suggestTransfers } from '../../lib/split.js';
import { pickGroup } from './moneyUi.jsx';

function afterWords(name, net, you) {
  if (net > 0) return `${name} ${you ? 'get' : 'gets'} back ${formatINR(net)}`;
  if (net < 0) return `${name} ${you ? 'owe' : 'owes'} ${formatINR(-net)}`;
  return `${name} ${you ? 'are' : 'is'} all settled`;
}

export default function RecordPayment() {
  const { groupId } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { space, ready, members, nameOf } = useSpace();
  const navigate = useNavigate();
  const toast = useToast();
  const requestId = useRef(newRequestId());
  const back = `/money/group/${groupId}`;
  const { data, error, loading, reload } = useLoad(() => api.loadSplit(space.id), [space.id]);
  const view = useMemo(() => (data ? pickGroup(data, groupId) : null), [data, groupId]);

  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  // Everyone who can be part of a payment: current members, plus former members who still have a balance here.
  const people = useMemo(() => {
    if (!view) return [];
    return members
      .filter((m) => !m.left_at || (view.balances.get(m.user_id)?.net || 0) !== 0)
      .map((m) => ({ id: m.user_id, name: m.display_name, left: !!m.left_at }))
      .sort((a, b) => (a.id === user.id ? -1 : b.id === user.id ? 1 : 0));
  }, [members, view, user.id]);

  useEffect(() => {
    if (!view?.group || !ready || form) return;
    const transfers = suggestTransfers(view.balances);
    const fromQuery = params.get('from');
    const toQuery = params.get('to');
    const amountQuery = Number(params.get('amount'));
    let pick = null;
    if (fromQuery && toQuery) pick = { from: fromQuery, to: toQuery, amount: Number.isInteger(amountQuery) && amountQuery > 0 ? amountQuery : 0 };
    else pick = transfers.find((t) => t.from === user.id) || transfers.find((t) => t.to === user.id) || null;
    const other = people.find((p) => p.id !== user.id)?.id || '';
    setForm({
      from: pick?.from || user.id,
      to: pick?.to || other,
      amount: pick?.amount ? toRupeeInput(pick.amount) : '',
      method: 'upi',
      paidOn: todayISO(),
      note: '',
    });
  }, [view, ready, form, params, people, user.id]);

  if (loading && !data) return <div className="page"><Loading rows={4} /></div>;
  if (error && !data) return <div className="page"><LoadError error={error} onRetry={reload} /></div>;
  if (!view?.group) {
    return (
      <div className="page">
        <div className="topbar"><Link className="back-btn" to="/money?tab=split"><Icon name="chevronLeft" size={20} stroke={2.4} /> Money</Link></div>
        <EmptyState mood="thinking" title="Nothing here" action={<Link className="btn btn-secondary" to="/money?tab=split">Back to trips & events</Link>}>
          This trip or event may have been deleted.
        </EmptyState>
      </div>
    );
  }
  if (!form) return <div className="page"><Loading rows={4} /></div>;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const amount = parseRupees(form.amount);
  const amountOk = Number.isInteger(amount) && amount > 0;
  const fromNet = view.balances.get(form.from)?.net || 0;
  const toNet = view.balances.get(form.to)?.net || 0;
  const label = (id) => (id === user.id ? 'You' : nameOf(id, { you: false }));
  const overpays = amountOk && fromNet + amount > 0 && fromNet <= 0;

  function swap() {
    setForm((f) => ({ ...f, from: f.to, to: f.from }));
  }

  async function save(e) {
    e.preventDefault();
    setFormError('');
    if (!form.from || !form.to) { setFormError('Pick who paid and who got the money.'); return; }
    if (form.from === form.to) { setFormError('Pick two different people.'); return; }
    if (!amountOk) { setFormError('Type an amount above ₹0, like 500 or 500.50.'); return; }
    setBusy(true);
    try {
      await api.recordSettlement({
        spaceId: space.id,
        groupId: view.legacy ? null : groupId,
        from: form.from,
        to: form.to,
        amount,
        paidOn: form.paidOn || todayISO(),
        method: form.method,
        note: form.note.trim() || null,
        requestId: requestId.current,
        recordedBy: user.id,
      });
      toast(`Payment of ${formatINR(amount)} recorded`);
      navigate(back, { replace: true });
    } catch (err) {
      setFormError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const personSelect = (id, key, text) => (
    <div className="field grow" style={{ marginTop: 0 }}>
      <label className="label" htmlFor={`rp-${key}`}>{text}</label>
      <select id={`rp-${key}`} className="select" value={form[key]} onChange={(e) => set({ [key]: e.target.value })}>
        {people.map((p) => <option key={p.id} value={p.id}>{p.id === user.id ? 'You' : p.name}{p.left ? ' (left)' : ''}</option>)}
      </select>
    </div>
  );

  return (
    <form className="page" onSubmit={save} noValidate>
      <div className="topbar">
        <Link className="back-btn" to={back}><Icon name="chevronLeft" size={20} stroke={2.4} /> {view.group.name}</Link>
      </div>
      <h1 className="page-title" style={{ marginTop: 12 }}>Record a payment</h1>
      <p className="page-sub">For money paid back outside DayOrbit — UPI, cash or bank.</p>

      <section className="card stack" style={{ marginTop: 16 }}>
        <div className="row" style={{ justifyContent: 'center', gap: 14, minHeight: 0, paddingTop: 4 }} aria-hidden="true">
          <span className="center"><Avatar id={form.from} name={label(form.from)} size={56} /><span className="small bold" style={{ display: 'block', marginTop: 4 }}>{label(form.from)}</span></span>
          <Icon name="arrowRight" size={26} stroke={2.6} />
          <span className="center"><Avatar id={form.to} name={label(form.to)} size={56} /><span className="small bold" style={{ display: 'block', marginTop: 4 }}>{label(form.to)}</span></span>
        </div>
        <div className="input-row" style={{ alignItems: 'flex-end' }}>
          {personSelect(form.from, 'from', 'Who paid?')}
          <button type="button" className="icon-btn" aria-label="Swap who paid and who got the money" onClick={swap} style={{ marginBottom: 2 }}>
            <Icon name="swap" size={20} />
          </button>
          {personSelect(form.to, 'to', 'Who got the money?')}
        </div>
        <div className="field">
          <label className="label" htmlFor="rp-amount">Amount</label>
          <div className="amount-input">
            <span aria-hidden="true">₹</span>
            <input id="rp-amount" inputMode="decimal" autoComplete="off" placeholder="0" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
          </div>
          {fromNet < 0 && (
            <button type="button" className="link-btn" style={{ marginTop: 4 }} onClick={() => set({ amount: toRupeeInput(Math.min(-fromNet, toNet > 0 ? toNet : -fromNet)) })}>
              {label(form.from)} {form.from === user.id ? 'owe' : 'owes'} {formatINR(-fromNet)} here — use {formatINR(Math.min(-fromNet, toNet > 0 ? toNet : -fromNet))}
            </button>
          )}
        </div>
        <div className="field">
          <p className="label">How was it paid?</p>
          <div className="chips" role="radiogroup" aria-label="Payment method">
            {PAY_METHODS.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={form.method === m.id} className="chip chip--dark" onClick={() => set({ method: m.id })}>{m.label}</button>
            ))}
          </div>
        </div>
        <div className="input-row">
          <div className="field" style={{ width: 168, flex: 'none' }}>
            <label className="label" htmlFor="rp-date">Date</label>
            <input id="rp-date" className="input" type="date" value={form.paidOn} max={todayISO()} onChange={(e) => set({ paidOn: e.target.value })} />
          </div>
          <div className="field grow" style={{ marginTop: 0 }}>
            <label className="label" htmlFor="rp-note">Note <span className="muted">(optional)</span></label>
            <input id="rp-note" className="input" maxLength={300} value={form.note} onChange={(e) => set({ note: e.target.value })} placeholder="e.g. GPay" />
          </div>
        </div>
      </section>

      {amountOk && form.from !== form.to && (
        <section className="means" style={{ marginTop: 14 }} aria-live="polite">
          <h2>What this means</h2>
          <ul>
            <li><Icon name="check" size={18} stroke={2.6} />{afterWords(label(form.from), fromNet + amount, form.from === user.id)}</li>
            <li><Icon name="check" size={18} stroke={2.6} />{afterWords(label(form.to), toNet - amount, form.to === user.id)}</li>
          </ul>
        </section>
      )}
      {overpays && (
        <p className="notice notice--warn" style={{ marginTop: 12 }}>
          <Icon name="alert" size={16} />That’s more than {label(form.from)} {form.from === user.id ? 'owe' : 'owes'} here. Fine if that’s what happened — the balance will flip.
        </p>
      )}
      <p className="notice" style={{ marginTop: 12 }}><Icon name="shield" size={16} />DayOrbit never moves money. This only keeps a record so balances stay right.</p>

      {formError && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{formError}</p>}
      <div className="sticky-footer">
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? 'Saving…' : amountOk ? `Record ${formatINR(amount)}` : 'Record payment'}
        </button>
      </div>
    </form>
  );
}
