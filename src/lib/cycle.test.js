import { describe, expect, it } from 'vitest';
import { cycleStats, cycleToday, dayStatus, phaseBounds, symptomPatterns } from './cycle.js';

const periods = [
  { start_date: '2026-09-17', end_date: '2026-09-21' },
  { start_date: '2026-10-15', end_date: '2026-10-19' },
  { start_date: '2026-11-12', end_date: '2026-11-16' },
];

describe('cycleStats', () => {
  it('averages cycle and period length', () => {
    const s = cycleStats(periods, {});
    expect(s.avgCycle).toBe(28);
    expect(s.avgPeriod).toBe(5);
    expect(s.regular).toBe(true);
  });
  it('falls back to typical values with no history', () => {
    const s = cycleStats([{ start_date: '2026-11-12' }], { typical_cycle: 30, typical_period: 4 });
    expect(s).toMatchObject({ avgCycle: 30, avgPeriod: 4, hasHistory: false });
  });
});

describe('cycleToday', () => {
  const stats = cycleStats(periods, {});
  it('day 12 is in the fertile window estimate; next period ~10 Dec', () => {
    const t = cycleToday(periods, stats, { today: '2026-11-23' });
    expect(t).toMatchObject({ day: 12, phase: 'fertile', nextStart: '2026-12-10', daysUntil: 17, inPeriod: false });
    expect(t.rangeStart).toBe('2026-12-08');
    expect(t.rangeEnd).toBe('2026-12-12');
  });
  it('can hide the fertile window', () => {
    expect(cycleToday(periods, stats, { today: '2026-11-23', showFertile: false }).phase).toBe('between');
  });
  it('knows when a period is late', () => {
    const t = cycleToday(periods, stats, { today: '2026-12-14' });
    expect(t).toMatchObject({ late: true, lateBy: 4, phase: 'late' });
  });
  it('an open period counts as "in period"', () => {
    const open = [...periods.slice(0, 2), { start_date: '2026-11-12', end_date: null }];
    expect(cycleToday(open, stats, { today: '2026-11-13' })).toMatchObject({ day: 2, inPeriod: true, phase: 'period' });
  });
  it('returns null before anything is logged', () => expect(cycleToday([], stats)).toBeNull());
});

describe('dayStatus', () => {
  const stats = cycleStats(periods, {});
  const opts = { today: '2026-11-23' };
  it('marks logged period days', () => expect(dayStatus('2026-11-14', periods, stats, opts).isPeriod).toBe(true));
  it('marks the fertile estimate', () => expect(dayStatus('2026-11-22', periods, stats, opts).isFertile).toBe(true));
  it('predicts the next period', () => {
    expect(dayStatus('2026-12-11', periods, stats, opts)).toMatchObject({ isPredicted: true, isPeriod: false });
    expect(dayStatus('2026-12-20', periods, stats, opts).isPredicted).toBe(false);
  });
  it('phase bounds for a 28-day cycle', () => expect(phaseBounds(28, 5)).toEqual({ periodEnd: 5, fertileStart: 9, fertileEnd: 15, cycle: 28 }));
});

describe('symptomPatterns', () => {
  it('finds repeated symptoms and their usual days', () => {
    const logs = [
      { log_date: '2026-10-15', body: ['cramps'] },
      { log_date: '2026-10-16', body: ['cramps'] },
      { log_date: '2026-11-12', body: ['cramps', 'headache'] },
    ];
    expect(symptomPatterns(logs, periods, { cramps: 'Cramps' })).toEqual([{ key: 'cramps', label: 'Cramps', count: 3, when: 'usually days 1–2' }]);
  });
});
