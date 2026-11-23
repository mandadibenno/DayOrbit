// Sample data for demo mode. Dates are relative to today so the demo always looks current.
import { todayISO, addDays, addMonths, startOfMonth } from '../dates.js';
import { largestRemainder } from '../split.js';

export const DEMO_ME = 'u-aarav';

const PEOPLE = {
  'u-aarav': { email: 'aarav@demo.dayorbit.app', name: 'Aarav Mehta' },
  'u-sunita': { email: 'sunita@demo.dayorbit.app', name: 'Sunita Mehta' },
  'u-raj': { email: 'raj@demo.dayorbit.app', name: 'Raj Mehta' },
  'u-riya': { email: 'riya@demo.dayorbit.app', name: 'Riya Mehta' },
  'u-diya': { email: 'diya@demo.dayorbit.app', name: 'Diya Shah' },
  'u-kabir': { email: 'kabir@demo.dayorbit.app', name: 'Kabir Rao' },
  'u-meera': { email: 'meera@demo.dayorbit.app', name: 'Meera Iyer' },
  'u-rohan': { email: 'rohan@demo.dayorbit.app', name: 'Rohan Das' },
  'u-asha': { email: 'asha@demo.dayorbit.app', name: 'Asha Kapoor' },
};

const FEATURES = {
  personal: { all: ['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'health'], on: ['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'health'] },
  family: { all: ['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'split'], on: ['tasks', 'shopping', 'bills', 'expenses', 'calendar'] },
  friends: { all: ['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'split'], on: ['tasks', 'shopping', 'calendar', 'split'] },
  couple: { all: ['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'split'], on: ['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'split'] },
};

export function seedDemo() {
  const today = todayISO();
  const day = (n) => addDays(today, n);
  const at = (n, hour = 10, minute = 0) => {
    const x = new Date();
    x.setDate(x.getDate() + n);
    x.setHours(hour, minute, 0, 0);
    return x.toISOString();
  };
  let seq = 0;
  const id = (prefix) => `${prefix}-${(seq += 1)}`;
  const created = at(-30);

  const t = {
    profiles: [], profile_private: [], spaces: [], space_members: [], space_features: [], space_invites: [], join_requests: [],
    tasks: [], grocery_items: [], bills: [], expenses: [], events: [],
    split_groups: [], split_expenses: [], split_allocations: [], split_settlements: [],
    medicines: [], medicine_doses: [], cycle_settings: [], cycle_periods: [], cycle_logs: [], health_shares: [],
  };

  for (const [uid, p] of Object.entries(PEOPLE)) {
    t.profiles.push({ id: uid, display_name: p.name, avatar_url: null, theme: 'system', onboarded: true, created_at: created });
  }
  t.profile_private.push({ user_id: 'u-aarav', age: 29, gender: 'Prefer not to say', phone_country: '+91', phone: '', updated_at: created });

  const space = (sid, type, name, icon, color, owner, members) => {
    t.spaces.push({ id: sid, type, name, icon, color, owner_id: owner, created_at: created });
    t.space_members.push({ space_id: sid, user_id: owner, role: 'owner', joined_at: created, left_at: null });
    for (const m of members) t.space_members.push({ space_id: sid, user_id: m, role: 'member', joined_at: created, left_at: null });
    const f = FEATURES[type];
    for (const key of f.all) t.space_features.push({ space_id: sid, feature_key: key, enabled: f.on.includes(key) });
  };
  space('s-my', 'personal', 'My Space', 'user', 'indigo', 'u-aarav', []);
  space('s-family', 'family', 'Mehta Family', 'home', 'honey', 'u-aarav', ['u-sunita', 'u-raj', 'u-riya']);
  space('s-goa', 'friends', 'Goa Gang', 'users', 'teal', 'u-aarav', ['u-diya', 'u-kabir', 'u-meera', 'u-rohan']);
  space('s-couple', 'couple', 'Aarav & Meera', 'heart', 'rose', 'u-aarav', ['u-meera']);
  space('s-trek', 'friends', 'Weekend Trekkers', 'leaf', 'teal', 'u-kabir', []);

  t.space_invites.push({ id: 'inv-family', space_id: 's-family', token: 'demo-family-invite', created_by: 'u-aarav', created_at: at(-2), expires_at: at(12), revoked_at: null });
  t.space_invites.push({ id: 'inv-trek', space_id: 's-trek', token: 'demo-trek-invite', created_by: 'u-kabir', created_at: at(-2), expires_at: at(12), revoked_at: null });
  t.join_requests.push({ id: 'jr-1', space_id: 's-trek', invite_id: 'inv-trek', user_id: 'u-aarav', status: 'pending', created_at: at(-1), decided_by: null, decided_at: null });
  t.join_requests.push({ id: 'jr-2', space_id: 's-family', invite_id: 'inv-family', user_id: 'u-asha', status: 'pending', created_at: at(0, 8), decided_by: null, decided_at: null });

  // ---------------------------------------------------------------- tasks
  const task = (space_id, title, extra = {}) => t.tasks.push({
    id: id('task'), space_id, title, notes: null, due_date: null, due_time: null, assignee_id: null,
    created_by: 'u-aarav', created_at: created, completed_at: null, completed_by: null, ...extra,
  });
  task('s-my', 'Pay electricity bill', { due_date: day(0) });
  task('s-my', 'Call Dad', { due_date: day(0), due_time: '18:00' });
  task('s-my', 'Renew gym membership', { due_date: day(-3) });
  task('s-my', 'Book dentist appointment', { due_date: day(2) });
  task('s-my', 'Morning walk', { due_date: day(0), completed_at: at(0, 7), completed_by: 'u-aarav' });
  task('s-family', 'Pay house electricity bill', { due_date: day(0), assignee_id: 'u-raj' });
  task('s-family', 'Renew car insurance', { due_date: day(-2), assignee_id: 'u-raj' });
  task('s-family', 'Book plumber for kitchen tap', { due_date: day(1), assignee_id: 'u-aarav' });
  task('s-family', 'Riya’s parent–teacher meeting', { due_date: day(3), due_time: '16:30', assignee_id: 'u-sunita' });
  task('s-family', 'Call gas agency', { assignee_id: 'u-riya', completed_at: at(-1), completed_by: 'u-riya' });
  task('s-goa', 'Return Meera’s speaker', { due_date: day(0), assignee_id: 'u-aarav' });
  task('s-goa', 'Book Coorg homestay', { due_date: day(4), assignee_id: 'u-kabir' });
  task('s-couple', 'Plan anniversary dinner', { due_date: day(10) });

  // ---------------------------------------------------------------- shopping
  const item = (space_id, name, quantity, section, added_by, bought = false) => t.grocery_items.push({
    id: id('g'), space_id, name, quantity, section, added_by, created_at: created,
    purchased_at: bought ? at(0, 9) : null, purchased_by: bought ? 'u-aarav' : null,
  });
  item('s-family', 'Tomatoes', '1 kg', 'Fruits & veg', 'u-sunita');
  item('s-family', 'Bananas', '6', 'Fruits & veg', 'u-riya');
  item('s-family', 'Coriander', '1 bunch', 'Fruits & veg', 'u-sunita');
  item('s-family', 'Milk', '2 L', 'Dairy', 'u-aarav');
  item('s-family', 'Paneer', '200 g', 'Dairy', 'u-raj');
  item('s-family', 'Dish soap', '1', 'Household', 'u-raj');
  item('s-family', 'Onions', '2 kg', 'Fruits & veg', 'u-sunita', true);
  item('s-family', 'Basmati rice', '5 kg', 'Pantry', 'u-raj', true);
  item('s-my', 'Coffee beans', '250 g', 'Pantry', 'u-aarav');
  item('s-my', 'Oats', '1 kg', 'Pantry', 'u-aarav');
  item('s-goa', 'Sunscreen', '2', 'Household', 'u-diya');

  // ---------------------------------------------------------------- bills
  const bill = (space_id, title, rupees, due_date, recurrence = 'monthly', paid = false) => t.bills.push({
    id: id('bill'), space_id, title, amount_minor: rupees * 100, due_date, recurrence,
    paid_at: paid ? at(-3) : null, paid_by: paid ? 'u-aarav' : null, created_by: 'u-aarav', created_at: created,
  });
  bill('s-my', 'Electricity', 1280, day(0));
  bill('s-my', 'Internet', 799, day(4));
  bill('s-my', 'Rent', 18000, addMonths(startOfMonth(today), 1));
  bill('s-my', 'Mobile recharge', 399, day(-3), 'monthly', true);
  bill('s-family', 'Cooking gas', 903, day(2), 'none');
  bill('s-family', 'Water', 420, day(9), 'quarterly');
  bill('s-family', 'Society maintenance', 3500, day(12));
  bill('s-couple', 'Streaming subscription', 649, day(6));

  // ---------------------------------------------------------------- daily spending
  const spend = (space_id, title, rupees, category, n) => t.expenses.push({
    id: id('exp'), space_id, title, amount_minor: rupees * 100, category, spent_on: day(n), note: null, created_by: 'u-aarav', created_at: at(n),
  });
  spend('s-my', 'Weekly groceries', 2340, 'Groceries', -2);
  spend('s-my', 'Lunch', 240, 'Food & drink', 0);
  spend('s-my', 'Metro card top-up', 500, 'Transport', -1);
  spend('s-my', 'Movie night', 600, 'Fun', -5);
  spend('s-my', 'Pharmacy', 460, 'Health', -8);
  spend('s-my', 'Electricity', 1850, 'Utilities', -10);
  spend('s-my', 'Dinner out', 1200, 'Food & drink', -12);
  spend('s-my', 'Auto rides', 320, 'Transport', -15);
  spend('s-my', 'Groceries', 4100, 'Groceries', -35);
  spend('s-my', 'Utilities', 2100, 'Utilities', -40);
  spend('s-my', 'Dining out', 2600, 'Food & drink', -38);
  spend('s-family', 'Vegetables', 640, 'Groceries', -1);
  spend('s-family', 'Plumber visit', 450, 'Home', -6);

  // ---------------------------------------------------------------- events
  const event = (space_id, title, n, start_time = null, location = null) => t.events.push({
    id: id('ev'), space_id, title, starts_on: day(n), start_time, end_time: null, location, notes: null, created_by: 'u-aarav', created_at: created,
  });
  event('s-my', 'Dentist', 2, '10:30', 'Smile Clinic');
  event('s-family', 'Parent–teacher meeting', 3, '16:30', 'School');
  event('s-family', 'Nani’s birthday dinner', 5, '20:00');
  event('s-goa', 'Diya’s birthday dinner', 5, '20:00', 'Bandra');
  event('s-couple', 'Anniversary', 10);

  // ---------------------------------------------------------------- Split Bills
  t.split_groups.push({ id: 'g-goa', space_id: 's-goa', name: 'Goa Trip', kind: 'trip', starts_on: day(-9), ends_on: day(-5), description: null, created_by: 'u-aarav', created_at: at(-12) });
  t.split_groups.push({ id: 'g-bday', space_id: 's-goa', name: 'Diya’s birthday', kind: 'event', starts_on: day(5), ends_on: null, description: null, created_by: 'u-kabir', created_at: at(-2) });

  const shared = (group_id, title, rupees, paid_by, people, n, legacy = false) => {
    const eid = id('se');
    const amount = rupees * 100;
    t.split_expenses.push({
      id: eid, space_id: 's-goa', group_id, title, amount_minor: amount, paid_by, spent_on: day(n), method: 'equal',
      category: null, notes: null, legacy, client_request_id: null, created_by: paid_by, created_at: at(n), updated_at: at(n),
    });
    largestRemainder(amount, people.map(() => 1)).forEach((share, i) => {
      t.split_allocations.push({ expense_id: eid, user_id: people[i], share_minor: share, input_value: null });
    });
  };
  const all = ['u-aarav', 'u-diya', 'u-kabir', 'u-meera', 'u-rohan'];
  shared('g-goa', 'Villa, 4 nights', 12000, 'u-aarav', all, -9);
  shared('g-goa', 'Beach shack dinner', 1500, 'u-diya', ['u-aarav', 'u-diya', 'u-kabir'], -9);
  shared('g-goa', 'Scooter rentals', 2400, 'u-kabir', ['u-aarav', 'u-diya', 'u-kabir', 'u-meera'], -8);
  shared('g-goa', 'Cab to airport', 1800, 'u-meera', all, -5);
  shared(null, 'Pizza night', 1200, 'u-diya', ['u-aarav', 'u-diya', 'u-kabir', 'u-meera'], -60, true);
  shared(null, 'Movie tickets', 900, 'u-aarav', ['u-aarav', 'u-diya', 'u-rohan'], -50, true);
  t.split_settlements.push({
    id: id('pay'), space_id: 's-goa', group_id: null, from_user: 'u-kabir', to_user: 'u-diya', amount_minor: 30000,
    paid_on: day(-45), method: 'upi', note: null, legacy: true, client_request_id: null, recorded_by: 'u-kabir', created_at: at(-45),
  });

  // ---------------------------------------------------------------- health (private to the demo person)
  t.medicines.push({ id: 'med-1', user_id: 'u-aarav', name: 'Vitamin D3', dose: '1 tablet', times: ['08:00'], notes: null, active: true, created_at: created });
  t.medicines.push({ id: 'med-2', user_id: 'u-aarav', name: 'Iron', dose: '1 tablet', times: ['14:00'], notes: 'After lunch', active: true, created_at: created });
  t.medicines.push({ id: 'med-3', user_id: 'u-aarav', name: 'Magnesium', dose: '250 mg', times: ['21:30'], notes: null, active: true, created_at: created });
  t.medicine_doses.push({ medicine_id: 'med-1', user_id: 'u-aarav', dose_date: today, slot: '08:00', taken_at: at(0, 8, 10) });

  t.cycle_settings.push({ user_id: 'u-aarav', typical_cycle: 28, typical_period: 5, show_fertile: true, discreet: true, remind_days_before: 2, daily_checkin: false, updated_at: created });
  for (const back of [180, 151, 123, 96]) {
    t.cycle_periods.push({ id: id('cp'), user_id: 'u-aarav', start_date: day(-back), end_date: day(-back + 4), created_at: at(-back) });
  }
  for (const back of [67, 39, 11]) {
    t.cycle_periods.push({ id: id('cp'), user_id: 'u-aarav', start_date: day(-back), end_date: day(-back + 4), created_at: at(-back) });
    t.cycle_logs.push({ user_id: 'u-aarav', log_date: day(-back), flow: 'heavy', feelings: ['tired'], body: ['cramps'], note: null, updated_at: at(-back) });
    t.cycle_logs.push({ user_id: 'u-aarav', log_date: day(-back + 1), flow: 'medium', feelings: ['low'], body: ['cramps', 'bloating'], note: null, updated_at: at(-back + 1) });
    t.cycle_logs.push({ user_id: 'u-aarav', log_date: day(-back - 2), flow: 'none', feelings: ['irritable'], body: ['headache'], note: null, updated_at: at(-back - 2) });
  }

  // Meera chose to share her period dates and next-period estimate with Aarav in their couple space.
  for (const back of [60, 31, 3]) {
    t.cycle_periods.push({ id: id('cp'), user_id: 'u-meera', start_date: day(-back), end_date: day(-back + 4), created_at: at(-back) });
  }
  t.health_shares.push({
    id: 'hs-meera', owner_id: 'u-meera', grantee_id: 'u-aarav', space_id: 's-couple', scopes: ['period_dates', 'prediction'],
    created_at: at(-20), revoked_at: null, last_viewed_at: null,
  });

  return { version: 1, session: null, users: { ...PEOPLE }, tables: t };
}
