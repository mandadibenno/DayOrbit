// Everything the screens need, in plain words. Works the same on Supabase and in demo mode.
import { backend } from './backend/index.js';
import { addDays, addMonths, todayISO } from './dates.js';
import { withAllocations } from './split.js';

export const mode = backend.mode;
export const isDemo = backend.mode === 'demo';
export const auth = backend.auth;
export const subscribe = (table, spaceId, onChange) => backend.subscribe(table, spaceId, onChange);
export const resetDemo = () => backend.reset?.();

// ------------------------------------------------------------------ account
export const ensureSetup = () => backend.rpc('ensure_my_setup');
export async function getProfile(userId) {
  return (await backend.list('profiles', { eq: { id: userId } }))[0] || null;
}
export async function updateProfile(userId, patch) {
  return (await backend.update('profiles', { id: userId }, patch))[0];
}
export async function getPrivateDetails(userId) {
  return (await backend.list('profile_private', { eq: { user_id: userId } }))[0] || null;
}
export const savePrivateDetails = (userId, patch) => backend.upsert('profile_private', { user_id: userId, ...patch }, 'user_id');

// ------------------------------------------------------------------ spaces
export const listSpaces = () => backend.rpc('list_my_spaces');
export const listMembers = (spaceId) => backend.rpc('list_space_members', { p_space: spaceId });
export async function getFeatures(spaceId) {
  const rows = await backend.list('space_features', { eq: { space_id: spaceId } });
  return Object.fromEntries(rows.map((r) => [r.feature_key, r.enabled]));
}
export const setFeature = (spaceId, key, enabled) => backend.rpc('set_feature', { p_space: spaceId, p_key: key, p_enabled: enabled });
export const createSpace = ({ type, name, icon, color, features }) =>
  backend.rpc('create_space', { p_type: type, p_name: name, p_icon: icon, p_color: color, p_features: features });
export async function updateSpace(spaceId, patch) {
  return (await backend.update('spaces', { id: spaceId }, patch))[0];
}
export async function createInvite(spaceId) {
  const result = await backend.rpc('create_invite', { p_space: spaceId });
  return Array.isArray(result) ? result[0] : result;
}
export const listInvites = (spaceId) =>
  backend.list('space_invites', { eq: { space_id: spaceId, revoked_at: null }, order: [['created_at', false]] });
export const revokeInvite = (inviteId) => backend.rpc('revoke_invite', { p_invite: inviteId });
export const invitePreview = (token) => backend.rpc('get_invite_preview', { p_token: token });
export const requestToJoin = (token) => backend.rpc('request_to_join', { p_token: token });
export const cancelJoinRequest = (spaceId) => backend.rpc('cancel_join_request', { p_space: spaceId });
export const listJoinRequests = (spaceId) => backend.rpc('list_join_requests', { p_space: spaceId });
export const listMyJoinRequests = () => backend.rpc('list_my_join_requests');
export const decideJoinRequest = (requestId, approve) => backend.rpc('decide_join_request', { p_request: requestId, p_approve: approve });
export const removeMember = (spaceId, userId) => backend.rpc('remove_member', { p_space: spaceId, p_user: userId });
export const leaveSpace = (spaceId) => backend.rpc('leave_space', { p_space: spaceId });
export const transferOwnership = (spaceId, userId) => backend.rpc('transfer_ownership', { p_space: spaceId, p_user: userId });
export const deleteSpace = (spaceId, confirmName) => backend.rpc('delete_space', { p_space: spaceId, p_confirm_name: confirmName });

export const inviteLink = (token) => `${window.location.origin}${window.location.pathname}#/join/${token}`;

// ------------------------------------------------------------------ to-dos
export const listTasks = (spaceId) => backend.list('tasks', { eq: { space_id: spaceId }, order: [['created_at', true]] });
export const addTask = (spaceId, task) => backend.insert('tasks', { space_id: spaceId, ...task });
export const updateTask = (taskId, patch) => backend.update('tasks', { id: taskId }, patch);
export const deleteTask = (taskId) => backend.remove('tasks', { id: taskId });
export const setTaskDone = (taskId, userId, done) =>
  updateTask(taskId, done ? { completed_at: new Date().toISOString(), completed_by: userId } : { completed_at: null, completed_by: null });

