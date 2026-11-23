// Turn backend errors into plain, helpful sentences. Raw SQL/RPC text is never shown.
const MESSAGES = {
  not_authenticated: 'Please sign in again.',
  not_member: "You're not a member of this space any more.",
  not_owner: 'Only the owner of this space can do that.',
  not_allowed: 'Only the person who added it, the person who paid, or the owner can change this.',
  personal_space_is_private: 'My Space is just for you. Create a shared space to invite people.',
  personal_space_exists: 'You already have a My Space.',
  cannot_remove_self: "You can't remove yourself. Leave the space instead.",
  cannot_leave_personal: "My Space is yours, so it can't be left.",
  cannot_delete_personal: "My Space can't be deleted.",
  transfer_ownership_first: 'Make someone else the owner before you leave.',
  delete_instead: "You're the only member. Delete the space instead of leaving it.",
  name_mismatch: "The name doesn't match. Type the space name exactly.",
  couple_full: 'A couple space has room for two people.',
  health_personal_only: 'Health stays in My Space.',
  split_needs_shared_space: 'Split costs in a shared space, not in My Space.',
  invalid_amount: 'Type an amount above ₹0.',
  no_participants: 'Tick at least one person who shared this.',
  duplicate_participant: 'Someone is listed twice.',
  payer_not_member: 'The person who paid is no longer in this space.',
  participant_not_member: 'Everyone sharing must be in this space.',
  group_not_in_space: 'That trip belongs to another space.',
  percent_sum: 'Percentages must add up to 100%.',
  exact_sum: 'The amounts must add up to the total.',
  shares_invalid: 'Shares must be whole numbers, 1 or more.',
  percent_invalid: 'Use percentages like 25 or 12.5.',
  exact_invalid: 'Use amounts like 250 or 250.50.',
  inputs_mismatch: 'Something went wrong with the split. Please try again.',
  counts_changed: 'Something changed since you looked. Check the numbers and try again.',
  not_shared: 'This person is no longer sharing with you.',
  couple_space_only: 'Cycle sharing works inside a couple space.',
};

const KEYS = Object.keys(MESSAGES).sort((a, b) => b.length - a.length);

export function friendlyError(error) {
  if (!error) return 'Something went wrong. Please try again.';
  const text = String(error.message || error);
  const key = KEYS.find((k) => text.includes(k));
  if (key) return MESSAGES[key];
  if (/Invalid login credentials/i.test(text)) return "That email and password don't match. Try again or reset your password.";
  if (/Email not confirmed/i.test(text)) return 'Please confirm your email first — check your inbox.';
  if (/already registered|already been registered/i.test(text)) return 'An account with this email already exists. Try signing in.';
  if (/Password should be|weak password/i.test(text)) return 'Use at least 8 characters for your password.';
  if (/rate limit|too many/i.test(text)) return 'Too many tries. Please wait a minute and try again.';
  if (/Failed to fetch|NetworkError|network|timed out/i.test(text)) return "Couldn't connect. Check your internet and try again.";
  if (error.code === '42501' || /row-level security|permission denied/i.test(text)) return "You don't have access to this any more.";
  if (error.code === '23505') return 'That already exists.';
  if (error.code === '23514') return 'Something in the form is too long or not allowed.';
  return 'Something went wrong. Please try again.';
}
