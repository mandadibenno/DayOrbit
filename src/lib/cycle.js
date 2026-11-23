// Cycle estimates from logged periods. These are estimates, not medical advice,
// and must never be presented as a way to prevent pregnancy.
import { addDays, diffDays, todayISO } from './dates.js';

export const PHASES = {
  period: { name: 'Period', color: '#C2305F', tint: '#FFE3EC', text: 'Logging your flow each day keeps your dates accurate.' },
  after: { name: 'After period', color: '#9B8CFF', tint: '#ECEBFF', text: 'Many people feel their energy pick up around now.' },
  fertile: { name: 'Fertile window · estimate', color: '#34C796', tint: '#DDF5EA', text: 'Worked out from your past cycles. Not reliable for preventing pregnancy.' },
  between: { name: 'Between periods', color: '#9B8CFF', tint: '#ECEBFF', text: 'Nothing to do. Log anything you notice.' },
  before: { name: 'Before period', color: '#FFB38A', tint: '#FFE8D6', text: 'Some people notice cramps or mood changes this week.' },
  late: { name: 'Period expected', color: '#B4510F', tint: '#FCEBDD', text: 'Your period is later than usual. Log it when it starts.' },
};

const byStart = (a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0);

/** Averages and regularity from the last 6 complete cycles. */
export function cycleStats(periods = [], settings = {}) {
  const typicalCycle = settings.typical_cycle || 28;
  const typicalPeriod = settings.typical_period || 5;
  const sorted = [...periods].sort(byStart);

  const lengths = [];
  for (let i = 1; i < sorted.length; i++) {
    const length = diffDays(sorted[i].start_date, sorted[i - 1].start_date);
    if (length >= 15 && length <= 60) lengths.push({ start: sorted[i - 1].start_date, length });
  }
  const recent = lengths.slice(-6);
  const avgCycle = recent.length ? Math.round(recent.reduce((s, l) => s + l.length, 0) / recent.length) : typicalCycle;

  const periodLengths = sorted
    .filter((p) => p.end_date)
    .map((p) => diffDays(p.end_date, p.start_date) + 1)
    .filter((l) => l >= 1 && l <= 14)
    .slice(-6);
  const avgPeriod = periodLengths.length
    ? Math.round(periodLengths.reduce((s, l) => s + l, 0) / periodLengths.length)
    : typicalPeriod;

  const variation = recent.length >= 2 ? Math.max(...recent.map((l) => Math.abs(l.length - avgCycle))) : null;
  return {
    avgCycle,
    avgPeriod: Math.min(avgPeriod, avgCycle - 1),
    lengths: recent,
    variation,
    regular: variation == null ? null : variation <= 3,
    hasHistory: recent.length > 0,
  };
}

/** Cycle-day boundaries of each phase for a given average cycle. */
export function phaseBounds(avgCycle, avgPeriod) {
  const ovulation = avgCycle - 14;
  const fertileStart = Math.max(avgPeriod + 1, ovulation - 5);
  const fertileEnd = Math.max(fertileStart, ovulation + 1);
  return { periodEnd: avgPeriod, fertileStart, fertileEnd, cycle: avgCycle };
}

export function phaseForDay(day, stats, showFertile = true) {
  const b = phaseBounds(stats.avgCycle, stats.avgPeriod);
  if (day <= b.periodEnd) return 'period';
  if (day < b.fertileStart) return 'after';
  if (day <= b.fertileEnd) return showFertile ? 'fertile' : 'between';
  return 'before';
}

/** Where today sits in the cycle. Returns null until a period is logged. */
export function cycleToday(periods = [], stats, { today = todayISO(), showFertile = true } = {}) {
  const past = periods.filter((p) => p.start_date <= today).sort(byStart);
  if (!past.length) return null;
  const last = past[past.length - 1];
  const day = diffDays(today, last.start_date) + 1;

  const ended = last.end_date && last.end_date < today;
  const inPeriod = !ended && (last.end_date ? today <= last.end_date : day <= stats.avgPeriod + 2);
  const openPeriod = !last.end_date && inPeriod ? last : null;

  const nextStart = addDays(last.start_date, stats.avgCycle);
  const daysUntil = diffDays(nextStart, today);
  const spread = Math.max(2, stats.variation ?? 2);
  const late = !inPeriod && daysUntil < 0;
  const b = phaseBounds(stats.avgCycle, stats.avgPeriod);

  let phase = inPeriod ? 'period' : late ? 'late' : phaseForDay(day, stats, showFertile);
  if (phase === 'period' && !inPeriod) phase = 'after';

  return {
    day,
    last,
    inPeriod,
    openPeriod,
    phase,
    late,
    lateBy: late ? -daysUntil : 0,
    nextStart,
    daysUntil,
    rangeStart: addDays(nextStart, -spread),
    rangeEnd: addDays(nextStart, spread),
    fertileStart: addDays(last.start_date, b.fertileStart - 1),
    fertileEnd: addDays(last.start_date, b.fertileEnd - 1),
    beforeStart: addDays(last.start_date, b.fertileEnd),
  };
}

/** Colouring for one calendar day. */
export function dayStatus(iso, periods = [], stats, { today = todayISO(), showFertile = true } = {}) {
  const sorted = [...periods].sort(byStart);
  const isPeriod = sorted.some((p) => {
    const end = p.end_date || (p.start_date <= today ? minISO(addDays(p.start_date, stats.avgPeriod - 1), today) : p.start_date);
    return iso >= p.start_date && iso <= end;
  });

  const anchor = [...sorted].reverse().find((p) => p.start_date <= iso);
  if (!anchor) return { isPeriod, isPredicted: false, isFertile: false, cycleDay: null };

  const latest = sorted[sorted.length - 1];
  let cycleDay = diffDays(iso, anchor.start_date) + 1;
  let isPredicted = false;
  const future = iso > today && anchor === latest;
  if (future) {
    const since = diffDays(iso, latest.start_date);
    cycleDay = (since % stats.avgCycle) + 1;
    isPredicted = since >= stats.avgCycle && cycleDay <= stats.avgPeriod && !isPeriod;
  }
  const b = phaseBounds(stats.avgCycle, stats.avgPeriod);
  const isFertile = showFertile && !isPeriod && !isPredicted && cycleDay >= b.fertileStart && cycleDay <= b.fertileEnd
    && (anchor === latest || cycleDay <= diffDays(nextStartAfter(sorted, anchor), anchor.start_date));
  return { isPeriod, isPredicted, isFertile, cycleDay };
}

function nextStartAfter(sorted, anchor) {
  const idx = sorted.indexOf(anchor);
  return sorted[idx + 1]?.start_date || addDays(anchor.start_date, 60);
}

const minISO = (a, b) => (a < b ? a : b);

/** Symptoms that show up most, with the cycle days they usually appear on. */
export function symptomPatterns(logs = [], periods = [], labels = {}) {
  const sorted = [...periods].sort(byStart);
  const counts = new Map();
  for (const log of logs) {
    const anchor = [...sorted].reverse().find((p) => p.start_date <= log.log_date);
    if (!anchor) continue;
    const day = diffDays(log.log_date, anchor.start_date) + 1;
    for (const s of log.body || []) {
      if (!counts.has(s)) counts.set(s, []);
      counts.get(s).push(day);
    }
  }
  return [...counts.entries()]
    .filter(([, days]) => days.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([key, days]) => {
      const lo = Math.min(...days);
      const hi = Math.max(...days);
      return { key, label: labels[key] || key, count: days.length, when: lo === hi ? `usually day ${lo}` : `usually days ${lo}–${hi}` };
    });
}
