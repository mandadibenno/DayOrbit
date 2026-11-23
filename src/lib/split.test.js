// Same vectors as supabase/tests/10_backend_test.sql — app and database must agree to the paisa.
import { describe, expect, it } from 'vitest';
import { largestRemainder, computeSplit, computeBalances, suggestTransfers, withAllocations } from './split.js';
import { formatINR, parseRupees, toRupeeInput } from './money.js';

describe('largestRemainder', () => {
  it('splits ₹1,500 three ways', () => expect(largestRemainder(150000, [1, 1, 1])).toEqual([50000, 50000, 50000]));
  it('rounds to the paisa and still adds up (₹1,500 / 7)', () => {
    const shares = largestRemainder(150000, Array(7).fill(1));
    expect(shares).toEqual([21429, 21429, 21429, 21429, 21428, 21428, 21428]);
    expect(shares.reduce((a, b) => a + b)).toBe(150000);
  });
  it('₹10 / 3 gives the extra paisa to the first person', () => expect(largestRemainder(1000, [1, 1, 1])).toEqual([334, 333, 333]));
  it('shares 2:1:1 on ₹900', () => expect(largestRemainder(90000, [2, 1, 1])).toEqual([45000, 22500, 22500]));
  it('handles big amounts exactly', () => {
    const shares = largestRemainder(999999999999, [3333, 3333, 3334]);
    expect(shares.reduce((a, b) => a + b)).toBe(999999999999);
  });
  it('rejects no participants', () => expect(() => largestRemainder(100, [])).toThrow('no_participants'));
});

describe('computeSplit', () => {
  it('percent 50/30/20 of ₹2,000', () => {
    const r = computeSplit(200000, 'percent', ['50', '30', '20']);
    expect(r).toMatchObject({ ok: true, shares: [100000, 60000, 40000], inputs: [50, 30, 20] });
  });
  it('percent with decimals', () => expect(computeSplit(100000, 'percent', ['33.33', '33.33', '33.34']).shares).toEqual([33330, 33330, 33340]));
  it('percent must reach 100', () => expect(computeSplit(200000, 'percent', ['50', '30', '10'])).toMatchObject({ ok: false, error: 'percent_sum', sumBp: 9000 }));
  it('exact must add up', () => {
    expect(computeSplit(90000, 'exact', ['400', '300', '200'])).toMatchObject({ ok: true, shares: [40000, 30000, 20000] });
    expect(computeSplit(90000, 'exact', ['400', '300', '100'])).toMatchObject({ ok: false, error: 'exact_sum', diff: 10000 });
  });
  it('shares must be whole numbers ≥ 1', () => expect(computeSplit(90000, 'shares', [2, 0, 1])).toMatchObject({ ok: false, error: 'shares_invalid' }));
  it('needs an amount and people', () => {
    expect(computeSplit(0, 'equal', [null])).toMatchObject({ ok: false, error: 'invalid_amount' });
    expect(computeSplit(100, 'equal', [])).toMatchObject({ ok: false, error: 'no_participants' });
  });
});

describe('balances (Goa Trip fixture)', () => {
  const [A, D, K, M, R] = ['a', 'd', 'k', 'm', 'r'];
  const exp = (id, paid_by, amount_minor, people) => ({
    id, paid_by, amount_minor,
    allocations: largestRemainder(amount_minor, people.map(() => 1)).map((share_minor, i) => ({ user_id: people[i], share_minor })),
  });
  const expenses = [
    exp(1, A, 1200000, [A, D, K, M, R]),
    exp(2, D, 150000, [A, D, K]), // only three ate — Meera and Rohan owe nothing for this
    exp(3, K, 240000, [A, D, K, M]),
    exp(4, M, 180000, [A, D, K, M, R]),
  ];

  it('nets match the database test', () => {
    const b = computeBalances(expenses, []);
    expect(b.get(A).net).toBe(814000);
    expect(b.get(D).net).toBe(-236000);
    expect(b.get(K).net).toBe(-146000);
    expect(b.get(M).net).toBe(-156000);
    expect(b.get(R).net).toBe(-276000);
  });

  it('a partial payment leaves the rest owed', () => {
    const b = computeBalances(expenses, [{ from_user: R, to_user: A, amount_minor: 200000 }]);
    expect(b.get(R).net).toBe(-76000);
  });

  it('owes ₹700, pays ₹500 → ₹200 left', () => {
    const b = computeBalances([exp(9, A, 140000, [A, D])], [{ from_user: D, to_user: A, amount_minor: 50000 }]);
    expect(b.get(D).net).toBe(-20000);
  });

  it('suggested payments settle everything exactly', () => {
    const b = computeBalances(expenses, []);
    const t = suggestTransfers(b);
    expect(t).toHaveLength(4);
    const after = new Map([...b].map(([id, v]) => [id, v.net]));
    for (const { from, to, amount } of t) {
      after.set(from, after.get(from) + amount);
      after.set(to, after.get(to) - amount);
    }
    expect([...after.values()].every((v) => v === 0)).toBe(true);
  });

  it('withAllocations attaches rows', () => {
    const rows = withAllocations([{ id: 'x' }], [{ expense_id: 'x', user_id: A, share_minor: 1 }]);
    expect(rows[0].allocations).toHaveLength(1);
  });
});

describe('money', () => {
  it('formats rupees the Indian way', () => {
    expect(formatINR(150000)).toBe('₹1,500');
    expect(formatINR(21429)).toBe('₹214.29');
    expect(formatINR(10000000)).toBe('₹1,00,000');
    expect(formatINR(150000, { decimals: true })).toBe('₹1,500.00');
    expect(formatINR(-76000, { sign: true })).toBe('−₹760');
  });
  it('parses amounts safely', () => {
    expect(parseRupees('1,500')).toBe(150000);
    expect(parseRupees('₹ 250.5')).toBe(25050);
    expect(parseRupees('.5')).toBe(50);
    expect(parseRupees('25o')).toBeNaN();
    expect(parseRupees('1.234')).toBeNaN();
    expect(toRupeeInput(150050)).toBe('1500.50');
  });
});
