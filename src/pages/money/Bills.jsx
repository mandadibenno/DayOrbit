import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import BottomSheet from '../../components/BottomSheet.jsx';
import { EmptyState, LoadError, Loading } from '../../components/Controls.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSpace } from '../../context/SpaceContext.jsx';
import { useShell } from '../../context/ShellContext.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useLoad } from '../../hooks/useLoad.js';
import * as api from '../../lib/api.js';
import { dueLabel, endOfMonth, formatShort, monthShort, parseISO, startOfMonth, toISO, todayISO } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { formatINR } from '../../lib/money.js';

const REPEATS = { none: 'One-time', weekly: 'Every week', monthly: 'Every month', quarterly: 'Every 3 months', yearly: 'Every year' };

function DateTile({ iso, late }) {
  return (
    <span aria-hidden="true" style={{ width: 46, flex: 'none', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line)', overflow: 'hidden', textAlign: 'center' }}>
      <span style={{ display: 'block', height: 10, background: late ? 'var(--owe)' : '#FF7A59' }} />
      <span className="display" style={{ display: 'block', fontSize: 19, fontWeight: 800, lineHeight: '22px' }}>{parseISO(iso).getDate()}</span>
      <span style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--ink-2)', paddingBottom: 3 }}>{monthShort(iso)}</span>
    </span>
  );
}

