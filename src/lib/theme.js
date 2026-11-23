// Theme preference: 'system' | 'light' | 'dark'. The resolved value goes on <html data-theme>.
const KEY = 'dayorbit-theme';

export function storedTheme() {
  try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; }
}

export function resolveTheme(pref) {
  if (pref === 'light' || pref === 'dark') return pref;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(pref = storedTheme()) {
  try { localStorage.setItem(KEY, pref); } catch { /* ignore */ }
  const resolved = resolveTheme(pref);
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0F1115' : '#F4F5F9');
}

export function watchSystemTheme() {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener?.('change', () => { if (storedTheme() === 'system') applyTheme('system'); });
}
