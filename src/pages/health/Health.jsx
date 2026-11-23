import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import BottomSheet from '../../components/BottomSheet.jsx';
import CycleRing from '../../components/CycleRing.jsx';
import Orbi from '../../components/Orbi.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { CheckButton, EmptyState, LoadError, Loading } from '../../components/Controls.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSpace } from '../../context/SpaceContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useLoad } from '../../hooks/useLoad.js';
import * as api from '../../lib/api.js';
import { cycleStats, cycleToday } from '../../lib/cycle.js';
import { formatDay, formatRange, formatTime, todayISO } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';

/** The headline for where someone is in their cycle, in plain words. */
export function cycleHeadline(t) {
  if (!t) return { line: 'Not tracking yet', sub: '' };
  if (t.inPeriod) return { line: `Period · day ${t.day}`, sub: `Next one around ${formatDay(t.nextStart)}` };
  if (t.late) return { line: t.lateBy === 1 ? 'Period is 1 day late' : `Period is ${t.lateBy} days late`, sub: 'Cycles can vary. Log it when it starts.' };
  if (t.daysUntil === 0) return { line: 'Period may start today', sub: `Could be ${formatRange(t.rangeStart, t.rangeEnd)}` };
  return {
    line: t.daysUntil === 1 ? 'Period in 1 day' : `Period in ${t.daysUntil} days`,
    sub: `Around ${formatDay(t.nextStart)} · could be ${formatRange(t.rangeStart, t.rangeEnd)}`,
  };
}

const slotsOf = (med) => (med.times?.length ? [...med.times].sort() : ['daily']);
const nowHHMM = () => new Date().toTimeString().slice(0, 5);
const timeOf = (iso) => new Date(iso).toTimeString().slice(0, 5);

