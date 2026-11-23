// Space types, colours, icons and features. Kept in sync with 0003_functions.sql.

export const SPACE_TYPES = {
  personal: { label: 'My Space', icon: 'user', color: 'indigo', blurb: 'Just for you. Nobody else can see it.' },
  family: { label: 'Family', icon: 'home', color: 'honey', blurb: 'Shopping, chores and bills at home' },
  friends: { label: 'Friends', icon: 'users', color: 'teal', blurb: 'Trips, plans and splitting costs' },
  couple: { label: 'Couple', icon: 'heart', color: 'rose', blurb: 'Plans and money for the two of you' },
  office: { label: 'Office', icon: 'briefcase', color: 'slate', blurb: 'Team to-dos and reminders' },
  custom: { label: 'Something else', icon: 'star', color: 'plum', blurb: 'Pick your own name and features' },
};

export const SHARED_TYPES = ['family', 'friends', 'couple', 'office', 'custom'];

export const COLORS = [
  { id: 'indigo', label: 'Indigo', hex: '#4B4FD8' },
  { id: 'honey', label: 'Honey', hex: '#8A5A00' },
  { id: 'teal', label: 'Teal', hex: '#0F7B6C' },
  { id: 'rose', label: 'Rose', hex: '#B8335E' },
  { id: 'slate', label: 'Slate', hex: '#34588F' },
  { id: 'plum', label: 'Plum', hex: '#7A3FB8' },
];

export const SPACE_ICONS = ['home', 'users', 'heart', 'briefcase', 'star', 'user', 'leaf', 'sun', 'paw', 'pin'];

export const FEATURES = [
  { key: 'tasks', label: 'To-dos', blurb: 'Things to do, with due dates' },
  { key: 'shopping', label: 'Shopping', blurb: 'A list everyone can tick' },
  { key: 'bills', label: 'Bills', blurb: 'Payments coming up' },
  { key: 'expenses', label: 'Spending', blurb: 'Money already spent' },
  { key: 'calendar', label: 'Calendar', blurb: 'Events and dates' },
  { key: 'split', label: 'Split costs', blurb: 'Share costs, see who owes who' },
  { key: 'health', label: 'Health', blurb: 'Medicines and cycle — private' },
];

export function featureKeysFor(type) {
  return type === 'personal'
    ? ['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'health']
    : ['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'split'];
}

export const DEFAULT_FEATURES = {
  personal: ['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'health'],
  family: ['tasks', 'shopping', 'bills', 'expenses', 'calendar'],
  couple: ['tasks', 'shopping', 'bills', 'expenses', 'calendar', 'split'],
  friends: ['tasks', 'shopping', 'calendar', 'split'],
  office: ['tasks', 'calendar', 'expenses'],
  custom: ['tasks', 'shopping', 'calendar'],
};

export const EXPENSE_CATEGORIES = ['Groceries', 'Food & drink', 'Transport', 'Utilities', 'Home', 'Health', 'Shopping', 'Fun', 'Other'];

export const PAY_METHODS = [
  { id: 'upi', label: 'UPI' },
  { id: 'cash', label: 'Cash' },
  { id: 'bank', label: 'Bank' },
  { id: 'other', label: 'Other' },
];

// A bright, stable colour per person (same colour everywhere for the same person).
const PERSON_COLORS = [
  ['#9B8CFF', '#1E1A5C'],
  ['#FF8FB1', '#5A1430'],
  ['#34C796', '#06382A'],
  ['#FFC83D', '#4A3200'],
  ['#7CC4FF', '#0E2F57'],
  ['#FF9F7A', '#5A2210'],
];

export function personColor(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const [bg, fg] = PERSON_COLORS[h % PERSON_COLORS.length];
  return { bg, fg };
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
