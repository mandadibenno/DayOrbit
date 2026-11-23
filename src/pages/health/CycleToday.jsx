import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import CycleRing from '../../components/CycleRing.jsx';
import Orbi from '../../components/Orbi.jsx';
import { EmptyState, LoadError, Loading } from '../../components/Controls.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSpace } from '../../context/SpaceContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useLoad } from '../../hooks/useLoad.js';
import * as api from '../../lib/api.js';
import { PHASES, cycleStats, cycleToday } from '../../lib/cycle.js';
import { addDays, formatDay, formatLong, formatRange, formatShort, monthShort, parseISO, todayISO } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { DISCLAIMER, LogForm, PhaseLegend, hasLog, logSummary } from './cycleUi.jsx';

const TONE_BG = { mint: 'var(--mint)', peach: 'var(--peach)', blush: 'var(--blush)' };

export default function CycleToday() {
  const { user } = useAuth();
  const { isPersonal, spaces, switchTo } = useSpace();
  const toast = useToast();
  const today = todayISO();
  const [flash, setFlash] = useState(null); // { text, undo }
  const [editingLog, setEditingLog] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [askStart, setAskStart] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, error, loading, reload } = useLoad(async () => {
    if (!isPersonal) return null;
    const [settings, periods, logs, shares] = await Promise.all([
      api.getCycleSettings(), api.listPeriods(), api.listCycleLogs(today, today), api.listHealthShares(),
    ]);
    const mine = shares.filter((s) => s.owner_id === user.id);
    const names = {};
    await Promise.all(mine.map(async (s) => { names[s.grantee_id] = (await api.getProfile(s.grantee_id).catch(() => null))?.display_name || 'Your partner'; }));
    return { settings, periods, todayLog: logs[0] || null, shares: mine, names };
  }, [isPersonal, today, user.id]);

  if (!isPersonal) {
    const mine = spaces.find((s) => s.type === 'personal');
    return (
      <div className="page">
        <EmptyState mood="thinking" title="Cycle tracking lives in My Space" action={mine && <button type="button" className="btn btn-primary" onClick={() => switchTo(mine.id)}>Go to My Space</button>}>
          It’s private to you, so it never shows in shared spaces.
        </EmptyState>
      </div>
    );
  }
  if (loading && !data) return <div className="page"><Loading rows={4} /></div>;
  if (error && !data) return <div className="page"><LoadError error={error} onRetry={reload} /></div>;
  if (!data.periods.length) return <CycleSetup settings={data.settings} onDone={reload} />;

  const showFertile = data.settings.show_fertile;
  const stats = cycleStats(data.periods, data.settings);
  const t = cycleToday(data.periods, stats, { showFertile });

  // Before the first logged period starts (e.g. a future date was entered) there's nothing to show yet.
  if (!t) return <CycleSetup settings={data.settings} onDone={reload} />;

  const phase = PHASES[t.phase];
  const phaseName = t.phase === 'period' ? `Period · day ${t.day}` : phase.name;
  const phaseText = t.phase === 'fertile'
    ? `Worked out from your past cycles. Ends around ${formatDay(t.fertileEnd)}. Not reliable for preventing pregnancy.`
    : phase.text;
  const center = t.inPeriod
    ? { line: `Period day ${t.day}`, sub: `Next around ${formatShort(t.nextStart)}` }
    : t.late
      ? { line: t.lateBy === 1 ? '1 day late' : `${t.lateBy} days late`, sub: 'Log it when it starts' }
      : { line: t.daysUntil === 0 ? 'Period may start today' : t.daysUntil === 1 ? 'Period in 1 day' : `Period in ${t.daysUntil} days`, sub: `Around ${formatShort(t.nextStart)}` };

  const upcoming = [];
  if (t.late) {
    upcoming.push({ date: t.nextStart, title: 'Period expected', sub: `Since ${formatDay(t.nextStart)} · cycles can vary`, tone: 'blush' });
  } else {
    if (showFertile && today < t.fertileStart) upcoming.push({ date: t.fertileStart, title: 'Fertile window starts', sub: `${formatDay(t.fertileStart)} · estimate`, tone: 'mint' });
    else if (showFertile && today <= t.fertileEnd) upcoming.push({ date: t.fertileEnd, title: 'Fertile window ends', sub: `${formatDay(t.fertileEnd)} · estimate`, tone: 'mint' });
    if (today < t.beforeStart) upcoming.push({ date: t.beforeStart, title: 'Before-period days', sub: `From ${formatDay(t.beforeStart)}`, tone: 'peach' });
    upcoming.push({ date: t.nextStart, title: 'Next period', sub: `${formatDay(t.nextStart)} · could be ${formatRange(t.rangeStart, t.rangeEnd)}`, tone: 'blush' });
  }

  const sorted = [...data.periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const latest = sorted[sorted.length - 1];
  const startsToday = latest.start_date === today;
  const couple = spaces.find((s) => s.type === 'couple' && Number(s.member_count) >= 2);

  async function periodStarted(date = today) {
    setBusy(true);
    try {
      // Close a period that was never ended, so dates stay sensible.
      const open = sorted.find((p) => !p.end_date && p.start_date < date);
      if (open) {
        const usual = addDays(open.start_date, stats.avgPeriod - 1);
        const dayBefore = addDays(date, -1);
        await api.updatePeriod(open.id, { end_date: usual < dayBefore ? usual : dayBefore });
      }
      const row = await api.addPeriod({ start_date: date });
      setAskStart(false);
      setFlash({ text: 'Period logged for today. Dates updated.', undo: async () => { await api.deletePeriod(row.id); if (open) await api.updatePeriod(open.id, { end_date: null }); } });
      reload();
    } catch (err) {
      toast(friendlyError(err), { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  }

  async function periodEnded() {
    const open = t.openPeriod;
    setBusy(true);
    try {
      await api.updatePeriod(open.id, { end_date: today });
      setFlash({ text: 'Period end saved. Your averages are updated.', undo: () => api.updatePeriod(open.id, { end_date: null }) });
      reload();
    } catch (err) {
      toast(friendlyError(err), { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  }

  async function saveLog(log) {
    setSavingLog(true);
    try {
      await api.saveCycleLog(user.id, today, { flow: log.flow, feelings: log.feelings, body: log.body, note: log.note.trim() || null });
      setEditingLog(false);
      if (['light', 'medium', 'heavy'].includes(log.flow) && !t.inPeriod && !startsToday) setAskStart(true);
      reload();
    } catch (err) {
      toast(friendlyError(err), { tone: 'warn' });
    } finally {
      setSavingLog(false);
    }
  }

  const logged = hasLog(data.todayLog);

  return (
    <div className="page">
      <div className="topbar">
        <Link className="back-btn" to="/health"><Icon name="chevronLeft" size={20} stroke={2.4} /> Health</Link>
        <span className="grow" />
        <span className="badge badge--private"><Icon name="lock" size={12} stroke={2.6} /> Only you</span>
        <Link className="icon-btn" to="/health/cycle/calendar" aria-label="Calendar and insights"><Icon name="calendar" size={20} /></Link>
      </div>
      <h1 className="page-title" style={{ marginTop: 12 }}>Cycle</h1>
      <p className="page-sub">{formatLong(today)}</p>

      <section className="card" style={{ marginTop: 16, paddingTop: 20 }}>
        <CycleRing day={t.day} avgCycle={stats.avgCycle} avgPeriod={stats.avgPeriod} showFertile={showFertile} label={`Cycle ring. Today is day ${t.day} of about ${stats.avgCycle}. ${phaseName}.`}>
          <span className="eyebrow">Day</span>
          <span className="ring__day">{t.day}</span>
          <span className="bold" style={{ marginTop: 4 }}>{center.line}</span>
          <span className="tiny bold muted">{center.sub}</span>
        </CycleRing>
        <div style={{ marginTop: 12 }}><PhaseLegend showFertile={showFertile} /></div>

        <div className="notice" style={{ marginTop: 14, background: phase.tint, color: 'var(--ink)' }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 5, background: phase.color, marginTop: 5, flex: 'none' }} />
          <span>
            <span className="eyebrow" style={{ display: 'block', color: 'inherit' }}>Today</span>
            <strong style={{ display: 'block', fontSize: 16 }}>{phaseName}</strong>
            <span className="small" style={{ fontWeight: 600 }}>{phaseText}</span>
          </span>
        </div>

        <div className="stack-sm" style={{ marginTop: 14 }}>
          {t.openPeriod ? (
            <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={periodEnded}>
              <Icon name="check" size={18} stroke={2.6} /> My period ended today
            </button>
          ) : t.inPeriod ? (
            <Link className="btn btn-secondary btn-block" to="/health/cycle/calendar">Change period dates</Link>
          ) : (
            <button type="button" className="btn btn-primary btn-block" disabled={busy || startsToday} onClick={() => periodStarted()}>
              <Icon name="drop" size={18} /> My period started today
            </button>
          )}
          <Link className="link-btn" style={{ justifyContent: 'center', width: '100%' }} to="/health/cycle/calendar">Different day? Pick it on the calendar</Link>
        </div>

        {flash && (
          <p className="notice notice--ok" role="status" style={{ marginTop: 10 }}>
            <Icon name="check" size={16} stroke={2.6} />
            <span className="grow">{flash.text}</span>
            <button type="button" className="link-btn" style={{ minHeight: 0 }} onClick={async () => { try { await flash.undo(); } catch (err) { toast(friendlyError(err), { tone: 'warn' }); } setFlash(null); reload(); }}>Undo</button>
          </p>
        )}
      </section>

      {askStart && (
        <section className="card card--tint row" style={{ marginTop: 14, minHeight: 0 }}>
          <Icon name="drop" size={22} />
          <span className="grow bold small">You logged flow today. Did your period start?</span>
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => periodStarted()}>Yes, log it</button>
          <button type="button" className="btn btn-sm btn-quiet" onClick={() => setAskStart(false)}>No</button>
        </section>
      )}

      <section className="card" style={{ marginTop: 14 }} aria-labelledby="h-feel">
        <h2 id="h-feel" className="section-title" style={{ fontSize: 20 }}>How are you today?</h2>
        {logged && !editingLog ? (
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <p className="status-line ok"><Icon name="check" size={18} stroke={2.6} /> Saved for today. Only you can see it.</p>
            <p className="small bold muted">{logSummary(data.todayLog)}</p>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditingLog(true)}><Icon name="edit" size={16} /> Edit</button>
          </div>
        ) : (
          <>
            <p className="small muted bold" style={{ marginTop: 2, marginBottom: 12 }}>Everything is optional. Tap what fits.</p>
            <LogForm initial={data.todayLog} onSave={saveLog} busy={savingLog} saveLabel="Save today" />
          </>
        )}
      </section>

      <section className="card card--tight" style={{ marginTop: 14 }} aria-labelledby="h-coming">
        <div className="card-head"><h2 id="h-coming" className="section-title" style={{ fontSize: 20 }}>Coming up <span className="small muted">· estimates</span></h2></div>
        <ul className="list">
          {upcoming.map((u) => (
            <li key={u.title} className="row">
              <span aria-hidden="true" style={{ width: 46, height: 46, flex: 'none', borderRadius: 14, background: TONE_BG[u.tone], color: '#14161c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.05 }}>
                <span style={{ fontSize: 10, fontWeight: 800 }}>{monthShort(u.date)}</span>
                <span className="display" style={{ fontSize: 18, fontWeight: 800 }}>{parseISO(u.date).getDate()}</span>
              </span>
              <span className="row__main">
                <span className="row__title" style={{ fontSize: 15 }}>{u.title}</span>
                <span className="row__meta">{u.sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {data.shares.length > 0 ? (
        data.shares.map((s) => (
          <section key={s.id} className="card card--flat row" style={{ marginTop: 14, minHeight: 0, padding: '12px 16px' }}>
            <Icon name="eye" size={20} />
            <span className="row__main">
              <span className="row__title" style={{ fontSize: 15 }}>{data.names[s.grantee_id]} sees your {s.scopes.includes('period_dates') ? 'period dates' : 'next-period estimate'}</span>
              <span className="row__meta">Not your notes, feelings or body logs</span>
            </span>
            <Link className="link-btn" to="/health/cycle/calendar#sharing">Change</Link>
          </section>
        ))
      ) : couple ? (
        <section className="card card--flat row" style={{ marginTop: 14, minHeight: 0, padding: '12px 16px' }}>
          <Icon name="heart" size={20} />
          <span className="row__main">
            <span className="row__title" style={{ fontSize: 15 }}>Not shared with anyone</span>
            <span className="row__meta">You can choose to share dates with your partner</span>
          </span>
          <Link className="link-btn" to="/health/cycle/calendar#sharing">Options</Link>
        </section>
      ) : null}

      <Link to="/health/cycle/calendar" className="btn btn-secondary btn-block" style={{ marginTop: 14 }}>
        <Icon name="calendar" size={18} /> Calendar & insights
      </Link>
      <p className="tiny muted bold center" style={{ marginTop: 14 }}>{DISCLAIMER}</p>
    </div>
  );
}

function CycleSetup({ settings, onDone }) {
  const { user } = useAuth();
  const toast = useToast();
  const today = todayISO();
  const [start, setStart] = useState(addDays(today, -7));
  const [periodLen, setPeriodLen] = useState(settings?.typical_period || 5);
  const [cycleLen, setCycleLen] = useState(settings?.typical_cycle || 28);
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    if (!start || start > today) { toast('Pick a day up to today.', { tone: 'warn' }); return; }
    setBusy(true);
    try {
      await api.saveCycleSettings(user.id, { typical_cycle: cycleLen, typical_period: periodLen });
      const end = addDays(start, periodLen - 1);
      await api.addPeriod({ start_date: start, end_date: end < today ? end : null });
      toast('All set. Only you can see this.');
      onDone();
    } catch (err) {
      toast(friendlyError(err), { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  }

  const stepper = (value, setValue, min, max, label) => (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Less: ${label}`} disabled={value <= min} onClick={() => setValue(Math.max(min, value - 1))}><span><Icon name="minus" size={16} stroke={2.6} /></span></button>
      <output aria-live="polite" style={{ width: 32 }}>{value}</output>
      <button type="button" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => setValue(Math.min(max, value + 1))}><span><Icon name="plus" size={16} stroke={2.6} /></span></button>
    </div>
  );

  return (
    <form className="page" onSubmit={save}>
      <div className="topbar"><Link className="back-btn" to="/health"><Icon name="chevronLeft" size={20} stroke={2.4} /> Health</Link></div>
      <div className="center" style={{ marginTop: 12 }}><Orbi mood="hello" size={110} /></div>
      <h1 className="page-title center" style={{ marginTop: 6 }}>Track your cycle</h1>
      <p className="page-sub center">Three quick questions. You can change any of this later. Only you can see it.</p>

      <section className="card stack" style={{ marginTop: 18 }}>
        <div className="field">
          <label className="label" htmlFor="cs-start">When did your last period start?</label>
          <input id="cs-start" className="input" type="date" value={start} max={today} onChange={(e) => setStart(e.target.value)} />
          <p className="help">Not sure? Pick your best guess.</p>
        </div>
        <div className="row-between">
          <span className="bold">How many days does it usually last?</span>
          {stepper(periodLen, setPeriodLen, 1, 14, 'Period length in days')}
        </div>
        <div className="row-between">
          <span className="bold">How long is your usual cycle?<span className="help" style={{ display: 'block', fontWeight: 600 }}>From one period to the next. Most are 21–35 days.</span></span>
          {stepper(cycleLen, setCycleLen, 15, 60, 'Cycle length in days')}
        </div>
      </section>
      <p className="notice notice--private" style={{ marginTop: 14 }}><Icon name="shield" size={16} />Private by default. Nothing is shared unless you turn it on.</p>
      <button type="submit" className="btn btn-primary btn-lg btn-block" style={{ marginTop: 14 }} disabled={busy}>{busy ? 'Saving…' : 'Start tracking'}</button>
      <p className="tiny muted bold center" style={{ marginTop: 14 }}>{DISCLAIMER}</p>
    </form>
  );
}