export default function Health() {
  const { user } = useAuth();
  const { isPersonal, has, spaces, switchTo } = useSpace();
  const toast = useToast();
  const today = todayISO();
  const [adding, setAdding] = useState(false);
  const [openMed, setOpenMed] = useState(null);

  const { data, error, loading, reload, setData } = useLoad(async () => {
    if (!isPersonal) return null;
    const [medicines, doses, settings, periods, shares] = await Promise.all([
      api.listMedicines(), api.listDoses(today), api.getCycleSettings(), api.listPeriods(), api.listHealthShares(),
    ]);
    const people = {};
    await Promise.all([...new Set(shares.map((s) => (s.owner_id === user.id ? s.grantee_id : s.owner_id)))].map(async (id) => {
      people[id] = (await api.getProfile(id).catch(() => null))?.display_name || 'Your partner';
    }));
    return { medicines, doses, settings, periods, shares, people };
  }, [isPersonal, today, user.id]);

  if (!isPersonal) {
    const mine = spaces.find((s) => s.type === 'personal');
    return (
      <div className="page">
        <EmptyState mood="thinking" title="Health lives in My Space" action={mine && <button type="button" className="btn btn-primary" onClick={() => switchTo(mine.id)}>Go to My Space</button>}>
          Medicines and cycle tracking are private to you, so they never show in shared spaces.
        </EmptyState>
      </div>
    );
  }
  if (!has('health')) {
    return (
      <div className="page">
        <EmptyState mood="sleepy" title="Health is turned off" action={<Link className="btn btn-secondary" to="/spaces/settings">Turn it on</Link>}>
          You can switch it back on in My Space settings. Nothing was deleted.
        </EmptyState>
      </div>
    );
  }
  if (loading && !data) return <div className="page"><Loading rows={4} /></div>;

  const stats = data ? cycleStats(data.periods, data.settings) : null;
  const t = data ? cycleToday(data.periods, stats, { showFertile: data.settings.show_fertile }) : null;
  const head = cycleHeadline(t);
  const taken = new Map((data?.doses || []).map((d) => [`${d.medicine_id}|${d.slot}`, d]));
  const allSlots = (data?.medicines || []).flatMap((m) => slotsOf(m).map((slot) => ({ med: m, slot })));
  const takenCount = allSlots.filter(({ med, slot }) => taken.has(`${med.id}|${slot}`)).length;
  const sharedWithMe = (data?.shares || []).filter((s) => s.grantee_id === user.id);
  const sharedByMe = (data?.shares || []).filter((s) => s.owner_id === user.id);

  async function toggleDose(med, slot) {
    const key = `${med.id}|${slot}`;
    const was = taken.has(key);
    setData((d) => ({
      ...d,
      doses: was ? d.doses.filter((x) => !(x.medicine_id === med.id && x.slot === slot)) : [...d.doses, { medicine_id: med.id, slot, dose_date: today, taken_at: new Date().toISOString() }],
    }));
    try {
      await api.markDose(med.id, today, slot, !was);
      if (!was) toast(`${med.name} taken`, { action: { label: 'Undo', onClick: () => toggleDose(med, slot) } });
    } catch (err) {
      toast(friendlyError(err), { tone: 'warn' });
      reload();
    }
  }

  return (
    <div className="page">
      <div className="topbar">
        <Link className="back-btn" to="/menu"><Icon name="chevronLeft" size={20} stroke={2.4} /> Menu</Link>
      </div>
      <div className="row" style={{ minHeight: 0, marginTop: 12 }}>
        <div className="grow">
          <h1 className="page-title">Health</h1>
          <p className="page-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="lock" size={15} stroke={2.4} /> Private to you</p>
        </div>
        <Orbi mood="hello" size={72} />
      </div>
      <LoadError error={error} onRetry={reload} />

      {data && (
        <div className="stack" style={{ marginTop: 16 }}>
          {t ? (
            <Link to="/health/cycle" className="card row row--button" style={{ padding: 16, alignItems: 'center' }} aria-label={`Cycle. Day ${t.day}. ${head.line}. Open cycle tracker`}>
              <CycleRing mini day={t.day} avgCycle={stats.avgCycle} avgPeriod={stats.avgPeriod} showFertile={data.settings.show_fertile} label={`Day ${t.day} of about ${stats.avgCycle}`}>
                <span className="tiny bold muted">DAY</span>
                <span className="ring__day">{t.day}</span>
              </CycleRing>
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="eyebrow" style={{ display: 'block' }}>Cycle</span>
                <span className="display" style={{ display: 'block', fontSize: 22, fontWeight: 800, lineHeight: '27px' }}>{head.line}</span>
                <span className="small muted bold" style={{ display: 'block', marginTop: 2 }}>{head.sub}</span>
                <span className="btn btn-sm btn-primary" style={{ marginTop: 10 }}>Log today</span>
              </span>
            </Link>
          ) : (
            <section className="card row" style={{ minHeight: 0, alignItems: 'flex-start' }}>
              <span className="icon-tile icon-tile--lg bg-blush ink-blush"><Icon name="drop" size={24} /></span>
              <div className="grow">
                <h2 className="section-title" style={{ fontSize: 20 }}>Track your cycle</h2>
                <p className="small muted bold" style={{ marginTop: 2 }}>See your next period coming, notice patterns, and keep it all private. Only you can see it.</p>
                <Link className="btn btn-sm btn-primary" style={{ marginTop: 10 }} to="/health/cycle">Start tracking</Link>
              </div>
            </section>
          )}

          <section className="card card--tight" aria-labelledby="h-meds">
            <div className="card-head">
              <h2 id="h-meds" className="section-title" style={{ fontSize: 20 }}>Medicines today</h2>
              {allSlots.length > 0 && <span className="badge badge--neutral">{takenCount} of {allSlots.length} taken</span>}
            </div>
            {data.medicines.length === 0 && (
              <p className="small muted bold" style={{ paddingBottom: 8 }}>Add medicines or vitamins to tick them off each day.</p>
            )}
            <ul className="list">
              {allSlots.map(({ med, slot }) => {
                const dose = taken.get(`${med.id}|${slot}`);
                const late = !dose && slot !== 'daily' && slot < nowHHMM();
                return (
                  <li key={`${med.id}|${slot}`} className="row">
                    <CheckButton checked={!!dose} onClick={() => toggleDose(med, slot)} label={`${dose ? 'Not taken' : 'Mark taken'}: ${med.name}${slot !== 'daily' ? ` at ${formatTime(slot)}` : ''}`} />
                    <button type="button" className="row__main row--button" onClick={() => setOpenMed(med)}>
                      <span className={`row__title ${dose ? 'done-text' : ''}`} style={{ fontSize: 15 }}>{med.name}{med.dose ? <span className="muted"> · {med.dose}</span> : null}</span>
                      <span className={`row__meta ${late ? 'late' : ''}`}>
                        {dose ? `Taken ${formatTime(timeOf(dose.taken_at))}` : slot === 'daily' ? 'Any time today' : `${late ? 'Was due' : 'Due'} ${formatTime(slot)}`}
                        {med.notes ? ` · ${med.notes}` : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="btn btn-secondary btn-block btn-sm" style={{ margin: '6px 0 12px' }} onClick={() => setAdding(true)}>
              <Icon name="plus" size={16} stroke={2.6} /> Add a medicine
            </button>
          </section>

          {sharedWithMe.map((s) => (
            <Link key={s.id} to={`/health/shared/${s.owner_id}`} className="card row row--button" style={{ padding: '12px 16px' }}>
              <Avatar id={s.owner_id} name={data.people[s.owner_id]} size={40} />
              <span className="row__main">
                <span className="row__title" style={{ fontSize: 15 }}>{data.people[s.owner_id]} shares their cycle with you</span>
                <span className="row__meta">{s.scopes.includes('prediction') ? 'Next-period estimate' : ''}{s.scopes.length === 2 ? ' and ' : ''}{s.scopes.includes('period_dates') ? 'period dates' : ''}</span>
              </span>
              <Icon name="chevronRight" size={16} />
            </Link>
          ))}

          {sharedByMe.length > 0 ? (
            sharedByMe.map((s) => (
              <section key={s.id} className="card card--flat row" style={{ minHeight: 0, padding: '12px 16px' }}>
                <Icon name="eye" size={20} />
                <span className="row__main">
                  <span className="row__title" style={{ fontSize: 15 }}>{data.people[s.grantee_id]} sees your {s.scopes.includes('period_dates') ? 'period dates' : 'next-period estimate'}</span>
                  <span className="row__meta">Never your notes, feelings, body logs or medicines</span>
                </span>
                <Link className="link-btn" to="/health/cycle/calendar#sharing">Manage</Link>
              </section>
            ))
          ) : null}

          <p className="notice notice--private"><Icon name="shield" size={16} />Medicines are never shared. Health never shows in shared spaces.</p>
        </div>
      )}

      <AddMedicineSheet open={adding} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />
      <MedicineSheet med={openMed} onClose={() => setOpenMed(null)} onStopped={() => { setOpenMed(null); reload(); }} />
    </div>
  );
}

function AddMedicineSheet({ open, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', dose: '', times: ['08:00'], notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Add the medicine’s name.'); return; }
    setBusy(true);
    try {
      const times = [...new Set(form.times.filter(Boolean))].sort();
      await api.addMedicine({ name: form.name.trim(), dose: form.dose.trim() || null, times, notes: form.notes.trim() || null });
      toast(`${form.name.trim()} added`);
      setForm({ name: '', dose: '', times: ['08:00'], notes: '' });
      onSaved();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Add a medicine">
      <form className="stack" onSubmit={save} noValidate>
        <div className="field">
          <label className="label" htmlFor="med-name">Name</label>
          <input id="med-name" className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Vitamin D3" autoFocus />
        </div>
        <div className="field">
          <label className="label" htmlFor="med-dose">Dose <span className="muted">(optional)</span></label>
          <input id="med-dose" className="input" value={form.dose} onChange={(e) => set({ dose: e.target.value })} placeholder="e.g. 1 tablet" />
        </div>
        <div className="field">
          <p className="label">When do you take it?</p>
          <div className="stack-sm">
            {form.times.map((time, i) => (
              <div key={i} className="input-row">
                <input className="input" type="time" aria-label={`Time ${i + 1}`} value={time} onChange={(e) => set({ times: form.times.map((x, j) => (j === i ? e.target.value : x)) })} />
                <button type="button" className="icon-btn" aria-label={`Remove time ${i + 1}`} onClick={() => set({ times: form.times.filter((_, j) => j !== i) })}>
                  <Icon name="x" size={18} stroke={2.4} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="link-btn" onClick={() => set({ times: [...form.times, '21:00'] })}>+ Add another time</button>
          {form.times.length === 0 && <p className="help">No time set: it shows as “any time today”.</p>}
        </div>
        <div className="field">
          <label className="label" htmlFor="med-notes">Note <span className="muted">(optional)</span></label>
          <input id="med-notes" className="input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. After lunch" />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Saving…' : 'Add medicine'}</button>
      </form>
    </BottomSheet>
  );
}

function MedicineSheet({ med, onClose, onStopped }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!med) return null;
  async function stop() {
    setBusy(true);
    try { await api.stopMedicine(med.id); toast(`Stopped ${med.name}`); onStopped(); } catch (err) { toast(friendlyError(err), { tone: 'warn' }); } finally { setBusy(false); }
  }
  return (
    <BottomSheet open={!!med} onClose={onClose} title={med.name}>
      <div className="stack">
        <p className="bold">{med.dose || 'No dose set'}</p>
        <p className="small muted bold">{med.times?.length ? `Taken at ${[...med.times].sort().map(formatTime).join(', ')}` : 'Any time of day'}{med.notes ? ` · ${med.notes}` : ''}</p>
        <p className="notice notice--private"><Icon name="lock" size={16} />Only you can see your medicines.</p>
        <button type="button" className="btn btn-secondary btn-block" disabled={busy} onClick={stop}>
          <Icon name="archive" size={18} /> {busy ? 'Stopping…' : 'I’ve stopped taking this'}
        </button>
      </div>
    </BottomSheet>
  );
}
