// Demo implementation of the DayOrbit data interface: everything lives in this browser's
// localStorage. It mirrors the database rules closely enough to try every flow.
import { seedDemo, DEMO_ME } from './demoSeed.js';
import { largestRemainder } from '../split.js';
import { todayISO, addDays } from '../dates.js';

const KEY = 'dayorbit-demo-v1';

const HAS_ID = new Set([
  'spaces', 'space_invites', 'join_requests', 'tasks', 'grocery_items', 'bills', 'expenses', 'events',
  'split_groups', 'split_expenses', 'split_settlements', 'medicines', 'cycle_periods', 'health_shares',
]);
const OWNER_COLUMN = {
  tasks: 'created_by', grocery_items: 'added_by', bills: 'created_by', expenses: 'created_by', events: 'created_by',
  split_groups: 'created_by', split_settlements: 'recorded_by', medicines: 'user_id', medicine_doses: 'user_id',
  cycle_periods: 'user_id', cycle_logs: 'user_id', cycle_settings: 'user_id', profile_private: 'user_id',
};
const USER_SCOPED = new Set(['profile_private', 'medicines', 'medicine_doses', 'cycle_settings', 'cycle_periods', 'cycle_logs']);
const DEFAULTS = {
  tasks: () => ({ notes: null, due_date: null, due_time: null, assignee_id: null, completed_at: null, completed_by: null }),
  grocery_items: () => ({ quantity: null, section: 'Other', purchased_at: null, purchased_by: null }),
  bills: () => ({ recurrence: 'none', paid_at: null, paid_by: null }),
  expenses: () => ({ category: 'Other', spent_on: todayISO(), note: null }),
  events: () => ({ start_time: null, end_time: null, location: null, notes: null }),
  split_groups: () => ({ kind: 'trip', starts_on: null, ends_on: null, description: null }),
  split_settlements: () => ({ group_id: null, paid_on: todayISO(), method: 'upi', note: null, legacy: false, client_request_id: null }),
  medicines: () => ({ dose: null, times: [], notes: null, active: true }),
  medicine_doses: () => ({ taken_at: new Date().toISOString() }),
  cycle_periods: () => ({ end_date: null }),
  cycle_logs: () => ({ flow: null, feelings: [], body: [], note: null }),
  cycle_settings: () => ({ typical_cycle: 28, typical_period: 5, show_fertile: true, discreet: true, remind_days_before: 2, daily_checkin: false }),
};
const FEATURE_KEYS = {
  personal: ['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'health'],
  shared: ['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'split'],
};
const DEFAULT_ON = {
  personal: FEATURE_KEYS.personal,
  family: ['tasks', 'shopping', 'bills', 'expenses', 'calendar'],
  couple: ['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'split'],
  friends: ['tasks', 'shopping', 'calendar', 'split'],
  office: ['tasks', 'calendar', 'expenses'],
  custom: ['tasks', 'shopping', 'calendar'],
};
const DEFAULT_LOOK = {
  family: ['home', 'honey'], couple: ['heart', 'rose'], friends: ['users', 'teal'], office: ['briefcase', 'slate'], custom: ['star', 'plum'],
};
const FEATURE_ALIASES = {
  groceries: 'shopping', grocery: 'shopping', todo: 'tasks', todos: 'tasks', reminders: 'tasks', split_bills: 'split',
  splitbills: 'split', money: 'bills', daily_expenses: 'expenses', events: 'calendar',
};

const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const nowISO = () => new Date().toISOString();
const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const fail = (code) => Object.assign(new Error(code), { code: 'P0001' });

function matches(row, { eq = {}, neq = {}, gte = {}, lte = {}, inList = {} } = {}) {
  for (const [k, v] of Object.entries(eq)) if ((row[k] ?? null) !== v) return false;
  for (const [k, v] of Object.entries(neq)) if (v === null ? row[k] == null : row[k] === v) return false;
  for (const [k, v] of Object.entries(gte)) if (row[k] == null || row[k] < v) return false;
  for (const [k, v] of Object.entries(lte)) if (row[k] == null || row[k] > v) return false;
  for (const [k, v] of Object.entries(inList)) if (!v.includes(row[k])) return false;
  return true;
}

function sortRows(rows, order = []) {
  return [...rows].sort((a, b) => {
    for (const [col, asc = true] of order) {
      const x = a[col];
      const y = b[col];
      if (x === y) continue;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x < y ? -1 : 1) * (asc ? 1 : -1);
    }
    return 0;
  });
}

function computeShares(total, method, inputs, n) {
  if (method === 'equal') return largestRemainder(total, Array(n).fill(1));
  if (!inputs || inputs.length !== n) throw fail('inputs_mismatch');
  if (method === 'shares') {
    if (inputs.some((x) => !Number.isInteger(Number(x)) || Number(x) < 1)) throw fail('shares_invalid');
    return largestRemainder(total, inputs.map(Number));
  }
  if (method === 'percent') {
    const bp = inputs.map((x) => Math.round(Number(x) * 100));
    if (bp.some((x) => Number.isNaN(x) || x < 0)) throw fail('percent_invalid');
    if (bp.reduce((a, b) => a + b, 0) !== 10000) throw fail('percent_sum');
    return largestRemainder(total, bp);
  }
  const exact = inputs.map(Number);
  if (exact.some((x) => !Number.isInteger(x) || x < 0)) throw fail('exact_invalid');
  if (exact.reduce((a, b) => a + b, 0) !== total) throw fail('exact_sum');
  return exact;
}

export function createDemoBackend() {
  let db = load();
  const authListeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.version === 1) return parsed;
      }
    } catch { /* corrupted or blocked storage → start fresh */ }
    return seedDemo();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* private mode or quota — keep working in memory */ }
  }
  const T = (name) => (db.tables[name] ||= []);
  const me = () => db.session;
  const requireMe = () => { if (!db.session) throw fail('not_authenticated'); return db.session; };
  const isMember = (space, user = me()) => T('space_members').some((m) => m.space_id === space && m.user_id === user && !m.left_at);
  const isOwner = (space, user = me()) => T('space_members').some((m) => m.space_id === space && m.user_id === user && !m.left_at && m.role === 'owner');
  const spaceById = (space) => T('spaces').find((s) => s.id === space);
  const nameOf = (user) => T('profiles').find((p) => p.id === user)?.display_name || 'Someone';
  const keysFor = (type) => (type === 'personal' ? FEATURE_KEYS.personal : FEATURE_KEYS.shared);

  function withDefaults(table, row) {
    const out = { ...(DEFAULTS[table]?.() || {}), ...row };
    if (HAS_ID.has(table) && !out.id) out.id = newId();
    if (!('created_at' in out) && !['space_features', 'split_allocations', 'medicine_doses', 'cycle_logs', 'cycle_settings', 'profile_private'].includes(table)) {
      out.created_at = nowISO();
    }
    const owner = OWNER_COLUMN[table];
    if (owner && out[owner] == null) out[owner] = me();
    return out;
  }

  function checkRow(table, row) {
    if (['bills', 'expenses', 'split_settlements'].includes(table) && !(row.amount_minor > 0)) throw fail('invalid_amount');
    if ('title' in row && !String(row.title || '').trim()) throw new Error('Please add a title.');
    if (table === 'split_settlements' && row.from_user === row.to_user) throw fail('invalid_amount');
    const sid = row.space_id;
    if (sid && !['space_members', 'space_features', 'space_invites', 'join_requests'].includes(table) && !isMember(sid)) {
      throw Object.assign(new Error('new row violates row-level security policy'), { code: '42501' });
    }
  }

  function setupUser(user, name) {
    if (!T('profiles').some((p) => p.id === user)) {
      T('profiles').push({ id: user, display_name: (name || 'Friend').slice(0, 80), avatar_url: null, theme: 'system', onboarded: false, created_at: nowISO() });
    }
    let personal = T('spaces').find((s) => s.owner_id === user && s.type === 'personal');
    if (!personal) {
      personal = { id: newId(), type: 'personal', name: 'My Space', icon: 'user', color: 'indigo', owner_id: user, created_at: nowISO() };
      T('spaces').push(personal);
      T('space_members').push({ space_id: personal.id, user_id: user, role: 'owner', joined_at: nowISO(), left_at: null });
      for (const key of FEATURE_KEYS.personal) T('space_features').push({ space_id: personal.id, feature_key: key, enabled: true });
    }
    if (!T('cycle_settings').some((c) => c.user_id === user)) T('cycle_settings').push({ user_id: user, ...DEFAULTS.cycle_settings() });
    return personal.id;
  }

  function deleteSpaceData(space) {
    const expenseIds = new Set(T('split_expenses').filter((e) => e.space_id === space).map((e) => e.id));
    db.tables.split_allocations = T('split_allocations').filter((a) => !expenseIds.has(a.expense_id));
    for (const table of ['space_members', 'space_features', 'space_invites', 'join_requests', 'tasks', 'grocery_items', 'bills',
      'expenses', 'events', 'split_groups', 'split_expenses', 'split_settlements', 'health_shares']) {
      db.tables[table] = T(table).filter((r) => r.space_id !== space);
    }
    db.tables.spaces = T('spaces').filter((s) => s.id !== space);
  }

  function checkSplitPeople(space, paidBy, participants) {
    if (!participants?.length) throw fail('no_participants');
    if (new Set(participants).size !== participants.length) throw fail('duplicate_participant');
    if (!isMember(space, paidBy)) throw fail('payer_not_member');
    if (participants.some((p) => !isMember(space, p))) throw fail('participant_not_member');
  }

  function writeAllocations(expenseId, method, participants, inputs, shares) {
    db.tables.split_allocations = T('split_allocations').filter((a) => a.expense_id !== expenseId);
    participants.forEach((user, i) => {
      T('split_allocations').push({ expense_id: expenseId, user_id: user, share_minor: shares[i], input_value: method === 'equal' ? null : inputs[i] });
    });
  }

  const rpcs = {
    ensure_my_setup() {
      const user = requireMe();
      return setupUser(user, db.users[user]?.name);
    },
    list_my_spaces() {
      const user = requireMe();
      return T('spaces')
        .map((s) => ({ s, m: T('space_members').find((x) => x.space_id === s.id && x.user_id === user && !x.left_at) }))
        .filter(({ m }) => m)
        .sort((a, b) => (a.s.type === 'personal' ? -1 : b.s.type === 'personal' ? 1 : a.s.created_at < b.s.created_at ? -1 : 1))
        .map(({ s, m }) => ({
          ...s, role: m.role,
          member_count: T('space_members').filter((x) => x.space_id === s.id && !x.left_at).length,
        }));
    },
    list_space_members({ p_space }) {
      if (!isMember(p_space)) return [];
      return T('space_members')
        .filter((m) => m.space_id === p_space)
        .sort((a, b) => (!!a.left_at - !!b.left_at) || ((b.role === 'owner') - (a.role === 'owner')) || (a.joined_at < b.joined_at ? -1 : 1))
        .map((m) => ({ user_id: m.user_id, role: m.role, joined_at: m.joined_at, left_at: m.left_at, display_name: nameOf(m.user_id), avatar_url: null }));
    },
    create_space({ p_type, p_name, p_icon, p_color, p_features }) {
      const user = requireMe();
      if (p_type === 'personal') throw fail('personal_space_exists');
      const [icon, color] = DEFAULT_LOOK[p_type] || ['star', 'plum'];
      const space = { id: newId(), type: p_type, name: String(p_name).trim(), icon: p_icon || icon, color: p_color || color, owner_id: user, created_at: nowISO() };
      if (!space.name) throw new Error('Please add a name.');
      T('spaces').push(space);
      T('space_members').push({ space_id: space.id, user_id: user, role: 'owner', joined_at: nowISO(), left_at: null });
      const on = p_features || DEFAULT_ON[p_type] || [];
      for (const key of FEATURE_KEYS.shared) T('space_features').push({ space_id: space.id, feature_key: key, enabled: on.includes(key) });
      return space;
    },
    set_feature({ p_space, p_key, p_enabled }) {
      if (!isOwner(p_space)) throw fail('not_owner');
      const key = FEATURE_ALIASES[String(p_key).toLowerCase()] || String(p_key).toLowerCase();
      const space = spaceById(p_space);
      if (!keysFor(space.type).includes(key)) {
        if (key === 'health') throw fail('health_personal_only');
        return false;
      }
      const row = T('space_features').find((f) => f.space_id === p_space && f.feature_key === key);
      if (row) row.enabled = p_enabled;
      else T('space_features').push({ space_id: p_space, feature_key: key, enabled: p_enabled });
      return true;
    },
    transfer_ownership({ p_space, p_user }) {
      if (!isOwner(p_space)) throw fail('not_owner');
      if (spaceById(p_space).type === 'personal') throw fail('personal_space_is_private');
      if (!isMember(p_space, p_user)) throw fail('not_member');
      for (const m of T('space_members')) {
        if (m.space_id !== p_space) continue;
        if (m.user_id === me()) m.role = 'member';
        if (m.user_id === p_user) m.role = 'owner';
      }
      spaceById(p_space).owner_id = p_user;
    },
    remove_member({ p_space, p_user }) {
      if (!isOwner(p_space)) throw fail('not_owner');
      if (p_user === me()) throw fail('cannot_remove_self');
      const m = T('space_members').find((x) => x.space_id === p_space && x.user_id === p_user && !x.left_at);
      if (!m) throw fail('not_member');
      m.left_at = nowISO();
      for (const s of T('health_shares')) {
        if (s.space_id === p_space && !s.revoked_at && (s.owner_id === p_user || s.grantee_id === p_user)) s.revoked_at = nowISO();
      }
    },
    leave_space({ p_space }) {
      const m = T('space_members').find((x) => x.space_id === p_space && x.user_id === me() && !x.left_at);
      if (!m) throw fail('not_member');
      if (spaceById(p_space).type === 'personal') throw fail('cannot_leave_personal');
      if (m.role === 'owner') {
        const others = T('space_members').some((x) => x.space_id === p_space && x.user_id !== me() && !x.left_at);
        throw fail(others ? 'transfer_ownership_first' : 'delete_instead');
      }
      m.left_at = nowISO();
    },
    delete_space({ p_space, p_confirm_name }) {
      const space = spaceById(p_space);
      if (!space || !isOwner(p_space)) throw fail('not_owner');
      if (space.type === 'personal') throw fail('cannot_delete_personal');
      if (String(p_confirm_name || '').trim() !== space.name.trim()) throw fail('name_mismatch');
      deleteSpaceData(p_space);
    },
    create_invite({ p_space }) {
      if (!isOwner(p_space)) throw fail('not_owner');
      if (spaceById(p_space).type === 'personal') throw fail('personal_space_is_private');
      const invite = {
        id: newId(), space_id: p_space, token: newId().replace(/-/g, ''), created_by: me(),
        created_at: nowISO(), expires_at: new Date(Date.now() + 14 * 86400000).toISOString(), revoked_at: null,
      };
      T('space_invites').push(invite);
      return [{ id: invite.id, token: invite.token, expires_at: invite.expires_at }];
    },
    revoke_invite({ p_invite }) {
      const invite = T('space_invites').find((i) => i.id === p_invite);
      if (!invite || !isOwner(invite.space_id)) throw fail('not_owner');
      invite.revoked_at = invite.revoked_at || nowISO();
    },
    get_invite_preview({ p_token }) {
      const invite = T('space_invites').find((i) => i.token === p_token);
      if (!invite) return { status: 'invalid' };
      const space = spaceById(invite.space_id);
      if (!space) return { status: 'invalid' };
      const status = invite.revoked_at ? 'revoked' : invite.expires_at < nowISO() ? 'expired' : 'valid';
      let my = 'none';
      if (me()) {
        if (space.owner_id === me()) my = 'owner';
        else if (isMember(space.id)) my = 'member';
        else if (T('join_requests').some((r) => r.space_id === space.id && r.user_id === me() && r.status === 'pending')) my = 'pending';
        else if (T('join_requests').some((r) => r.space_id === space.id && r.user_id === me() && r.status === 'rejected')) my = 'rejected';
      }
      if (status !== 'valid' && !['owner', 'member'].includes(my)) return { status, my_status: my };
      return {
        status, my_status: my, space_id: space.id, name: space.name, type: space.type, icon: space.icon, color: space.color,
        member_count: T('space_members').filter((m) => m.space_id === space.id && !m.left_at).length,
        inviter_name: nameOf(invite.created_by),
      };
    },
    request_to_join({ p_token }) {
      const user = requireMe();
      const invite = T('space_invites').find((i) => i.token === p_token);
      if (!invite) return 'invalid';
      if (invite.revoked_at) return 'revoked';
      if (invite.expires_at < nowISO()) return 'expired';
      const space = spaceById(invite.space_id);
      if (!space || space.type === 'personal') return 'invalid';
      if (space.owner_id === user) return 'owner';
      if (isMember(space.id)) return 'already_member';
      if (T('join_requests').some((r) => r.space_id === space.id && r.user_id === user && r.status === 'pending')) return 'pending';
      setupUser(user, db.users[user]?.name);
      T('join_requests').push({ id: newId(), space_id: space.id, invite_id: invite.id, user_id: user, status: 'pending', created_at: nowISO(), decided_by: null, decided_at: null });
      return 'pending';
    },
    cancel_join_request({ p_space }) {
      for (const r of T('join_requests')) {
        if (r.space_id === p_space && r.user_id === me() && r.status === 'pending') { r.status = 'cancelled'; r.decided_at = nowISO(); }
      }
    },
    list_join_requests({ p_space }) {
      if (!isOwner(p_space)) return [];
      return T('join_requests')
        .filter((r) => r.space_id === p_space && r.status === 'pending')
        .map((r) => ({ id: r.id, user_id: r.user_id, display_name: nameOf(r.user_id), created_at: r.created_at }));
    },
    list_my_join_requests() {
      return T('join_requests')
        .filter((r) => r.user_id === me())
        .map((r) => {
          const s = spaceById(r.space_id) || {};
          return { id: r.id, space_id: r.space_id, space_name: s.name, space_type: s.type, color: s.color, icon: s.icon,
            status: r.status, created_at: r.created_at, decided_at: r.decided_at, owner_name: nameOf(s.owner_id) };
        })
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },
    decide_join_request({ p_request, p_approve }) {
      const r = T('join_requests').find((x) => x.id === p_request);
      if (!r || !isOwner(r.space_id)) throw fail('not_owner');
      if (r.status !== 'pending') return r.status;
      if (p_approve) {
        const space = spaceById(r.space_id);
        const active = T('space_members').filter((m) => m.space_id === r.space_id && !m.left_at).length;
        if (space.type === 'couple' && active >= 2) throw fail('couple_full');
        const existing = T('space_members').find((m) => m.space_id === r.space_id && m.user_id === r.user_id);
        if (existing) Object.assign(existing, { left_at: null, joined_at: nowISO(), role: 'member' });
        else T('space_members').push({ space_id: r.space_id, user_id: r.user_id, role: 'member', joined_at: nowISO(), left_at: null });
      }
      Object.assign(r, { status: p_approve ? 'approved' : 'rejected', decided_by: me(), decided_at: nowISO() });
      return r.status;
    },
    create_split_expense(a) {
      requireMe();
      if (!isMember(a.p_space)) throw fail('not_member');
      if (a.p_client_request_id) {
        const existing = T('split_expenses').find((e) => e.client_request_id === a.p_client_request_id);
        if (existing) return existing.id;
      }
      if (spaceById(a.p_space).type === 'personal') throw fail('split_needs_shared_space');
      if (!(a.p_amount > 0)) throw fail('invalid_amount');
      if (a.p_group && !T('split_groups').some((g) => g.id === a.p_group && g.space_id === a.p_space)) throw fail('group_not_in_space');
      checkSplitPeople(a.p_space, a.p_paid_by, a.p_participants);
      const shares = computeShares(a.p_amount, a.p_method, a.p_inputs, a.p_participants.length);
      const expense = {
        id: newId(), space_id: a.p_space, group_id: a.p_group || null, title: String(a.p_title).trim(), amount_minor: a.p_amount,
        paid_by: a.p_paid_by, spent_on: a.p_spent_on || todayISO(), method: a.p_method, category: a.p_category || null,
        notes: a.p_notes || null, legacy: false, client_request_id: a.p_client_request_id || null, created_by: me(),
        created_at: nowISO(), updated_at: nowISO(),
      };
      if (!expense.title) throw new Error('Please add a title.');
      T('split_expenses').push(expense);
      writeAllocations(expense.id, a.p_method, a.p_participants, a.p_inputs, shares);
      return expense.id;
    },
    update_split_expense(a) {
      const e = T('split_expenses').find((x) => x.id === a.p_expense);
      if (!e || !isMember(e.space_id)) throw fail('not_member');
      if (!(e.created_by === me() || e.paid_by === me() || isOwner(e.space_id))) throw fail('not_allowed');
      if (!(a.p_amount > 0)) throw fail('invalid_amount');
      checkSplitPeople(e.space_id, a.p_paid_by, a.p_participants);
      const shares = computeShares(a.p_amount, a.p_method, a.p_inputs, a.p_participants.length);
      Object.assign(e, {
        title: String(a.p_title).trim(), amount_minor: a.p_amount, paid_by: a.p_paid_by, spent_on: a.p_spent_on || e.spent_on,
        method: a.p_method, category: a.p_category || null, notes: a.p_notes || null, updated_at: nowISO(),
      });
      writeAllocations(e.id, a.p_method, a.p_participants, a.p_inputs, shares);
      return e.id;
    },
    delete_split_group({ p_group }) {
      const g = T('split_groups').find((x) => x.id === p_group);
      if (!g || !isMember(g.space_id)) throw fail('not_member');
      if (!(isOwner(g.space_id) || g.created_by === me())) throw fail('not_allowed');
      const expenseIds = new Set(T('split_expenses').filter((e) => e.group_id === p_group).map((e) => e.id));
      const settlements = T('split_settlements').filter((s) => s.group_id === p_group).length;
      db.tables.split_allocations = T('split_allocations').filter((x) => !expenseIds.has(x.expense_id));
      db.tables.split_expenses = T('split_expenses').filter((e) => e.group_id !== p_group);
      db.tables.split_settlements = T('split_settlements').filter((s) => s.group_id !== p_group);
      db.tables.split_groups = T('split_groups').filter((x) => x.id !== p_group);
      return { expenses: expenseIds.size, settlements };
    },
    legacy_split_summary({ p_space }) {
      if (!isMember(p_space)) throw fail('not_member');
      const exp = T('split_expenses').filter((e) => e.space_id === p_space && !e.group_id);
      return {
        expenses: exp.length,
        settlements: T('split_settlements').filter((s) => s.space_id === p_space && !s.group_id).length,
        total_minor: exp.reduce((sum, e) => sum + e.amount_minor, 0),
      };
    },
    delete_legacy_split_records({ p_space, p_expected_expenses, p_expected_settlements }) {
      if (!isOwner(p_space)) throw fail('not_owner');
      const ids = new Set(T('split_expenses').filter((e) => e.space_id === p_space && !e.group_id).map((e) => e.id));
      const settlements = T('split_settlements').filter((s) => s.space_id === p_space && !s.group_id).length;
      if (ids.size !== p_expected_expenses || settlements !== p_expected_settlements) throw fail('counts_changed');
      db.tables.split_allocations = T('split_allocations').filter((a) => !ids.has(a.expense_id));
      db.tables.split_expenses = T('split_expenses').filter((e) => !ids.has(e.id));
      db.tables.split_settlements = T('split_settlements').filter((s) => !(s.space_id === p_space && !s.group_id));
      return { expenses: ids.size, settlements };
    },
    move_expenses_to_group({ p_expenses, p_group }) {
      const g = T('split_groups').find((x) => x.id === p_group);
      if (!g || !isMember(g.space_id)) throw fail('not_member');
      let count = 0;
      for (const e of T('split_expenses')) {
        if (p_expenses.includes(e.id) && e.space_id === g.space_id && !e.group_id) { e.group_id = p_group; e.legacy = false; count += 1; }
      }
      return count;
    },
    set_health_share({ p_grantee, p_space, p_scopes }) {
      const user = requireMe();
      if (spaceById(p_space)?.type !== 'couple') throw fail('couple_space_only');
      if (!isMember(p_space) || !isMember(p_space, p_grantee) || p_grantee === user) throw fail('not_member');
      const active = T('health_shares').find((s) => s.owner_id === user && s.grantee_id === p_grantee && s.space_id === p_space && !s.revoked_at);
      if (!p_scopes?.length) { if (active) active.revoked_at = nowISO(); return null; }
      if (active) { active.scopes = p_scopes; return active.id; }
      const share = { id: newId(), owner_id: user, grantee_id: p_grantee, space_id: p_space, scopes: p_scopes, created_at: nowISO(), revoked_at: null, last_viewed_at: null };
      T('health_shares').push(share);
      return share.id;
    },
    revoke_health_share({ p_share }) {
      const s = T('health_shares').find((x) => x.id === p_share && x.owner_id === me());
      if (s && !s.revoked_at) s.revoked_at = nowISO();
    },
    get_shared_cycle({ p_owner }) {
      const share = T('health_shares').find((s) => s.owner_id === p_owner && s.grantee_id === me() && !s.revoked_at
        && isMember(s.space_id, p_owner) && isMember(s.space_id));
      if (!share) throw fail('not_shared');
      const periods = T('cycle_periods').filter((p) => p.user_id === p_owner).sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
      const settings = T('cycle_settings').find((c) => c.user_id === p_owner) || DEFAULTS.cycle_settings();
      const recent = periods.slice(0, 7).reverse();
      const lengths = recent.slice(1).map((p, i) => (new Date(p.start_date) - new Date(recent[i].start_date)) / 86400000).filter((l) => l >= 15 && l <= 60);
      const avg = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : settings.typical_cycle;
      const out = { owner_name: nameOf(p_owner), scopes: share.scopes };
      if (share.scopes.includes('period_dates')) out.periods = periods.slice(0, 6).map((p) => ({ start_date: p.start_date, end_date: p.end_date }));
      if (share.scopes.includes('prediction') && periods.length) { out.next_period_start = addDays(periods[0].start_date, avg); out.range_days = 2; }
      share.last_viewed_at = nowISO();
      return out;
    },
    delete_all_cycle_data() {
      const user = requireMe();
      db.tables.cycle_logs = T('cycle_logs').filter((l) => l.user_id !== user);
      db.tables.cycle_periods = T('cycle_periods').filter((p) => p.user_id !== user);
      for (const s of T('health_shares')) if (s.owner_id === user && !s.revoked_at) s.revoked_at = nowISO();
      const settings = T('cycle_settings').find((c) => c.user_id === user);
      if (settings) Object.assign(settings, DEFAULTS.cycle_settings());
    },
  };

  const userObject = (user) => ({ id: user, email: db.users[user]?.email, name: db.users[user]?.name });
  const emit = (event) => {
    const user = db.session ? userObject(db.session) : null;
    for (const cb of authListeners) cb(event, user);
  };

  return {
    mode: 'demo',

    auth: {
      async getUser() { return db.session ? userObject(db.session) : null; },
      onChange(callback) { authListeners.add(callback); return () => authListeners.delete(callback); },
      async signUp({ email, password, fullName }) {
        const mail = String(email || '').trim().toLowerCase();
        if (!mail || !password) throw new Error('Please fill in your email and password.');
        if (password.length < 8) throw new Error('Password should be at least 8 characters');
        if (Object.values(db.users).some((u) => u.email === mail)) throw new Error('User already registered');
        const user = newId();
        db.users[user] = { email: mail, name: fullName };
        setupUser(user, fullName || mail.split('@')[0]);
        db.session = user;
        save();
        emit('SIGNED_IN');
        return { needsConfirmation: false };
      },
      async signIn({ email }) {
        const mail = String(email || '').trim().toLowerCase();
        const found = Object.entries(db.users).find(([, u]) => u.email === mail);
        db.session = found ? found[0] : DEMO_ME;
        save();
        emit('SIGNED_IN');
      },
      async signOut() { db.session = null; save(); emit('SIGNED_OUT'); },
      async resend() {},
      async resetPassword() {},
      async updatePassword() {},
    },

    async list(table, opts = {}) {
      let rows = T(table);
      if (USER_SCOPED.has(table)) rows = rows.filter((r) => r.user_id === me());
      if (table === 'health_shares') rows = rows.filter((r) => r.owner_id === me() || r.grantee_id === me());
      rows = rows.filter((r) => matches(r, opts));
      rows = sortRows(rows, opts.order);
      if (opts.limit) rows = rows.slice(0, opts.limit);
      return clone(rows);
    },

    async insert(table, rows) {
      const list = (Array.isArray(rows) ? rows : [rows]).map((r) => withDefaults(table, r));
      list.forEach((r) => checkRow(table, r));
      T(table).push(...list);
      save();
      return clone(Array.isArray(rows) ? list : list[0]);
    },

    async update(table, match, patch) {
      let allowed = patch;
      if (table === 'spaces') {
        const { name, icon, color } = patch;
        allowed = Object.fromEntries(Object.entries({ name, icon, color }).filter(([, v]) => v !== undefined));
        for (const s of T('spaces').filter((r) => matches(r, { eq: match }))) if (!isOwner(s.id)) throw fail('not_owner');
      }
      const changed = T(table).filter((r) => matches(r, { eq: match }));
      for (const r of changed) Object.assign(r, allowed, 'updated_at' in r ? { updated_at: nowISO() } : {});
      save();
      return clone(changed);
    },

    async upsert(table, row, onConflict) {
      const full = { ...row };
      const owner = OWNER_COLUMN[table];
      if (owner && full[owner] == null) full[owner] = me();
      const keys = onConflict.split(',').map((k) => k.trim());
      const existing = T(table).find((r) => keys.every((k) => r[k] === full[k]));
      if (existing) Object.assign(existing, full, { updated_at: nowISO() });
      else T(table).push({ ...withDefaults(table, full), updated_at: nowISO() });
      save();
      return clone(existing || T(table)[T(table).length - 1]);
    },

    async remove(table, match, extra = {}) {
      const doomed = T(table).filter((r) => matches(r, { eq: match, ...extra }));
      const ids = new Set(doomed.map((r) => r.id));
      db.tables[table] = T(table).filter((r) => !doomed.includes(r));
      if (table === 'split_expenses') db.tables.split_allocations = T('split_allocations').filter((a) => !ids.has(a.expense_id));
      if (table === 'medicines') db.tables.medicine_doses = T('medicine_doses').filter((d) => !ids.has(d.medicine_id));
      save();
    },

    async rpc(name, args = {}) {
      const fn = rpcs[name];
      if (!fn) throw new Error(`Unknown function ${name}`);
      const result = fn(args);
      save();
      return clone(result);
    },

    subscribe() { return () => {}; },

    reset() { db = seedDemo(); save(); },
  };
}
