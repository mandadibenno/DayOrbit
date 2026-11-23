import { useMemo, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { EmptyState, LoadError, Loading } from '../../components/Controls.jsx';
import { useSpace } from '../../context/SpaceContext.jsx';
import { useShell } from '../../context/ShellContext.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useLoad } from '../../hooks/useLoad.js';
import * as api from '../../lib/api.js';
import { addMonths, endOfMonth, monthLabel, relativeDay, startOfMonth, todayISO } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { formatINR } from '../../lib/money.js';
import { CostIcon } from './moneyUi.jsx';

const sum = (rows) => rows.reduce((s, e) => s + Number(e.amount_minor), 0);
const monthName = (iso) => monthLabel(iso).split(' ')[0];

export default function Spending() {
  const { space, isPersonal, nameOf } = useSpace();
  const { dataVersion, openQuickAdd } = useShell();
  const toast = useToast();
  const thisMonth = startOfMonth(todayISO());
  const [month, setMonth] = useState(thisMonth);
  const prevMonth = addMonths(month, -1);

  const { data, error, loading, reload, setData } = useLoad(async () => {
    const [current, previous] = await Promise.all([
      api.listExpenses(space.id, month, endOfMonth(month)),
      api.listExpenses(space.id, prevMonth, endOfMonth(prevMonth)),
    ]);
    return { current, previous };
  }, [space.id, month, dataVersion]);

  const view = useMemo(() => {
    if (!data) return null;
    const total = sum(data.current);
    const before = sum(data.previous);
    const byCategory = new Map();
    for (const e of data.current) byCategory.set(e.category || 'Other', (byCategory.get(e.category || 'Other') || 0) + Number(e.amount_minor));
    const categories = [...byCategory.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
    const days = [];
    for (const e of data.current) {
      const last = days[days.length - 1];
      if (last && last.date === e.spent_on) last.items.push(e);
      else days.push({ date: e.spent_on, items: [e] });
    }
    return { total, before, categories, days };
  }, [data]);

  async function remove(expense) {
    setData((d) => ({ ...d, current: d.current.filter((e) => e.id !== expense.id) }));
    try {
      await api.deleteExpense(expense.id);
      toast(`Deleted ${expense.title}`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await api.addExpense(space.id, { title: expense.title, amount_minor: expense.amount_minor, category: expense.category, spent_on: expense.spent_on, note: expense.note });
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

  const diff = view ? view.total - view.before : 0;
  const top = view?.categories[0]?.amount || 1;

  return (
    <div className="stack">
      <div className="card row-between" style={{ padding: '6px 8px' }}>
        <button type="button" className="icon-btn icon-btn--ghost" aria-label={`Show ${monthLabel(prevMonth)}`} onClick={() => setMonth(prevMonth)}>
          <Icon name="chevronLeft" size={20} stroke={2.4} />
        </button>
        <p className="bold" aria-live="polite">{monthLabel(month)}</p>
        <button type="button" className="icon-btn icon-btn--ghost" aria-label={`Show ${monthLabel(addMonths(month, 1))}`} disabled={month >= thisMonth} onClick={() => setMonth(addMonths(month, 1))} style={month >= thisMonth ? { opacity: 0.35 } : undefined}>
          <Icon name="chevronRight" size={20} stroke={2.4} />
        </button>
      </div>

      <LoadError error={error} onRetry={reload} />
      {loading && !data && <Loading rows={3} />}

      {view && (
        <section className="card" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
          <p className="eyebrow">Spent in {monthName(month)}</p>
          <p className="money-big">{formatINR(view.total)}</p>
          <p className="small bold" style={{ display: 'flex', alignItems: 'center', gap: 6, color: view.before === 0 ? 'var(--ink-2)' : diff <= 0 ? 'var(--get)' : 'var(--owe)' }}>
            {view.before === 0 ? (
              <>No spending recorded in {monthName(prevMonth)}</>
            ) : (
              <>
                <Icon name={diff <= 0 ? 'chevronDown' : 'chevronUp'} size={16} stroke={2.8} />
                {diff === 0 ? `Same as ${monthName(prevMonth)}` : `${formatINR(Math.abs(diff))} ${diff < 0 ? 'less' : 'more'} than ${monthName(prevMonth)}`}
              </>
            )}
          </p>
          <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={() => openQuickAdd('spent')}>
            <Icon name="plus" size={18} stroke={2.6} /> Add money spent
          </button>
        </section>
      )}

      {view && view.categories.length > 0 && (
        <section className="card" aria-labelledby="h-where" style={{ opacity: loading ? 0.6 : 1 }}>
          <h2 id="h-where" className="section-title" style={{ fontSize: 20 }}>Where it went</h2>
          <ul className="list" style={{ marginTop: 6 }}>
            {view.categories.map((c) => {
              const share = view.total ? Math.round((c.amount / view.total) * 100) : 0;
              return (
                <li key={c.name} className="row" style={{ minHeight: 56 }} aria-label={`${c.name}: ${formatINR(c.amount)}, ${share}% of the month`}>
                  <CostIcon category={c.name} size={17} />
                  <span className="row__main">
                    <span className="row-between" style={{ gap: 8 }}>
                      <span className="bold" style={{ fontSize: 14 }}>{c.name}</span>
                      <span className="small bold tabular">{formatINR(c.amount)} <span className="muted">· {share}%</span></span>
                    </span>
                    <span className="meter" aria-hidden="true" title={`${c.name}: ${formatINR(c.amount)} (${share}%)`}>
                      <span style={{ width: `${Math.max(2, (c.amount / top) * 100)}%` }} />
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {view && (
        <section className="card card--tight" aria-labelledby="h-all" style={{ opacity: loading ? 0.6 : 1 }}>
          <div className="card-head"><h2 id="h-all" className="section-title" style={{ fontSize: 20 }}>All spending</h2></div>
          {view.days.length === 0 && (
            <EmptyState mood="sleepy" title={`Nothing in ${monthName(month)}`}>
              Add money you’ve already spent — groceries, a cab, lunch.
            </EmptyState>
          )}
          {view.days.map((d) => (
            <div key={d.date} style={{ paddingBottom: 6 }}>
              <div className="row-between" style={{ marginTop: 8 }}>
                <h3 className="eyebrow">{relativeDay(d.date)}</h3>
                <span className="tiny bold muted tabular">{formatINR(sum(d.items))}</span>
              </div>
              <ul className="list">
                {d.items.map((e) => (
                  <li key={e.id} className="row">
                    <CostIcon title={e.title} category={e.category} />
                    <span className="row__main">
                      <span className="row__title" style={{ fontSize: 15 }}>{e.title}</span>
                      <span className="row__meta">{e.category || 'Other'}{!isPersonal && e.created_by ? ` · ${nameOf(e.created_by)}` : ''}</span>
                    </span>
                    <span className="row__amount">{formatINR(e.amount_minor)}</span>
                    <button type="button" className="icon-btn icon-btn--ghost icon-btn--sm" aria-label={`Delete ${e.title}`} onClick={() => remove(e)}>
                      <Icon name="trash" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
