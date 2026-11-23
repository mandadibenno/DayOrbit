import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import BottomSheet from '../../components/BottomSheet.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { LoadError, Loading, SwitchRow } from '../../components/Controls.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSpace } from '../../context/SpaceContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useLoad } from '../../hooks/useLoad.js';
import * as api from '../../lib/api.js';
import { cycleStats, cycleToday, dayStatus, symptomPatterns } from '../../lib/cycle.js';
import { addDays, addMonths, diffDays, endOfMonth, formatDay, formatLong, formatRange, monthLabel, parseISO, startOfMonth, todayISO } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { DISCLAIMER, LABELS, LogForm, hasLog, logSummary } from './cycleUi.jsx';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const shortMonth = (iso) => parseISO(iso).toLocaleDateString('en-IN', { month: 'short' });
const csvCell = (v) => {
  const text = v == null ? '' : String(v);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export default function CycleCalendar() {
  const { user } = useAuth();
  const { isPersonal, spaces } = useSpace();
  const toast = useToast();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const today = todayISO();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState(today);
  const [logDate, setLogDate] = useState(null);
  const [savingLog, setSavingLog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, error, loading, reload, setData } = useLoad(async () => {
    const [settings, periods, logs, shares] = await Promise.all([api.getCycleSettings(), api.listPeriods(), api.listCycleLogs(), api.listHealthShares()]);
    // Partners I could share with: the other person in each couple space.
    const couples = spaces.filter((s) => s.type === 'couple' && Number(s.member_count) >= 2);
    const partners = (await Promise.all(couples.map(async (space) => {
      const members = await api.listMembers(space.id).catch(() => []);
      const partner = members.find((m) => m.user_id !== user.id && !m.left_at);
      return partner ? { space, partner } : null;
    }))).filter(Boolean);
    return { settings, periods, logs, shares: shares.filter((s) => s.owner_id === user.id), partners };
  }, [user.id, spaces]);

  useEffect(() => {
    if (hash === '#sharing' && data) document.getElementById('sharing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, data]);

  const logsByDate = useMemo(() => new Map((data?.logs || []).map((l) => [l.log_date, l])), [data]);

  if (!isPersonal) return <div className="page"><p className="notice"><Icon name="lock" size={16} />Cycle tracking lives in My Space.</p></div>;
  if (loading && !data) return <div className="page"><Loading rows={5} /></div>;
  if (error && !data) return <div className="page"><LoadError error={error} onRetry={reload} /></div>;

  const { settings, periods } = data;
  const showFertile = settings.show_fertile;
  const stats = cycleStats(periods, settings);
  const t = cycleToday(periods, stats, { showFertile });
  const patterns = symptomPatterns(data.logs, periods, LABELS);

  // Month grid, Monday first.
  const first = parseISO(month);
  const lead = (first.getDay() + 6) % 7;
  const days = diffDays(endOfMonth(month), month) + 1;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => addDays(month, i))];

  const status = (iso) => dayStatus(iso, periods, stats, { showFertile });
  const sel = status(selected);
  const selLog = logsByDate.get(selected);
  const sorted = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const openEnd = (p) => p.end_date || (p.start_date <= today ? [addDays(p.start_date, stats.avgPeriod - 1), today].sort()[0] : p.start_date);
  const containing = sorted.find((p) => selected >= p.start_date && selected <= openEnd(p));
  const extendable = !containing && [...sorted].reverse().find((p) => p.start_date < selected && diffDays(selected, p.start_date) <= 13);
  const isPastOrToday = selected <= today;

  async function act(fn, message) {
    setBusy(true);
    try { await fn(); if (message) toast(message); reload(); } catch (err) { toast(friendlyError(err), { tone: 'warn' }); } finally { setBusy(false); }
  }

  const startOn = (date) => act(async () => {
    const next = sorted.find((p) => p.start_date > date);
    let end = addDays(date, stats.avgPeriod - 1);
    if (next && end >= next.start_date) end = addDays(next.start_date, -1);
    await api.addPeriod({ start_date: date, end_date: end < today ? end : null });
  }, `Period start saved for ${formatDay(date)}`);
  const endOn = (period, date) => act(() => api.updatePeriod(period.id, { end_date: date }), `Period end saved for ${formatDay(date)}`);
  const removePeriod = (period) => act(async () => {
    await api.deletePeriod(period.id);
    toast('Period removed', { action: { label: 'Undo', onClick: async () => { await api.addPeriod({ start_date: period.start_date, end_date: period.end_date }); reload(); } } });
  }, null);

  async function saveSetting(patch) {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
    try { await api.saveCycleSettings(user.id, patch); } catch (err) { toast(friendlyError(err), { tone: 'warn' }); reload(); }
  }

  async function setShare(partnerId, spaceId, current, scope, on) {
    const scopes = on ? [...new Set([...current, scope])] : current.filter((s) => s !== scope);
    try {
      await api.setHealthShare(partnerId, spaceId, scopes);
      toast(scopes.length ? 'Sharing updated' : 'Stopped sharing');
      reload();
    } catch (err) {
      toast(friendlyError(err), { tone: 'warn' });
    }
  }

  async function saveLog(log) {
    setSavingLog(true);
    try {
      await api.saveCycleLog(user.id, logDate, { flow: log.flow, feelings: log.feelings, body: log.body, note: log.note.trim() || null });
      toast(`Saved for ${formatDay(logDate)}`);
      setLogDate(null);
      reload();
    } catch (err) {
      toast(friendlyError(err), { tone: 'warn' });
    } finally {
      setSavingLog(false);
    }
  }

  function download() {
    const lines = ['Period start,Period end', ...sorted.map((p) => [p.start_date, p.end_date || ''].map(csvCell).join(',')), '', 'Date,Flow,Feelings,Body,Note'];
    for (const l of data.logs) lines.push([l.log_date, l.flow || '', (l.feelings || []).join(' '), (l.body || []).join(' '), l.note || ''].map(csvCell).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `dayorbit-cycle-${today}.csv` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Cycle-length columns: zero baseline, one hue, average as a solid hairline.
  const lengths = stats.lengths;
  const maxLen = Math.max(stats.avgCycle, ...lengths.map((l) => l.length)) * 1.15;
  const plotH = 110;

  return (
    <div className="page">
      <div className="topbar">
        <Link className="back-btn" to="/health/cycle"><Icon name="chevronLeft" size={20} stroke={2.4} /> Cycle</Link>
        <span className="grow" />
        <span className="badge badge--private"><Icon name="lock" size={12} stroke={2.6} /> Only you</span>
      </div>
      <h1 className="page-title" style={{ marginTop: 12 }}>Calendar & insights</h1>

      <section className="card" style={{ marginTop: 16 }} aria-labelledby="cal-month">
        <div className="row-between">
          <button type="button" className="icon-btn icon-btn--ghost" aria-label={`Show ${monthLabel(addMonths(month, -1))}`} onClick={() => setMonth(addMonths(month, -1))}><Icon name="chevronLeft" size={20} stroke={2.4} /></button>
          <h2 id="cal-month" className="bold" aria-live="polite">{monthLabel(month)}</h2>
          <button type="button" className="icon-btn icon-btn--ghost" aria-label={`Show ${monthLabel(addMonths(month, 1))}`} onClick={() => setMonth(addMonths(month, 1))}><Icon name="chevronRight" size={20} stroke={2.4} /></button>
        </div>
        <div className="cal-head" style={{ marginTop: 8 }} aria-hidden="true">{WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="cal-grid" role="grid" aria-label={`Cycle calendar for ${monthLabel(month)}`} style={{ marginTop: 4 }}>
          {cells.map((iso, i) => {
            if (!iso) return <span key={`b${i}`} aria-hidden="true" />;
            const st = status(iso);
            const log = logsByDate.get(iso);
            const cls = ['cal-cell', st.isPeriod && 'cal-cell--period', st.isPredicted && 'cal-cell--predicted', st.isFertile && 'cal-cell--fertile', iso === today && 'cal-cell--today', iso === selected && 'cal-cell--selected'].filter(Boolean).join(' ');
            const words = [st.isPeriod && 'period', st.isPredicted && 'predicted period', st.isFertile && 'fertile window estimate', hasLog(log) && 'has a log', iso === today && 'today'].filter(Boolean).join(', ');
            return (
              <button key={iso} type="button" className={cls} aria-pressed={iso === selected} aria-label={`${WEEKDAY_NAMES[(i) % 7]} ${parseISO(iso).getDate()}${words ? `, ${words}` : ''}`} onClick={() => setSelected(iso)}>
                <span>{parseISO(iso).getDate()}</span>
                {hasLog(log) && <span className="cal-dot" style={{ background: st.isPeriod ? '#fff' : 'var(--ink-2)' }} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <ul className="legend" style={{ marginTop: 12 }}>
          <li><i style={{ background: '#C2305F' }} />Period</li>
          <li><i style={{ border: '1.5px dashed #C2305F' }} />Predicted</li>
          {showFertile && <li><i style={{ background: 'var(--mint)', border: '1.5px dashed #2FA36B' }} />Fertile window (estimate)</li>}
          <li><i style={{ border: '2px solid var(--ink)' }} />Today</li>
          <li><i style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--ink-2)' }} />Has a log</li>
        </ul>

        <div className="card card--flat" style={{ marginTop: 14, padding: 14 }} aria-live="polite">
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div>
              <p className="bold">{formatLong(selected)}</p>
              <p className="small muted bold">
                {sel.cycleDay ? `Cycle day ${sel.cycleDay}` : 'Before your first logged period'}
                {sel.isPeriod ? ' · Period' : sel.isPredicted ? ' · Predicted period' : sel.isFertile ? ' · Fertile window (estimate)' : ''}
              </p>
            </div>
            {isPastOrToday && <button type="button" className="btn btn-sm btn-secondary" onClick={() => setLogDate(selected)}><Icon name="edit" size={16} /> {hasLog(selLog) ? 'Edit log' : 'Add log'}</button>}
          </div>
          <p className="small" style={{ marginTop: 6, fontWeight: 600 }}>{hasLog(selLog) ? logSummary(selLog) : isPastOrToday ? 'Nothing logged this day.' : 'This day is in the future. Predictions can change.'}</p>
          {isPastOrToday && (
            <div className="chips" style={{ marginTop: 10 }}>
              {containing && selected !== containing.start_date && (
                <button type="button" className="chip chip--sm" disabled={busy} onClick={() => endOn(containing, selected)}>Period ended this day</button>
              )}
              {containing && (
                <button type="button" className="chip chip--sm" disabled={busy} onClick={() => removePeriod(containing)}>Remove this period</button>
              )}
              {!containing && extendable && (
                <button type="button" className="chip chip--sm" disabled={busy} onClick={() => endOn(extendable, selected)}>Period ended this day</button>
              )}
              {!containing && !periods.some((p) => p.start_date === selected) && (
                <button type="button" className="chip chip--sm" disabled={busy} onClick={() => startOn(selected)}>Period started this day</button>
              )}
            </div>
          )}
        </div>

        {t && (
          <p className="notice" style={{ marginTop: 12, background: 'var(--blush)', color: 'var(--ink)' }}>
            <Icon name="drop" size={16} />
            <span>{t.late ? <>Your period was expected around <strong>{formatDay(t.nextStart)}</strong>. Cycles can vary.</> : <>Next period around <strong>{formatDay(t.nextStart)}</strong> <span className="muted">({formatRange(t.rangeStart, t.rangeEnd)})</span></>}</span>
          </p>
        )}
      </section>

      <section className="card" style={{ marginTop: 14 }} aria-labelledby="h-insights">
        <h2 id="h-insights" className="section-title" style={{ fontSize: 20 }}>Insights</h2>
        <p className="small muted bold">{stats.hasHistory ? `From your last ${lengths.length} ${lengths.length === 1 ? 'cycle' : 'cycles'}` : 'Log two periods to see your own averages. Until then we use your usual lengths.'}</p>
        <div className="tile-grid" style={{ marginTop: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <div className="tile bg-lavender"><p className="tile__value">{stats.avgCycle}<span className="small"> days</span></p><p className="tiny bold ink-lavender">Average cycle</p></div>
          <div className="tile bg-blush"><p className="tile__value">{stats.avgPeriod}<span className="small"> days</span></p><p className="tiny bold ink-blush">Average period</p></div>
          <div className="tile bg-mint">
            <p className="bold" style={{ fontSize: 17, marginTop: 4 }}>{stats.regular == null ? 'Too early' : stats.regular ? 'Regular' : 'Varies'}</p>
            <p className="tiny bold ink-mint">{stats.variation == null ? 'Needs 2+ cycles' : `Varies ±${stats.variation} ${stats.variation === 1 ? 'day' : 'days'}`}</p>
          </div>
        </div>

        {lengths.length > 1 && (
          <figure style={{ marginTop: 16 }}>
            <figcaption className="row-between">
              <span className="bold small">Cycle length</span>
              <span className="tiny bold muted">days · line = average {stats.avgCycle}</span>
            </figcaption>
            <div className="bars" role="img" aria-label={`Cycle lengths: ${lengths.map((l) => `${shortMonth(l.start)} ${l.length} days`).join(', ')}. Average ${stats.avgCycle} days.`}>
              <div className="bars__avg" style={{ bottom: 22 + (stats.avgCycle / maxLen) * plotH }} aria-hidden="true" />
              <div className="bars__plot">
                {lengths.map((l) => (
                  <div key={l.start} className="bars__bar" style={{ height: (l.length / maxLen) * plotH }} title={`${shortMonth(l.start)}: ${l.length} days`}>
                    <span className="bars__value">{l.length}</span>
                  </div>
                ))}
              </div>
              <div className="bars__labels" aria-hidden="true">{lengths.map((l) => <span key={l.start}>{shortMonth(l.start)}</span>)}</div>
            </div>
          </figure>
        )}

        <h3 className="bold" style={{ marginTop: 16 }}>Patterns in your logs</h3>
        {patterns.length === 0 ? (
          <p className="small muted bold" style={{ marginTop: 4 }}>Log how you feel on a few days and patterns will show up here.</p>
        ) : (
          <ul className="list">
            {patterns.map((p) => (
              <li key={p.key} className="row" style={{ minHeight: 48 }}>
                <span className="row__main"><span className="row__title" style={{ fontSize: 15 }}>{p.label}</span></span>
                <span className="small bold muted">{p.when}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="tiny muted bold" style={{ marginTop: 8 }}>Patterns, not a diagnosis. If something worries you, talk to a doctor.</p>
      </section>

      <section className="card" style={{ marginTop: 14 }} aria-labelledby="h-reminders">
        <h2 id="h-reminders" className="section-title" style={{ fontSize: 20 }}>Reminders & predictions</h2>
        <SwitchRow checked={settings.show_fertile} onChange={(v) => saveSetting({ show_fertile: v })} label="Show fertile window" sub="An estimate only. Not for preventing pregnancy." />
        <SwitchRow checked={settings.discreet} onChange={(v) => saveSetting({ discreet: v })} label="Discreet reminders" sub="Home shows “Cycle reminder” without details." />
        <SwitchRow checked={settings.daily_checkin} onChange={(v) => saveSetting({ daily_checkin: v })} label="Daily check-in nudge" sub="A gentle reminder on Home to log how you feel." />
        <div className="row-between" style={{ minHeight: 62 }}>
          <span><span className="row__title" style={{ fontSize: 15, fontWeight: 800 }}>Remind me before my period</span><span className="row__meta">{settings.remind_days_before ? `${settings.remind_days_before} ${settings.remind_days_before === 1 ? 'day' : 'days'} before, on Home` : 'Off'}</span></span>
          <Stepper value={settings.remind_days_before} min={0} max={7} label="Days before" onChange={(v) => saveSetting({ remind_days_before: v })} />
        </div>
        <div className="row-between" style={{ minHeight: 62 }}>
          <span><span className="row__title" style={{ fontSize: 15, fontWeight: 800 }}>Usual cycle</span><span className="row__meta">Used until you’ve logged 2 periods</span></span>
          <Stepper value={settings.typical_cycle} min={15} max={60} label="Usual cycle length" onChange={(v) => saveSetting({ typical_cycle: v })} />
        </div>
        <div className="row-between" style={{ minHeight: 62 }}>
          <span><span className="row__title" style={{ fontSize: 15, fontWeight: 800 }}>Usual period</span><span className="row__meta">Days your period lasts</span></span>
          <Stepper value={settings.typical_period} min={1} max={14} label="Usual period length" onChange={(v) => saveSetting({ typical_period: v })} />
        </div>
      </section>

      <section id="sharing" className="card" style={{ marginTop: 14, scrollMarginTop: 16 }} aria-labelledby="h-sharing">
        <h2 id="h-sharing" className="section-title" style={{ fontSize: 20 }}>Sharing</h2>
        {data.partners.length === 0 ? (
          <>
            <p className="small muted bold" style={{ marginTop: 4 }}>Not shared with anyone. You can choose to share dates with a partner in a Couple space.</p>
            <Link className="btn btn-sm btn-secondary" style={{ marginTop: 10 }} to="/spaces/new?type=couple">Create a Couple space</Link>
          </>
        ) : data.partners.map(({ space, partner }) => {
          const share = data.shares.find((s) => s.grantee_id === partner.user_id && s.space_id === space.id);
          const scopes = share?.scopes || [];
          return (
            <div key={space.id} style={{ marginTop: 6 }}>
              <p className="small bold muted">With {partner.display_name} in {space.name}</p>
              <SwitchRow checked={scopes.includes('period_dates')} onChange={(v) => setShare(partner.user_id, space.id, scopes, 'period_dates', v)} label="My period dates" sub="The days your period started and ended" />
              <SwitchRow checked={scopes.includes('prediction')} onChange={(v) => setShare(partner.user_id, space.id, scopes, 'prediction', v)} label="My next-period estimate" sub="When your next period may start" />
              {share?.last_viewed_at && <p className="tiny muted bold">Last seen by {partner.display_name} {formatDay(share.last_viewed_at.slice(0, 10))}</p>}
            </div>
          );
        })}
        <p className="notice notice--private" style={{ marginTop: 10 }}><Icon name="shield" size={16} />Never shared: your notes, feelings, body logs and medicines. Turn sharing off any time.</p>
      </section>

      <section className="card stack-sm" style={{ marginTop: 14 }}>
        <button type="button" className="btn btn-secondary btn-block" onClick={download}><Icon name="download" size={18} /> Download my cycle data (CSV)</button>
        <p className="tiny muted bold center">Handy for a doctor’s visit. The file stays on your device.</p>
        <button type="button" className="btn btn-danger-text btn-block" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={18} /> Delete all cycle data…</button>
      </section>
      <p className="tiny muted bold center" style={{ marginTop: 14 }}>{DISCLAIMER}</p>

      <BottomSheet open={!!logDate} onClose={() => setLogDate(null)} title={logDate ? formatDay(logDate) : 'Log'}>
        {logDate && <LogForm initial={logsByDate.get(logDate)} onSave={saveLog} busy={savingLog} saveLabel="Save" />}
      </BottomSheet>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete all cycle data?"
        danger
        requireText="DELETE"
        confirmLabel="Delete everything"
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await api.deleteAllCycleData();
            toast('All cycle data deleted');
            navigate('/health', { replace: true });
          } catch (err) {
            toast(friendlyError(err), { tone: 'warn' });
          } finally {
            setBusy(false);
            setConfirmDelete(false);
          }
        }}
      >
        <p>This deletes every period and daily log, resets your cycle settings and stops any sharing. It can’t be undone. Medicines are not affected.</p>
      </ConfirmDialog>
    </div>
  );
}

function Stepper({ value, min, max, label, onChange }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Less: ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}><span><Icon name="minus" size={16} stroke={2.6} /></span></button>
      <output aria-live="polite" style={{ width: 30 }}>{value}</output>
      <button type="button" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><span><Icon name="plus" size={16} stroke={2.6} /></span></button>
    </div>
  );
}
