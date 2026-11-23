// An invite link opened before signing in is remembered, so it survives sign-up,
// email confirmation and onboarding.
const KEY = 'dayorbit-pending-invite';

export function rememberInvite(token) {
  try { localStorage.setItem(KEY, token); } catch { /* ignore */ }
}
export function pendingInvite() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function forgetInvite() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
export function afterAuthPath(fallback = '/home') {
  const token = pendingInvite();
  return token ? `/join/${token}` : fallback;
}
