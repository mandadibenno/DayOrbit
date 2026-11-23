// Money is always integer paise (₹1 = 100 paise). Never floats.

const withPaise = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeRupees = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/**
 * formatINR(150000) → "₹1,500"   formatINR(21429) → "₹214.29"
 * decimals: 'auto' (only when needed) | true (always) | false (never)
 */
export function formatINR(minor, { decimals = 'auto', sign = false } = {}) {
  const value = Number(minor) || 0;
  const abs = Math.abs(value);
  const showPaise = decimals === true || (decimals === 'auto' && abs % 100 !== 0);
  const body = showPaise ? withPaise.format(abs / 100) : wholeRupees.format(Math.round(abs / 100));
  let prefix = '';
  if (value < 0) prefix = sign ? '−' : '-';
  else if (sign && value > 0) prefix = '+';
  return `${prefix}₹${body}`;
}

/** "1,500.5" → 150050 paise. Returns NaN for anything that isn't a valid amount. */
export function parseRupees(input) {
  const text = String(input ?? '').replace(/[,\s₹]/g, '');
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(text)) return NaN;
  const [whole, frac = ''] = text.split('.');
  return Number(whole || 0) * 100 + Number((frac + '00').slice(0, 2));
}

/** 150050 → "1500.50", 150000 → "1500" (for pre-filling inputs). */
export function toRupeeInput(minor) {
  if (minor == null || Number.isNaN(minor)) return '';
  const whole = Math.trunc(minor / 100);
  const paise = Math.abs(minor % 100);
  return paise ? `${whole}.${String(paise).padStart(2, '0')}` : String(whole);
}