// ------------------------------------------------------------------ shopping
export const listGroceries = (spaceId) => backend.list('grocery_items', { eq: { space_id: spaceId }, order: [['created_at', true]] });
export const addGrocery = (spaceId, item) => backend.insert('grocery_items', { space_id: spaceId, ...item });
export const setPurchased = (itemId, userId, purchased) =>
  backend.update('grocery_items', { id: itemId }, purchased ? { purchased_at: new Date().toISOString(), purchased_by: userId } : { purchased_at: null, purchased_by: null });
export const deleteGrocery = (itemId) => backend.remove('grocery_items', { id: itemId });
export const clearPurchased = (spaceId) => backend.remove('grocery_items', { space_id: spaceId }, { neq: { purchased_at: null } });

// ------------------------------------------------------------------ bills
export const listBills = (spaceId) => backend.list('bills', { eq: { space_id: spaceId }, order: [['due_date', true]] });
export const addBill = (spaceId, bill) => backend.insert('bills', { space_id: spaceId, ...bill });
export const deleteBill = (billId) => backend.remove('bills', { id: billId });
export function nextDueDate(due, recurrence) {
  if (recurrence === 'weekly') return addDays(due, 7);
  if (recurrence === 'monthly') return addMonths(due, 1);
  if (recurrence === 'quarterly') return addMonths(due, 3);
  if (recurrence === 'yearly') return addMonths(due, 12);
  return null;
}
/** Marks a bill paid; a repeating bill gets its next one added automatically. */
export async function markBillPaid(bill, userId) {
  await backend.update('bills', { id: bill.id }, { paid_at: new Date().toISOString(), paid_by: userId });
  const next = nextDueDate(bill.due_date, bill.recurrence);
  if (next) {
    return backend.insert('bills', {
      space_id: bill.space_id, title: bill.title, amount_minor: bill.amount_minor, due_date: next, recurrence: bill.recurrence,
    });
  }
  return null;
}
export const unmarkBillPaid = (billId) => backend.update('bills', { id: billId }, { paid_at: null, paid_by: null });

// ------------------------------------------------------------------ daily spending
export const listExpenses = (spaceId, from, to) =>
  backend.list('expenses', { eq: { space_id: spaceId }, gte: from ? { spent_on: from } : {}, lte: to ? { spent_on: to } : {}, order: [['spent_on', false], ['created_at', false]] });
export const addExpense = (spaceId, expense) => backend.insert('expenses', { space_id: spaceId, ...expense });
export const deleteExpense = (expenseId) => backend.remove('expenses', { id: expenseId });

// ------------------------------------------------------------------ calendar
export const listEvents = (spaceId, from) =>
  backend.list('events', { eq: { space_id: spaceId }, gte: from ? { starts_on: from } : {}, order: [['starts_on', true], ['start_time', true]] });
export const addEvent = (spaceId, event) => backend.insert('events', { space_id: spaceId, ...event });
export const deleteEvent = (eventId) => backend.remove('events', { id: eventId });

// ------------------------------------------------------------------ Split Bills
export const listGroups = (spaceId) => backend.list('split_groups', { eq: { space_id: spaceId }, order: [['created_at', false]] });
export const createGroup = (spaceId, group) => backend.insert('split_groups', { space_id: spaceId, ...group });
export async function updateGroup(groupId, patch) {
  return (await backend.update('split_groups', { id: groupId }, patch))[0];
}
export const deleteGroup = (groupId) => backend.rpc('delete_split_group', { p_group: groupId });
/** A trip/event by id, in any space the person belongs to (row security hides the rest). */
export async function findGroup(groupId) {
  return (await backend.list('split_groups', { eq: { id: groupId } }))[0] || null;
}

/** Everything needed for balances in one space: groups, expenses (with allocations), settlements. */
export async function loadSplit(spaceId) {
  const [groups, expenses, settlements] = await Promise.all([
    listGroups(spaceId),
    backend.list('split_expenses', { eq: { space_id: spaceId }, order: [['spent_on', false], ['created_at', false]] }),
    backend.list('split_settlements', { eq: { space_id: spaceId }, order: [['paid_on', false], ['created_at', false]] }),
  ]);
  const allocations = await backend.list('split_allocations', { inList: { expense_id: expenses.map((e) => e.id) } });
  return { groups, expenses: withAllocations(expenses, allocations), settlements };
}