export default function Bills() {
  const { user } = useAuth();
  const { space, isPersonal, nameOf } = useSpace();
  const { dataVersion, openQuickAdd } = useShell();
  const toast = useToast();
  const [showPaid, setShowPaid] = useState(false);
  const [open, setOpen] = useState(null);
  const { data: bills, error, loading, reload, setData } = useLoad(() => api.listBills(space.id), [space.id, dataVersion]);

  if (loading && !bills) return <Loading rows={3} />;

  const today = todayISO();
  const unpaid = (bills || []).filter((b) => !b.paid_at).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const paid = (bills || []).filter((b) => b.paid_at).sort((a, b) => b.paid_at.localeCompare(a.paid_at));
  const lateCount = unpaid.filter((b) => b.due_date < today).length;
  const dueThisMonth = unpaid.filter((b) => b.due_date <= endOfMonth(today)).reduce((s, b) => s + Number(b.amount_minor), 0);
  const paidThisMonth = paid.filter((b) => toISO(new Date(b.paid_at)) >= startOfMonth(today)).reduce((s, b) => s + Number(b.amount_minor), 0);

  async function markPaid(bill) {
    setData((list) => list.map((b) => (b.id === bill.id ? { ...b, paid_at: new Date().toISOString(), paid_by: user.id } : b)));
    try {
      const next = await api.markBillPaid(bill, user.id);
      reload();
      toast(next ? `Paid! The next one is due ${formatShort(next.due_date)}` : `${bill.title} marked paid`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.unmarkBillPaid(bill.id);
              if (next?.id) await api.deleteBill(next.id);
            } catch (err) { toast(friendlyError(err), { tone: 'warn' }); }
            reload();
          },
        },
      });
    } catch (err) {
      toast(friendlyError(err), { tone: 'warn' });
      reload();
    }
  }

  async function unmark(bill) {
    try { await api.unmarkBillPaid(bill.id); reload(); toast(`${bill.title} is unpaid again`); } catch (err) { toast(friendlyError(err), { tone: 'warn' }); }
  }

  async function remove(bill) {
    setData((list) => list.filter((b) => b.id !== bill.id));
    try {
      await api.deleteBill(bill.id);
      toast('Bill deleted', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.addBill(space.id, { title: bill.title, amount_minor: bill.amount_minor, due_date: bill.due_date, recurrence: bill.recurrence, paid_at: bill.paid_at, paid_by: bill.paid_by });
            } catch (err) { toast(friendlyError(err), { tone: 'warn' }); }
            reload();
          },
        },
      });
    } catch (err) {
      toast(friendlyError(err), { tone: 'warn' });
      reload();
    }
  }

  return (
    <div className="stack">
      <LoadError error={error} onRetry={reload} />

      <div className="tile-grid">
        <div className="tile bg-peach">
          <p className="tile__label ink-peach">Still to pay this month</p>
          <p className="tile__value">{formatINR(dueThisMonth)}</p>
          <p className="tiny bold ink-peach">{lateCount ? `${lateCount} overdue` : unpaid.length ? `${unpaid.length} coming up` : 'Nothing due'}</p>
        </div>
        <div className="tile bg-mint">
          <p className="tile__label ink-mint">Paid this month</p>
          <p className="tile__value">{formatINR(paidThisMonth)}</p>
          <p className="tiny bold ink-mint">Repeating bills add the next one for you</p>
        </div>
      </div>

      <section className="card card--tight" aria-labelledby="h-bills">
        <div className="card-head">
          <h2 id="h-bills" className="section-title" style={{ fontSize: 20 }}>Coming up</h2>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => openQuickAdd('bill')}><Icon name="plus" size={16} stroke={2.6} /> Add bill</button>
        </div>
        {unpaid.length === 0 && (
          <EmptyState mood="hooray" title="No bills waiting">
            Add rent, electricity or a phone bill and we’ll remind you before it’s due.
          </EmptyState>
        )}
        <ul className="list">
          {unpaid.map((b) => {
            const due = dueLabel(b.due_date);
            return (
              <li key={b.id} className="row" style={{ minHeight: 68 }}>
                <button type="button" className="row--button" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }} onClick={() => setOpen(b)} aria-label={`${b.title}, ${formatINR(b.amount_minor)}, ${due.text}. More options`}>
                  <DateTile iso={b.due_date} late={due.late} />
                  <span className="row__main">
                    <span className="row__title" style={{ fontSize: 15 }}>{b.title}</span>
                    <span className={`row__meta ${due.late ? 'late' : ''}`}>
                      {due.late && <Icon name="clock" size={14} stroke={2.4} />}
                      {due.text} · {REPEATS[b.recurrence] || 'One-time'}
                    </span>
                  </span>
                  <span className="row__amount">{formatINR(b.amount_minor)}</span>
                </button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => markPaid(b)} aria-label={`Mark ${b.title} paid`}>
                  <Icon name="check" size={16} stroke={2.6} /> Paid
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {paid.length > 0 && (
        <section className="card card--tight">
          <button type="button" className="row row--button" aria-expanded={showPaid} onClick={() => setShowPaid((s) => !s)}>
            <span className="icon-tile bg-mint ink-mint"><Icon name="receipt" size={18} /></span>
            <span className="row__main"><span className="row__title" style={{ fontSize: 15 }}>Paid bills <span className="muted">· {paid.length}</span></span></span>
            <span className="small bold muted">{showPaid ? 'Hide' : 'Show'}</span>
          </button>
          {showPaid && (
            <ul className="list">
              {paid.slice(0, 30).map((b) => (
                <li key={b.id} className="row">
                  <span className="row__main">
                    <span className="row__title done-text" style={{ fontSize: 15 }}>{b.title}</span>
                    <span className="row__meta">
                      Paid {formatShort(toISO(new Date(b.paid_at)))}{!isPersonal && b.paid_by ? ` by ${nameOf(b.paid_by)}` : ''}
                    </span>
                  </span>
                  <span className="row__amount">{formatINR(b.amount_minor)}</span>
                  <button type="button" className="btn btn-sm btn-quiet" onClick={() => unmark(b)}>Not paid</button>
                  <button type="button" className="icon-btn icon-btn--ghost icon-btn--sm" aria-label={`Delete ${b.title}`} onClick={() => remove(b)}>
                    <Icon name="trash" size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <BottomSheet open={!!open} onClose={() => setOpen(null)} title={open?.title || 'Bill'}>
        {open && (
          <div className="stack">
            <div className="row" style={{ minHeight: 0 }}>
              <DateTile iso={open.due_date} late={dueLabel(open.due_date).late} />
              <div className="grow">
                <p className="display tabular" style={{ fontSize: 30, fontWeight: 800, lineHeight: '36px' }}>{formatINR(open.amount_minor)}</p>
                <p className="small muted bold">{dueLabel(open.due_date).text} · {REPEATS[open.recurrence] || 'One-time'}</p>
              </div>
            </div>
            {open.recurrence !== 'none' && <p className="notice"><Icon name="refresh" size={16} />When you mark it paid, the next one is added automatically.</p>}
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => { const b = open; setOpen(null); markPaid(b); }}>
              <Icon name="check" size={18} stroke={2.6} /> Mark as paid
            </button>
            <button type="button" className="btn btn-danger-text btn-block" onClick={() => { const b = open; setOpen(null); remove(b); }}>
              <Icon name="trash" size={18} /> Delete this bill
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
