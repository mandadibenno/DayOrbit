import { phaseBounds } from '../lib/cycle.js';

const R = 96;
const C = 2 * Math.PI * R;
const GAP = 3;

/** Ring of the whole cycle, coloured by phase, with a marker on today. */
export default function CycleRing({ day, avgCycle, avgPeriod, showFertile = true, mini = false, label, children }) {
  const b = phaseBounds(avgCycle, avgPeriod);
  const perDay = C / avgCycle;
  const segments = [
    { from: 1, to: b.periodEnd, color: '#C2305F' },
    { from: b.periodEnd + 1, to: b.fertileStart - 1, color: '#9B8CFF' },
    { from: b.fertileStart, to: b.fertileEnd, color: showFertile ? '#34C796' : '#9B8CFF' },
    { from: b.fertileEnd + 1, to: avgCycle, color: '#FFB38A' },
  ].filter((s) => s.to >= s.from);

  const markerDay = Math.min(Math.max(day || 1, 1), avgCycle);
  const angle = ((markerDay - 0.5) / avgCycle) * 2 * Math.PI - Math.PI / 2;
  const mx = 120 + R * Math.cos(angle);
  const my = 120 + R * Math.sin(angle);
  const width = mini ? 24 : 22;

  return (
    <div className={`ring ${mini ? 'ring--mini' : ''}`}>
      <svg viewBox="0 0 240 240" role="img" aria-label={label}>
        <circle cx="120" cy="120" r={R} fill="none" stroke="var(--line-soft)" strokeWidth={width} />
        <g transform="rotate(-90 120 120)">
          {segments.map((s) => {
            const start = (s.from - 1) * perDay;
            const len = (s.to - s.from + 1) * perDay;
            const dash = Math.max(len - GAP, 0.1);
            return (
              <circle
                key={s.from}
                cx="120" cy="120" r={R} fill="none" stroke={s.color} strokeWidth={width}
                strokeDasharray={`${dash.toFixed(2)} ${(C - dash).toFixed(2)}`}
                strokeDashoffset={(-(start + GAP / 2)).toFixed(2)}
              />
            );
          })}
        </g>
        {day != null && (
          <>
            <circle cx={mx} cy={my} r={mini ? 17 : 15} fill="var(--surface)" stroke="var(--ink)" strokeWidth={mini ? 6 : 4} style={{ transition: 'cx .5s, cy .5s' }} />
            {!mini && <circle cx={mx} cy={my} r="5" fill="var(--ink)" />}
          </>
        )}
      </svg>
      <div className="ring__center">{children}</div>
    </div>
  );
}