export const createSplitExpense = (a) => backend.rpc('create_split_expense', {
  p_space: a.spaceId, p_group: a.groupId, p_title: a.title, p_amount: a.amount, p_paid_by: a.paidBy, p_spent_on: a.spentOn || todayISO(),
  p_method: a.method, p_participants: a.participants, p_inputs: a.inputs, p_category: a.category || null, p_notes: a.notes || null,
  p_client_request_id: a.requestId || null,
});
export const updateSplitExpense = (a) => backend.rpc('update_split_expense', {
  p_expense: a.expenseId, p_title: a.title, p_amount: a.amount, p_paid_by: a.paidBy, p_spent_on: a.spentOn,
  p_method: a.method, p_participants: a.participants, p_inputs: a.inputs, p_category: a.category || null, p_notes: a.notes || null,
});
export const deleteSplitExpense = (expenseId) => backend.remove('split_expenses', { id: expenseId });
export const recordSettlement = (s) => backend.insert('split_settlements', {
  space_id: s.spaceId, group_id: s.groupId || null, from_user: s.from, to_user: s.to, amount_minor: s.amount,
  paid_on: s.paidOn || todayISO(), method: s.method, note: s.note || null, client_request_id: s.requestId || null, recorded_by: s.recordedBy,
});
export const deleteSettlement = (settlementId) => backend.remove('split_settlements', { id: settlementId });
export const legacySummary = (spaceId) => backend.rpc('legacy_split_summary', { p_space: spaceId });
export const deleteLegacy = (spaceId, expenses, settlements) =>
  backend.rpc('delete_legacy_split_records', { p_space: spaceId, p_expected_expenses: expenses, p_expected_settlements: settlements });
export const moveToGroup = (expenseIds, groupId) => backend.rpc('move_expenses_to_group', { p_expenses: expenseIds, p_group: groupId });

// ------------------------------------------------------------------ health (private)
export const listMedicines = () => backend.list('medicines', { eq: { active: true }, order: [['created_at', true]] });
export const addMedicine = (med) => backend.insert('medicines', med);
export const stopMedicine = (medId) => backend.update('medicines', { id: medId }, { active: false });
export const listDoses = (date) => backend.list('medicine_doses', { eq: { dose_date: date } });
export const markDose = (medId, date, slot, taken) =>
  taken
    ? backend.insert('medicine_doses', { medicine_id: medId, dose_date: date, slot })
    : backend.remove('medicine_doses', { medicine_id: medId, dose_date: date, slot });

export const CYCLE_DEFAULTS = { typical_cycle: 28, typical_period: 5, show_fertile: true, discreet: true, remind_days_before: 2, daily_checkin: false };
export async function getCycleSettings() {
  return { ...CYCLE_DEFAULTS, ...((await backend.list('cycle_settings'))[0] || {}) };
}
export const saveCycleSettings = (userId, patch) => backend.upsert('cycle_settings', { user_id: userId, ...patch }, 'user_id');
export const listPeriods = () => backend.list('cycle_periods', { order: [['start_date', true]] });
export const addPeriod = (period) => backend.insert('cycle_periods', period);
export const updatePeriod = (periodId, patch) => backend.update('cycle_periods', { id: periodId }, patch);
export const deletePeriod = (periodId) => backend.remove('cycle_periods', { id: periodId });
export const listCycleLogs = (from, to) =>
  backend.list('cycle_logs', { gte: from ? { log_date: from } : {}, lte: to ? { log_date: to } : {}, order: [['log_date', true]] });
export const saveCycleLog = (userId, date, patch) => backend.upsert('cycle_logs', { user_id: userId, log_date: date, ...patch }, 'user_id,log_date');
export const deleteAllCycleData = () => backend.rpc('delete_all_cycle_data');
export const listHealthShares = () => backend.list('health_shares', { eq: { revoked_at: null } });
export const setHealthShare = (granteeId, spaceId, scopes) =>
  backend.rpc('set_health_share', { p_grantee: granteeId, p_space: spaceId, p_scopes: scopes });
export const revokeHealthShare = (shareId) => backend.rpc('revoke_health_share', { p_share: shareId });
export const getSharedCycle = (ownerId) => backend.rpc('get_shared_cycle', { p_owner: ownerId });
