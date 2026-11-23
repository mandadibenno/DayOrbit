// Shared pieces for the cycle tracker. Estimates only — never medical advice or contraception.
import { useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { PHASES } from '../../lib/cycle.js';

export const FLOWS = [
  { id: 'none', label: 'None', drops: 0 },
  { id: 'spotting', label: 'Spotting', drops: 1, small: true },
  { id: 'light', label: 'Light', drops: 1 },
  { id: 'medium', label: 'Medium', drops: 2 },
  { id: 'heavy', label: 'Heavy', drops: 3 },
];
export const FEELINGS = [
  { id: 'calm', label: 'Calm' },
  { id: 'happy', label: 'Happy' },
  { id: 'tired', label: 'Tired' },
  { id: 'low', label: 'Low' },
  { id: 'irritable', label: 'Irritable' },
  { id: 'anxious', label: 'Anxious' },
];
export const BODY = [
  { id: 'cramps', label: 'Cramps' },
  { id: 'headache', label: 'Headache' },
  { id: 'bloating', label: 'Bloating' },
  { id: 'back', label: 'Back pain' },
  { id: 'skin', label: 'Breakouts' },
  { id: 'cravings', label: 'Cravings' },
];
export const LABELS = Object.fromEntries([...FLOWS, ...FEELINGS, ...BODY].map((x) => [x.id, x.label]));

export const DISCLAIMER = 'Dates are estimates from your past cycles. They aren’t medical advice and can’t be used to prevent pregnancy.';

export function FlowDrops({ drops, small }) {
  return (
    <span className="flow-btn__drops" aria-hidden="true">
      {drops === 0 && <span style={{ width: 14, height: 2, background: 'currentColor', borderRadius: 1, alignSelf: 'center', opacity: 0.6 }} />}
      {Array.from({ length: drops }, (_, i) => (
        <svg key={i} width={small ? 8 : 11} height={small ? 10 : 14} viewBox="0 0 11 14"><path d="M5.5 0C5.5 0 0 6.2 0 9a5.5 5.5 0 0 0 11 0C11 6.2 5.5 0 5.5 0z" fill="currentColor" /></svg>
      ))}
    </span>
  );
}

/** One line describing a saved log, e.g. "Medium flow · Cramps, Bloating · Tired". */
export function logSummary(log) {
  if (!log) return '';
  const parts = [];
  if (log.flow && log.flow !== 'none') parts.push(`${LABELS[log.flow]} flow`);
  if (log.body?.length) parts.push(log.body.map((b) => LABELS[b] || b).join(', '));
  if (log.feelings?.length) parts.push(log.feelings.map((f) => LABELS[f] || f).join(', '));
  if (log.note) parts.push(`“${log.note}”`);
  return parts.join(' · ');
}

export function hasLog(log) {
  return !!log && ((log.flow && log.flow !== 'none') || log.feelings?.length || log.body?.length || log.note);
}

export function PhaseLegend({ showFertile = true }) {
  const items = [
    ['Period', PHASES.period.color],
    ['After period', PHASES.after.color],
    ...(showFertile ? [['Fertile window (estimate)', PHASES.fertile.color]] : []),
    ['Before period', PHASES.before.color],
  ];
  return (
    <ul className="legend" style={{ justifyContent: 'center' }}>
      {items.map(([label, color]) => <li key={label}><i style={{ background: color }} />{label}</li>)}
    </ul>
  );
}

/** Flow, feelings, body and a note for one day. Everything optional. */
export function LogForm({ initial, onSave, busy, saveLabel = 'Save' }) {
  const [log, setLog] = useState(() => normal(initial));
  useEffect(() => { setLog(normal(initial)); }, [initial]);
  const toggle = (key, id) => setLog((l) => ({ ...l, [key]: l[key].includes(id) ? l[key].filter((x) => x !== id) : [...l[key], id] }));

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); onSave(log); }}>
      <div>
        <p className="label">Flow</p>
        <div className="flow-grid" role="radiogroup" aria-label="Flow">
          {FLOWS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={log.flow === f.id} className="flow-btn" onClick={() => setLog((l) => ({ ...l, flow: l.flow === f.id ? null : f.id }))}>
              <FlowDrops drops={f.drops} small={f.small} />
              <span className="tiny bold">{f.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="label">Feelings</p>
        <div className="chips">
          {FEELINGS.map((c) => (
            <button key={c.id} type="button" className="chip chip--sm" aria-pressed={log.feelings.includes(c.id)} onClick={() => toggle('feelings', c.id)}>
              {log.feelings.includes(c.id) && <Icon name="check" size={14} stroke={3} />}{c.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="label">Body</p>
        <div className="chips">
          {BODY.map((c) => (
            <button key={c.id} type="button" className="chip chip--sm" aria-pressed={log.body.includes(c.id)} onClick={() => toggle('body', c.id)}>
              {log.body.includes(c.id) && <Icon name="check" size={14} stroke={3} />}{c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="log-note">Note <span className="muted">(only you see it)</span></label>
        <textarea id="log-note" className="textarea" rows={2} maxLength={500} value={log.note} onChange={(e) => setLog((l) => ({ ...l, note: e.target.value }))} />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving…' : saveLabel}</button>
    </form>
  );
}

function normal(log) {
  return { flow: log?.flow ?? null, feelings: log?.feelings || [], body: log?.body || [], note: log?.note || '' };
}
