// Split Bills maths. This mirrors public.split_allocate / public.split_compute in the database,
// so the preview a person sees is exactly what the server stores — to the paisa.
import { parseRupees, formatINR } from './money.js';

export const SPLIT_METHODS = [
  { id: 'equal', label: 'Equally', help: 'Everyone pays the same' },
  { id: 'exact', label: 'Exact amounts', help: 'Type how much each person pays' },
  { id: 'percent', label: 'By percentage', help: 'Must add up to 100%' },
  { id: 'shares', label: 'By shares', help: 'e.g. 2 : 1 — one person pays double' },
];

/**
 * Largest-remainder allocation in integer paise.
 * Floor every share, then give the leftover paise one at a time to the biggest
 * remainders (ties go to the earlier person). The result always sums to the total.
 */
export function largestRemainder(totalMinor, weights) {
  if (!weights.length) throw new Error('no_participants');
  const total = BigInt(totalMinor);
  const w = weights.map((x) => BigInt(x));
  const sum = w.reduce((a, b) => a + b, 0n);
  if (sum <= 0n || w.some((x) => x < 0n)) throw new Error('invalid_weight');

  const shares = [];
  const remainders = [];
  let allocated = 0n;
  w.forEach((wi, i) => {
    const product = total * wi;
    const q = product / sum; // BigInt division floors for non-negative numbers
    shares.push(q);
    remainders.push({ i, r: product % sum });
    allocated += q;
  });

  const leftover = Number(total - allocated);
  remainders.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (let k = 0; k < leftover; k++) shares[remainders[k].i] += 1n;
  return shares.map(Number);
}

/** "33.33" → 3333 basis points (max two decimals). NaN if invalid. */
export function percentToBasisPoints(value) {
  const text = String(value ?? '').trim().replace('%', '');
  if (!/^\d+(\.\d{0,2})?$/.test(text)) return NaN;
  const [whole, frac = ''] = text.split('.');
  return Number(whole) * 100 + Number((frac + '00').slice(0, 2));
}

/**
 * Work out each participant's share.
 * rawInputs is aligned with the participants: ignored for 'equal', whole numbers for
 * 'shares', percentages for 'percent', rupee strings for 'exact'.
 * Returns { ok, shares, inputs (what to send to the server), error?, ...details }.
 */
export function computeSplit(totalMinor, method, rawInputs = []) {
  const n = rawInputs.length;
  const zeros = Array(n).fill(0);
  if (!Number.isInteger(totalMinor) || totalMinor <= 0) return { ok: false, error: 'invalid_amount', shares: zeros };
  if (n === 0) return { ok: false, error: 'no_participants', shares: [] };

  if (method === 'equal') {
    return { ok: true, shares: largestRemainder(totalMinor, Array(n).fill(1)), inputs: null };
  }

  if (method === 'shares') {
    const w = rawInputs.map((v) => Number(v));
    if (w.some((x) => !Number.isInteger(x) || x < 1 || x > 999)) return { ok: false, error: 'shares_invalid', shares: zeros };
    return { ok: true, shares: largestRemainder(totalMinor, w), inputs: w };
  }

  if (method === 'percent') {
    const bp = rawInputs.map(percentToBasisPoints);
    if (bp.some(Number.isNaN)) return { ok: false, error: 'percent_invalid', shares: zeros };
    const sumBp = bp.reduce((a, b) => a + b, 0);
    const preview = bp.map((b) => Math.floor((totalMinor * b) / 10000));
    if (sumBp !== 10000) return { ok: false, error: 'percent_sum', sumBp, shares: preview };
    return { ok: true, shares: largestRemainder(totalMinor, bp), inputs: bp.map((b) => b / 100) };
  }

  if (method === 'exact') {
    const values = rawInputs.map(parseRupees);
    if (values.some(Number.isNaN)) {
      return { ok: false, error: 'exact_invalid', shares: values.map((x) => (Number.isNaN(x) ? 0 : x)) };
    }
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum !== totalMinor) return { ok: false, error: 'exact_sum', diff: totalMinor - sum, shares: values };
    return { ok: true, shares: values, inputs: values };
  }

  return { ok: false, error: 'invalid_method', shares: zeros };
}

/** Plain-language status for the split preview. */
export function splitStatusText(result, totalMinor) {
  if (result.ok) return `Adds up to ${formatINR(totalMinor, { decimals: true })}.`;
  switch (result.error) {
    case 'invalid_amount': return 'Type an amount above ₹0.';
    case 'no_participants': return 'Tick at least one person.';
    case 'shares_invalid': return 'Shares must be whole numbers, 1 or more.';
    case 'percent_invalid': return 'Use numbers like 25 or 12.5.';
    case 'exact_invalid': return 'Use amounts like 250 or 250.50.';
    case 'percent_sum': {
      const diff = 10000 - result.sumBp;
      const pct = (v) => `${(Math.abs(v) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
      return `Adds up to ${pct(result.sumBp)} — ${diff > 0 ? `${pct(diff)} still to give out` : `${pct(diff)} too much`}.`;
    }
    case 'exact_sum':
      return result.diff > 0
        ? `${formatINR(result.diff, { decimals: true })} still needs someone to pay it.`
        : `That's ${formatINR(-result.diff, { decimals: true })} more than the total.`;
    default: return 'Check the split.';
  }
}

/**
 * Balances per person: paid − share + sent − received.
 * Positive net = gets money back. expenses: [{ paid_by, amount_minor, allocations: [{ user_id, share_minor }] }]
 */
export function computeBalances(expenses = [], settlements = []) {
  const balances = new Map();
  const get = (id) => {
    if (!balances.has(id)) balances.set(id, { paid: 0, share: 0, sent: 0, received: 0, net: 0 });
    return balances.get(id);
  };
  for (const e of expenses) {
    get(e.paid_by).paid += Number(e.amount_minor);
    for (const a of e.allocations || []) get(a.user_id).share += Number(a.share_minor);
  }
  for (const s of settlements) {
    get(s.from_user).sent += Number(s.amount_minor);
    get(s.to_user).received += Number(s.amount_minor);
  }
  for (const v of balances.values()) v.net = v.paid - v.share + v.sent - v.received;
  return balances;
}

/** Few payments that settle everything. Preserves every net balance exactly. */
export function suggestTransfers(balances) {
  const debtors = [];
  const creditors = [];
  for (const [id, v] of balances) {
    if (v.net < 0) debtors.push({ id, amount: -v.net });
    else if (v.net > 0) creditors.push({ id, amount: v.net });
  }
  const bySize = (a, b) => b.amount - a.amount || (a.id < b.id ? -1 : 1);
  debtors.sort(bySize);
  creditors.sort(bySize);

  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0) transfers.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount === 0) i += 1;
    if (creditors[j].amount === 0) j += 1;
  }
  return transfers;
}

/** Attach allocation rows to their expenses. */
export function withAllocations(expenses, allocations) {
  const byExpense = new Map();
  for (const a of allocations) {
    if (!byExpense.has(a.expense_id)) byExpense.set(a.expense_id, []);
    byExpense.get(a.expense_id).push(a);
  }
  return expenses.map((e) => ({ ...e, allocations: byExpense.get(e.id) || [] }));
}
