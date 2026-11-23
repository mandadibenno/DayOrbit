import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import SpacePill from '../components/SpacePill.jsx';
import { EmptyState, LoadError, Loading } from '../components/Controls.jsx';
import { useSpace } from '../context/SpaceContext.jsx';
import { useShell } from '../context/ShellContext.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLoad } from '../hooks/useLoad.js';
import * as api from '../lib/api.js';
import { formatTime, monthShort, parseISO, relativeDay, todayISO, weekdayShort, addDays } from '../lib/dates.js';
import { friendlyError } from '../lib/errors.js';
import { formatINR } from '../lib/money.js';

export default function Calendar() {
  const { space, ready, has, isPersonal, nameOf } = useSpace();
  const { dataVersion, openQuickAdd } = useShell();
  const toast = useToast();
  const today = todayISO();

  const { data, error, loading, reload, setData } = useLoad(async () => {
    if (!ready) return null;
    const [events, bills, tasks] = await Promise.all([
      has('calendar') ? api.listEvents(space.id, today) : [],
      has('bills') ? api.listBills(space.id) : [],
      has('tasks') ? api.listTasks(space.id) : [],
    ]);
    const items = [
      ...events.map((e) => ({ kind: 'event', id: e.id, date: e.starts_on, time: e.start_time, item: e })),
      ...bills.filter((b) => !b.paid_at && b.due_date >= today).map((b) => ({ kind: 'bill', id: b.id, date: b.due_date, time: null, item: b })),
      ...tasks.filter((t) => !t.completed_at && t.due_date && t.due_date >= today).map((t) => ({ kind: 'task', id: t.id, date: t.due_date, time: t.due_time, item: t })),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99'));
    return { items };
  }, [space.id, ready, dataVersion, today]);

  const groups = [];
  for (const entry of data?.items || []) {
    const last = groups[groups.length - 1];
    if (last && last.date === entry.date) last.items.push(entry);
    else groups.push({ date: entry.date, items: [entry] });
  }
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const countOn = (iso) => (data?.items || []).filter((x) => x.date === iso).length;

  async function removeEvent(event) {
    setData((d) => ({ ...d, items: d.items.filter((x) => !(x.kind === 'event' && x.id === event.id)) }));
    try {
      await api.deleteEvent(event.id);
      toast('Event deleted', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try { await api.addEvent(space.id, { title: event.title, starts_on: event.starts_on, start_time: event.start_time, end_time: event.end_time, location: event.location, notes: event.notes }); } catch (err) { toast(friendlyError(err), { tone: 'warn' }); }
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
    <div className="page">
      <div className="topbar">
        <Link className="back-btn" to="/menu"><Icon name="chevronLeft" size={20} stroke={2.4} /> Menu</Link>
        <span className="grow" />
        {has('calendar') && <button type="button" className="btn btn-sm btn-primary" onClick={() => openQuickAdd('event')}><Icon name="plus" size={16} stroke={2.6} /> Event</button>}
      </div>
      <h1 className="page-title" style={{ marginTop: 12 }}>Calendar</h1>
      <p className="page-sub">Events, bills and to-dos coming up in {space.name}.</p>
      <div style={{ marginTop: 12 }}><SpacePill /></div>

      <div className="card" style={{ marginTop: 14, padding: 10, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }} aria-label="Next 7 days">
        {week.map((iso) => {
          const n = countOn(iso);
          return (
            <div key={iso} className="center" style={{ padding: '6px 0', borderRadius: 12, background: iso === today ? 'var(--space-tint)' : 'transparent' }} aria-label={`${relativeDay(iso)}: ${n} ${n === 1 ? 'item' : 'items'}`}>
              <span className="tiny bold muted" style={{ display: 'block' }}>{weekdayShort(iso)}</span>
              <span className="display" style={{ display: 'block', fontSize: 18, fontWeight: 800 }}>{parseISO(iso).getDate()}</span>
              <span aria-hidden="true" style={{ display: 'block', height: 6, marginTop: 2 }}>{n > 0 && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: 'var(--space)' }} />}</span>
            </div>
          );
        })}
      </div>

      <LoadError error={error} onRetry={reload} />
      {loading && !data && <div style={{ marginTop: 14 }}><Loading rows={3} /></div>}

      {data && groups.length === 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <EmptyState mood="sleepy" title="Nothing coming up" action={has('calendar') && <button type="button" className="btn btn-primary" onClick={() => openQuickAdd('event')}><Icon name="plus" size={18} /> Add an event</button>}>
            Birthdays, trips, appointments — add them here and everyone in this space sees them.
          </EmptyState>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.date} className="card card--tight" style={{ marginTop: 14 }} aria-label={relativeDay(g.date)}>
          <div className="card-head">
            <span aria-hidden="true" style={{ width: 40, textAlign: 'center', lineHeight: 1.05 }}>
              <span className="tiny bold muted" style={{ display: 'block' }}>{monthShort(g.date)}</span>
              <span className="display" style={{ display: 'block', fontSize: 20, fontWeight: 800 }}>{parseISO(g.date).getDate()}</span>
            </span>
            <h2 className="bold" style={{ fontSize: 16 }}>{relativeDay(g.date)}</h2>
          </div>
          <ul className="list">
            {g.items.map(({ kind, id, item }) => (
              <li key={`${kind}-${id}`} className="row">
                {kind === 'event' && <span className="icon-tile bg-sky ink-sky"><Icon name="calendar" size={18} /></span>}
                {kind === 'bill' && <span className="icon-tile bg-peach ink-peach"><Icon name="receipt" size={18} /></span>}
                {kind === 'task' && <span className="icon-tile bg-lavender ink-lavender"><Icon name="list" size={18} /></span>}
                <span className="row__main">
                  <span className="row__title" style={{ fontSize: 15 }}>{item.title}</span>
                  <span className="row__meta">
                    {kind === 'event' && [item.start_time ? formatTime(item.start_time) : 'All day', item.location].filter(Boolean).join(' · ')}
                    {kind === 'bill' && `Bill due · ${formatINR(item.amount_minor)}`}
                    {kind === 'task' && ['To-do', item.due_time ? formatTime(item.due_time) : null, !isPersonal && item.assignee_id ? nameOf(item.assignee_id) : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {kind === 'event' && (
                  <button type="button" className="icon-btn icon-btn--ghost icon-btn--sm" aria-label={`Delete ${item.title}`} onClick={() => removeEvent(item)}><Icon name="trash" size={18} /></button>
                )}
                {kind === 'bill' && <Link className="link-btn" to="/money?tab=bills" aria-label={`Open bills for ${item.title}`}>Open</Link>}
                {kind === 'task' && <Link className="link-btn" to="/lists?tab=todo" aria-label={`Open to-dos for ${item.title}`}>Open</Link>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
