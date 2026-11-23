import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Orbi from '../components/Orbi.jsx';
import SpacePill from '../components/SpacePill.jsx';
import HighlightsBanner from '../components/HighlightsBanner.jsx';
import { HeroDeco, Confetti } from '../components/Illustrations.jsx';
import { CheckButton, EmptyState, LoadError } from '../components/Controls.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSpace } from '../context/SpaceContext.jsx';
import { useShell } from '../context/ShellContext.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLoad } from '../hooks/useLoad.js';
import * as api from '../lib/api.js';
import { addMonths, dueLabel, formatDay, formatLong, formatTime, greeting, monthShort, parseISO, startOfMonth, toISO, todayISO } from '../lib/dates.js';
import { formatINR } from '../lib/money.js';
import { computeBalances } from '../lib/split.js';
import { cycleStats, cycleToday } from '../lib/cycle.js';
import { friendlyError } from '../lib/errors.js';

const byDue = (a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999') || (a.due_time || '99').localeCompare(b.due_time || '99');

export default function Home() {
  const { user, profile } = useAuth();
  const { space, ready, has, isPersonal, nameOf, activeMembers } = useSpace();
  const { dataVersion, openQuickAdd, openSwitcher } = useShell();
  const toast = useToast();
  const today = todayISO();

  const { data, error, reload, setData } = useLoad(async () => {
    if (!ready) return null;
    const monthStart = startOfMonth(today);
    const [tasks, bills, expenses, groceries, events, split] = await Promise.all([
      has('tasks') ? api.listTasks(space.id) : [],
      has('bills') ? api.listBills(space.id) : [],
      has('expenses') ? api.listExpenses(space.id, addMonths(monthStart, -1), today) : [],
      has('shopping') ? api.listGroceries(space.id) : [],
      has('calendar') ? api.listEvents(space.id, today) : [],
      has('split') && !isPersonal ? api.loadSplit(space.id) : null,
    ]);
    // Cycle reminders show only in My Space, and only if switched on in cycle settings.
    let cycle = null;
    if (isPersonal && has('health')) {
      const [settings, periods, logs] = await Promise.all([api.getCycleSettings(), api.listPeriods(), api.listCycleLogs(today, today)]);
      if (periods.length) {
        const stats = cycleStats(periods, settings);
        cycle = { settings, t: cycleToday(periods, stats, { today, showFertile: settings.show_fertile }), loggedToday: logs.length > 0 };
      }
    }
    return { tasks, bills, expenses, groceries, events, split, cycle };
  }, [space.id, ready, dataVersion]);

  const tasks = data?.tasks || [];
  const openDue = tasks.filter((t) => !t.completed_at && t.due_date && t.due_date <= today).sort(byDue);
  const doneToday = tasks.filter((t) => t.completed_at && toISO(new Date(t.completed_at)) === today);
  const undated = tasks.filter((t) => !t.completed_at && !t.due_date).slice(0, Math.max(0, 4 - openDue.length));
  const todayList = [...openDue, ...undated, ...doneToday];
  const total = openDue.length + doneToday.length;
  const left = openDue.length;
  const allDone = total > 0 && left === 0;

  const firstName = (profile?.display_name || '').split(' ')[0] || 'there';
  const heroLine = allDone ? 'All done for today! Orbi is proud of you.' : left === 0 ? 'Nothing due today. Enjoy it.' : `${left} ${left === 1 ? 'thing' : 'things'} to do today`;

  async function toggle(task) {
    const done = !task.completed_at;
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, completed_at: done ? new Date().toISOString() : null } : t)) }));
    try {
      await api.setTaskDone(task.id, user.id, done);
      if (done) toast(`Done: ${task.title}`, { action: { label: 'Undo', onClick: () => toggle({ ...task, completed_at: 'now' }) } });
    } catch (e) {
      toast(friendlyError(e), { tone: 'warn' });
      reload();
    }
  }

  const insights = useMemo(() => {
    if (!data) return {};
    const monthStart = startOfMonth(today);
    const thisMonth = data.expenses.filter((e) => e.spent_on >= monthStart).reduce((s, e) => s + e.amount_minor, 0);
    const lastMonth = data.expenses.filter((e) => e.spent_on < monthStart).reduce((s, e) => s + e.amount_minor, 0);
    const nextBill = data.bills.filter((b) => !b.paid_at).sort((a, b) => a.due_date.localeCompare(b.due_date))[0] || null;
    const toBuy = data.groceries.filter((g) => !g.purchased_at).length;
    const myNet = data.split ? computeBalances(data.split.expenses, data.split.settlements).get(user.id)?.net || 0 : 0;
    return { thisMonth, lastMonth, nextBill, toBuy, myNet, cycle: data.cycle };
  }, [data, today, user.id]);

  const slides = useMemo(() => {
    const list = [];
    const c = insights.cycle;
    if (c?.t) {
      const remind = c.settings.remind_days_before;
      const soon = remind > 0 && !c.t.inPeriod && (c.t.late || (c.t.daysUntil >= 0 && c.t.daysUntil <= remind));
      if (soon) {
        const words = c.t.late ? 'Your period is expected — log it when it starts' : c.t.daysUntil === 0 ? 'Your period may start today' : `Period may start in ${c.t.daysUntil} ${c.t.daysUntil === 1 ? 'day' : 'days'}`;
        list.push({
          key: 'cycle', tag: 'REMINDER', tone: 'blush', art: 'planets', cta: 'Open', to: '/health/cycle',
          title: c.settings.discreet ? 'Cycle reminder' : words,
          text: c.settings.discreet ? 'Only you can see this. Open Health for details.' : `Around ${formatDay(c.t.nextStart)}. Only you can see this.`,
        });
      }
      if (c.settings.daily_checkin && !c.loggedToday) {
        list.push({ key: 'checkin', tag: 'CHECK-IN', title: 'How are you today?', text: 'Log it in a few taps. Only you can see it.', cta: 'Log today', to: '/health/cycle', tone: 'lavender', art: 'planets' });
      }
    }
    if (insights.myNet > 0) list.push({ key: 'owed', tag: 'REMINDER', title: `Friends owe you ${formatINR(insights.myNet)}`, text: 'See who owes what and record payments.', cta: 'See who owes', to: '/money?tab=split', tone: 'mint', art: 'coins' });
    if (insights.myNet < 0) list.push({ key: 'owe', tag: 'REMINDER', title: `You owe ${formatINR(-insights.myNet)}`, text: 'Record it when you pay someone back.', cta: 'Settle up', to: '/money?tab=split', tone: 'peach', art: 'coins' });
    if (!isPersonal && insights.toBuy > 0) list.push({ key: 'shop', tag: 'SHOPPING', title: `${insights.toBuy} ${insights.toBuy === 1 ? 'thing' : 'things'} to buy`, text: 'Everyone can tick items off together.', cta: 'Open the list', to: '/lists?tab=shopping', tone: 'butter', art: 'cart' });
    if (insights.nextBill && insights.nextBill.due_date <= toISO(new Date(Date.now() + 3 * 86400000))) {
      const b = insights.nextBill;
      list.push({ key: 'bill', tag: 'BILL DUE', title: `${b.title} · ${formatINR(b.amount_minor)}`, text: `${dueLabel(b.due_date).text}. Mark it paid when you’ve paid.`, cta: 'Open bills', to: '/money?tab=bills', tone: 'blush', art: 'coins' });
    }
    list.push({ key: 'tip', tag: 'TIP', title: 'Switch spaces fast', text: 'Tap the space name at the top.', cta: 'Show me', onClick: openSwitcher, tone: 'sky', art: 'planets' });
    if (list.length < 3) list.push({ key: 'new', tag: 'WHAT’S NEW', title: 'Trips & events', text: 'Each trip keeps its own balance.', cta: 'Take a look', to: '/money?tab=split', tone: 'butter', art: 'suitcase' });
    return list.slice(0, 3);
  }, [insights, isPersonal, openSwitcher]);

  const tiles = [];
  if (has('expenses')) {
    const diff = insights.thisMonth - insights.lastMonth;
    tiles.push(
      <Link key="spent" to="/money?tab=spending" className="tile bg-mint" style={{ textDecoration: 'none' }}>
        <p className="tile__label ink-mint">Spent this month</p>
        <p className="tile__value">{formatINR(insights.thisMonth || 0)}</p>
        <p className="tiny bold ink-mint" style={{ marginTop: 4 }}>
          {insights.lastMonth ? `${formatINR(Math.abs(diff))} ${diff <= 0 ? 'less' : 'more'} than last month` : 'Track what you spend'}
        </p>
      </Link>,
    );
  }
  if (has('bills')) {
    const b = insights.nextBill;
    tiles.push(
      <Link key="bill" to="/money?tab=bills" className="tile bg-peach" style={{ textDecoration: 'none', display: 'flex', gap: 10, alignItems: 'center' }}>
        {b ? (
          <>
            <span aria-hidden="true" style={{ width: 48, flex: 'none', borderRadius: 12, background: '#fff', overflow: 'hidden', textAlign: 'center', color: '#14161c' }}>
              <span style={{ display: 'block', height: 12, background: '#FF7A59' }} />
              <span className="display" style={{ display: 'block', fontSize: 21, fontWeight: 800, lineHeight: '24px' }}>{parseISO(b.due_date).getDate()}</span>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 800, color: '#8A3B07', paddingBottom: 4 }}>{monthShort(b.due_date)}</span>
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="tile__label ink-peach" style={{ display: 'block' }}>Next bill</span>
              <span style={{ display: 'block', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
              <span className="display tabular" style={{ display: 'block', fontSize: 20, fontWeight: 800 }}>{formatINR(b.amount_minor)}</span>
            </span>
          </>
        ) : (
          <span><span className="tile__label ink-peach" style={{ display: 'block' }}>Bills</span><span style={{ fontWeight: 700 }}>No bills due. Nice.</span></span>
        )}
      </Link>,
    );
  }
  if (has('shopping') && tiles.length < 2) {
    tiles.push(
      <Link key="shop" to="/lists?tab=shopping" className="tile bg-butter" style={{ textDecoration: 'none' }}>
        <p className="tile__label ink-butter">To buy</p>
        <p className="tile__value">{insights.toBuy ?? 0}</p>
        <p className="tiny bold ink-butter">on the shopping list</p>
      </Link>,
    );
  }

  return (
    <>
      <section className="hero">
        <HeroDeco />
        <div className="hero__inner">
          <div className="topbar">
            <SpacePill onHero />
            <Link to="/calendar" className="icon-btn icon-btn--hero" aria-label="Calendar"><Icon name="calendar" size={22} /></Link>
          </div>
          <div className="row" style={{ marginTop: 10, minHeight: 0 }}>
            <div className="grow">
              {isPersonal ? (
                <>
                  <p style={{ fontSize: 15 }}>{greeting()},</p>
                  <h1>{firstName}</h1>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 15 }}>{greeting()}, {firstName}</p>
                  <h1 style={{ fontSize: 36, lineHeight: '40px' }}>{space.name}</h1>
                </>
              )}
            </div>
            <Orbi size={92} outline float />
          </div>
          <p style={{ marginTop: 6, display: 'flex', gap: 7, alignItems: 'center', fontSize: 14 }}>
            <Icon name="calendar" size={15} stroke={2.3} /> {formatLong(today)} · {heroLine}
          </p>
          {total > 0 && (
            <div className="row" style={{ minHeight: 0, marginTop: 10, gap: 10 }}>
              <div className="progress grow" role="progressbar" aria-label="Today’s progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneToday.length}>
                <div className="progress__bar" style={{ width: `${Math.round((doneToday.length / total) * 100)}%` }} />
              </div>
              <span className="small bold">{doneToday.length} of {total} done</span>
            </div>
          )}
        </div>
        {allDone && <Confetti />}
      </section>

      <div className="page" style={{ paddingTop: 0 }}>
        <div className="hero-overlap"><HighlightsBanner slides={slides} /></div>
        <LoadError error={error} onRetry={reload} />

        <div className="home-grid" style={{ marginTop: 14 }}>
          <div className="stack">
            {has('tasks') && (
              <section className="card card--tight" aria-labelledby="h-today">
                <div className="card-head">
                  <h2 id="h-today" className="section-title">Today</h2>
                  <Link className="link-btn" to="/lists?tab=todo">See all</Link>
                </div>
                {data && todayList.length === 0 && (
                  <EmptyState mood="hooray" title="Nothing due today" action={<button type="button" className="btn btn-secondary btn-sm" onClick={() => openQuickAdd('todo')}><Icon name="plus" size={16} /> Add a to-do</button>}>
                    Enjoy the free time.
                  </EmptyState>
                )}
                <ul className="list">
                  {todayList.map((t) => {
                    const done = !!t.completed_at;
                    const due = dueLabel(t.due_date);
                    const who = t.assignee_id && !isPersonal ? nameOf(t.assignee_id) : null;
                    return (
                      <li key={t.id} className="row">
                        <CheckButton checked={done} onClick={() => toggle(t)} label={`${done ? 'Mark not done' : 'Mark done'}: ${t.title}`} />
                        <span className="row__main">
                          <span className={`row__title ${done ? 'done-text' : ''}`}>{t.title}</span>
                          <span className={`row__meta ${due.late && !done ? 'late' : ''}`}>
                            {due.late && !done && <Icon name="clock" size={14} stroke={2.4} />}
                            {done ? 'Done — nice!' : [t.due_date ? due.text : 'No date', t.due_time ? formatTime(t.due_time) : null, who].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        {who && <Avatar id={t.assignee_id} name={nameOf(t.assignee_id, { you: false })} size={30} />}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {!has('tasks') && !has('shopping') && ready && (
              <EmptyState mood="thinking" title={`Welcome to ${space.name}`}>Turn on features in Space settings to get started.</EmptyState>
            )}
          </div>

          <div className="stack">
            {tiles.length > 0 && <div className="tile-grid">{tiles.slice(0, 2)}</div>}

            {data?.events?.length > 0 && (
              <section className="card card--tight" aria-labelledby="h-soon">
                <div className="card-head">
                  <h2 id="h-soon" className="section-title" style={{ fontSize: 19 }}>Coming up</h2>
                  <Link className="link-btn" to="/calendar">Calendar</Link>
                </div>
                <ul className="list">
                  {data.events.slice(0, 3).map((e) => (
                    <li key={e.id} className="row">
                      <span className="icon-tile bg-sky ink-sky"><Icon name="calendar" size={19} /></span>
                      <span className="row__main">
                        <span className="row__title">{e.title}</span>
                        <span className="row__meta">{formatDay(e.starts_on)}{e.start_time ? ` · ${formatTime(e.start_time)}` : ''}{e.location ? ` · ${e.location}` : ''}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!isPersonal && activeMembers.length <= 1 && ready && (
              <section className="card card--tint row" style={{ minHeight: 0 }}>
                <Icon name="users" size={22} />
                <span className="grow bold small">It’s just you here so far. Invite people from Space settings.</span>
                <Link className="btn btn-sm btn-primary" to="/spaces/settings">Invite</Link>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
