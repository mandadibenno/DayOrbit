// Small shared pieces for the Money screens.
import Icon from '../../components/Icon.jsx';
import { formatINR } from '../../lib/money.js';
import { computeBalances } from '../../lib/split.js';

export const SPLIT_CATEGORIES = ['Food & drink', 'Stay', 'Transport', 'Fun', 'Groceries', 'Shopping', 'Other'];

const BY_CATEGORY = {
  Groceries: ['cart', 'butter'],
  'Food & drink': ['food', 'peach'],
  Transport: ['car', 'sky'],
  Utilities: ['bolt', 'lavender'],
  Home: ['home', 'mint'],
  Stay: ['home', 'mint'],
  Health: ['pill', 'blush'],
  Shopping: ['bag', 'butter'],
  Fun: ['star', 'lavender'],
  Other: ['receipt', 'sky'],
};
const BY_TITLE = [
  [/hotel|villa|stay|room|airbnb|hostel|\brent\b|homestay/i, 'home', 'mint'],
  [/cab|taxi|uber|ola|auto|fuel|petrol|train|flight|bus|scooter|bike|metro|parking|toll/i, 'car', 'sky'],
  [/dinner|lunch|breakfast|food|restaurant|cafe|coffee|snack|drinks|beer|pizza|biryani|seafood|shack/i, 'food', 'peach'],
  [/grocer|supermarket|vegetable|fruit|milk/i, 'cart', 'butter'],
  [/cake|gift|party|decor|balloon/i, 'gift', 'blush'],
  [/ticket|movie|show|concert|game|entry|activity|parasail|boat|cruise/i, 'star', 'lavender'],
  [/electric|power|water|wifi|internet|gas|mobile|recharge/i, 'bolt', 'lavender'],
  [/medicine|pharmacy|doctor|clinic/i, 'pill', 'blush'],
];

export function costLook(title = '', category = null) {
  if (category && BY_CATEGORY[category]) return BY_CATEGORY[category];
  const hit = BY_TITLE.find(([re]) => re.test(title));
  return hit ? [hit[1], hit[2]] : ['receipt', 'sky'];
}

export function CostIcon({ title, category, size = 19 }) {
  const [icon, tone] = costLook(title, category);
  return <span className={`icon-tile bg-${tone} ink-${tone}`} aria-hidden="true"><Icon name={icon} size={size} /></span>;
}

const GET = { background: 'var(--ok-tint)', color: 'var(--ok-ink)' };
const OWE = { background: 'var(--owe-tint)', color: 'var(--owe-ink)' };

/** "You get back ₹8,140" / "You owe ₹2,360" / "Settled" as a coloured badge. */
export function BalanceBadge({ net, you = true }) {
  if (net > 0) return <span className="badge tabular" style={GET}>{you ? 'You get back' : 'Gets back'} {formatINR(net)}</span>;
  if (net < 0) return <span className="badge tabular" style={OWE}>{you ? 'You owe' : 'Owes'} {formatINR(-net)}</span>;
  return <span className="badge badge--neutral"><Icon name="check" size={12} stroke={3} /> Settled</span>;
}

export const netColor = (net) => (net > 0 ? 'var(--get)' : net < 0 ? 'var(--owe)' : 'var(--ink-2)');

/** One trip or event (or the "Older costs" bucket) out of everything loaded for a space. */
export function pickGroup(split, groupId) {
  const legacy = groupId === 'older';
  const expenses = split.expenses.filter((e) => (legacy ? !e.group_id : e.group_id === groupId));
  const settlements = split.settlements.filter((s) => (legacy ? !s.group_id : s.group_id === groupId));
  const group = legacy
    ? (expenses.length || settlements.length ? { id: 'older', name: 'Older costs', kind: 'legacy' } : null)
    : split.groups.find((g) => g.id === groupId) || null;
  const total = expenses.reduce((sum, e) => sum + Number(e.amount_minor), 0);
  return { group, legacy, expenses, settlements, total, balances: computeBalances(expenses, settlements) };
}

export const METHOD_WORDS = {
  equal: 'Split equally',
  exact: 'Split by exact amounts',
  percent: 'Split by percentage',
  shares: 'Split by shares',
};
