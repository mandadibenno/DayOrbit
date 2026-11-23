// Calendar dates are plain "YYYY-MM-DD" strings in the user's local time zone.

const pad = (n) => String(n).padStart(2, '0');

export function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseISO(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = () => toISO(new Date());

export function addDays(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function addMonths(iso, months) {
  const d = parseISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}

/** Whole days from b to a (a - b). Rounding keeps it correct across DST changes. */
export function diffDays(a, b) {
  return Math.round((parseISO(a) - parseISO(b)) / 86400000);
}

export const startOfMonth = (iso) => `${String(iso).slice(0, 7)}-01`;
export const endOfMonth = (iso) => addDays(addMonths(startOfMonth(iso), 1), -1);

const fmt = (iso, options) => new Intl.DateTimeFormat('en-GB', options).format(parseISO(iso));
export const formatDay = (iso) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' }); // Mon 23 Nov
export const formatShort = (iso) => fmt(iso, { day: 'numeric', month: 'short' }); // 23 Nov
export const formatLong = (iso) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' }); // Monday, 23 November
export const monthLabel = (iso) => fmt(iso, { month: 'long', year: 'numeric' }); // November 2026
export const monthShort = (iso) => fmt(iso, { month: 'short' }).toUpperCase(); // NOV
export const weekdayShort = (iso) => fmt(iso, { weekday: 'short' }); // Mon

export function formatRange(start, end) {
  if (!start) return '';
  if (!end || end === start) return formatShort(start);
  const s = parseISO(start);
  const e = parseISO(end);
  if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${formatShort(end)}`;
  return `${formatShort(start)} – ${formatShort(end)}`;
}

/** "Today", "Tomorrow", "Yesterday" or "Mon 23 Nov". */
export function relativeDay(iso, today = todayISO()) {
  const d = diffDays(iso, today);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  return formatDay(iso);
}

/** Label for a due date, plus whether it's late. */
export function dueLabel(iso, today = todayISO()) {
  if (!iso) return { text: '', late: false };
  const d = diffDays(iso, today);
  if (d < 0) return { text: d === -1 ? 'Overdue since yesterday' : `Overdue by ${-d} days`, late: true };
  if (d === 0) return { text: 'Due today', late: false };
  if (d === 1) return { text: 'Due tomorrow', late: false };
  if (d < 7) return { text: `Due ${weekdayShort(iso)}`, late: false };
  return { text: `Due ${formatShort(iso)}`, late: false };
}

/** "14:00" → "2:00 PM" */
export function formatTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${pad(m || 0)} ${suffix}`;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
