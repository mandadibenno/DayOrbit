import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomSheet from './BottomSheet.jsx';
import Icon from './Icon.jsx';
import Orbi from './Orbi.jsx';
import { useSpace } from '../context/SpaceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import * as api from '../lib/api.js';
import { addDays, formatShort, todayISO } from '../lib/dates.js';
import { friendlyError } from '../lib/errors.js';
import { parseItem, guessSection } from '../lib/groceries.js';
import { parseRupees } from '../lib/money.js';
import { EXPENSE_CATEGORIES } from '../lib/spaceTypes.js';
import { spaceSubtitle } from './SpacePill.jsx';

const TYPES = {
  todo: { label: 'To-do', blurb: 'Something to do', icon: 'list', tone: 'lavender', feature: 'tasks', title: 'New to-do', ask: 'What do you need to do?', cta: 'Add to-do' },
  shopping: { label: 'Shopping', blurb: 'Something to buy', icon: 'bag', tone: 'butter', feature: 'shopping', title: 'Shopping item', ask: 'What do you need to buy?', cta: 'Add to list' },
  spent: { label: 'Money spent', blurb: 'Already paid for', icon: 'wallet', tone: 'mint', feature: 'expenses', title: 'Money spent', ask: 'What did you pay for?', cta: 'Save' },
  bill: { label: 'Bill to pay', blurb: 'Rent, power… due later', icon: 'receipt', tone: 'peach', feature: 'bills', title: 'Bill to pay', ask: 'Which bill?', cta: 'Add bill' },
  event: { label: 'Event', blurb: 'Something on a date', icon: 'calendar', tone: 'sky', feature: 'calendar', title: 'New event', ask: 'What’s happening?', cta: 'Add event' },
  split: { label: 'Split a cost', blurb: 'Share it with people', icon: 'users', tone: 'blush', feature: 'split', sharedOnly: true, title: 'Split a cost', ask: '', cta: 'Continue' },
};
const CAT_GUESS = [
  [/grocer|vegetable|fruit|milk|supermarket|kirana/i, 'Groceries'],
  [/lunch|dinner|breakfast|coffee|tea|snack|restaurant|cafe|food|swiggy|zomato/i, 'Food & drink'],
  [/cab|uber|ola|auto|metro|bus|train|fuel|petrol|parking|taxi/i, 'Transport'],
  [/electric|water|gas|internet|wifi|mobile|recharge|bill/i, 'Utilities'],
  [/medicine|pharmacy|doctor|clinic|hospital/i, 'Health'],
  [/movie|game|concert|party/i, 'Fun'],
];

export default function QuickAdd({ open, initialType, onClose, onSaved }) {
  const { space, has, isPersonal, activeMembers } = useSpace();
  const toast = useToast();
  const navigate = useNavigate();
  const [type, setType] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [groups, setGroups] = useState(null);

  useEffect(() => {
    if (open) { setType(initialType || null); setForm({ when: 'today', recurrence: 'monthly' }); setError(''); }
  }, [open, initialType]);

  useEffect(() => {
    if (open && type === 'split' && space) {
      setGroups(null);
      api.listGroups(space.id).then(setGroups).catch(() => setGroups([]));
    }
  }, [open, type, space]);

  if (!space) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const types = Object.entries(TYPES).filter(([, t]) => has(t.feature) && !(t.sharedOnly && isPersonal));
  const t = type ? TYPES[type] : null;
  const dateFor = () => (form.when === 'tomorrow' ? addDays(todayISO(), 1) : form.when === 'pick' ? form.date || todayISO() : todayISO());

  async function save(e) {
    e.preventDefault();
    setError('');
    const title = (form.title || '').trim();
    if (type !== 'split' && !title) { setError('Add a few words first.'); return; }
    const amount = parseRupees(form.amount);
    if ((type === 'spent' || type === 'bill') && !(amount > 0)) { setError('Type an amount above ₹0.'); return; }
    if (type === 'split') {
      if (!form.groupId) { setError('Pick a trip or event first.'); return; }
      onClose();
      navigate(`/money/group/${form.groupId}/add`);
      return;
    }
    setBusy(true);
    try {
      if (type === 'todo') {
        await api.addTask(space.id, { title, due_date: form.when === 'none' ? null : dateFor(), due_time: form.time || null, assignee_id: form.assignee || null });
      } else if (type === 'shopping') {
        const parsed = parseItem(title);
        await api.addGrocery(space.id, { name: parsed.name, quantity: form.quantity?.trim() || parsed.quantity, section: guessSection(parsed.name) });
      } else if (type === 'spent') {
        const category = form.category || CAT_GUESS.find(([re]) => re.test(title))?.[1] || 'Other';
        await api.addExpense(space.id, { title, amount_minor: amount, category, spent_on: todayISO() });
      } else if (type === 'bill') {
        await api.addBill(space.id, { title, amount_minor: amount, due_date: form.due || addDays(todayISO(), 7), recurrence: form.recurrence || 'none' });
      } else if (type === 'event') {
        await api.addEvent(space.id, { title, starts_on: dateFor(), start_time: form.time || null, location: form.place?.trim() || null });
      }
      toast(`Added to ${space.name}`);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const whenChips = (
    <div className="field">
      <p className="label">When?</p>
      <div className="chips" role="radiogroup" aria-label="When">
        {[['today', 'Today'], ['tomorrow', 'Tomorrow'], ['pick', 'Pick a date'], ...(type === 'todo' ? [['none', 'No date']] : [])].map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={form.when === v} className="chip chip--dark" onClick={() => set({ when: v })}>{l}</button>
        ))}
      </div>
      {form.when === 'pick' && (
        <input className="input" type="date" aria-label="Date" style={{ marginTop: 10 }} value={form.date || todayISO()} onChange={(e) => set({ date: e.target.value })} />
      )}
    </div>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title={t ? t.title : 'What do you want to add?'}>
      {!t && (
        <div className="stack">
          <div style={{ position: 'absolute', right: 70, top: -46 }}><Orbi size={70} outline /></div>
          <div className="dest-chip">
            <span className="space-pill__tile" style={{ width: 36, height: 36 }}><Icon name={space.icon} size={18} /></span>
            <span className="grow small bold">Adding to {space.name} <span style={{ color: 'var(--space-ink)' }}>· {isPersonal ? 'only you' : spaceSubtitle(space).toLowerCase()}</span></span>
          </div>
          <div className="qa-grid">
            {types.map(([key, item]) => (
              <button key={key} type="button" className={`qa-tile bg-${item.tone}`} onClick={() => setType(key)}>
                <span className={`qa-tile__icon ink-${item.tone}`}><Icon name={item.icon} size={22} stroke={2.2} /></span>
                <span>
                  <span className="qa-tile__name">{item.label}</span>
                  <span className={`qa-tile__blurb ink-${item.tone}`}>{item.blurb}</span>
                </span>
              </button>
            ))}
          </div>
          {isPersonal && has('expenses') && (
            <p className="notice"><Icon name="info" size={16} />Sharing a cost with friends or family? Switch to that space and choose “Split a cost”.</p>
          )}
        </div>
      )}

      {t && (
        <form className="stack" onSubmit={save} noValidate>
          <div className={`dest-chip bg-${t.tone}`} style={{ borderColor: 'transparent' }}>
            <span className={`qa-tile__icon ink-${t.tone}`}><Icon name={t.icon} size={20} /></span>
            <span className="grow small bold">
              {isPersonal ? 'My Space · only you can see it' : `${space.name} · ${spaceSubtitle(space).toLowerCase()}`}
            </span>
            <button type="button" className="link-btn" onClick={() => setType(null)}>Change</button>
          </div>

          {type !== 'split' && (
            <div className="field">
              <label className="label" htmlFor="qa-title">{t.ask}</label>
              <input id="qa-title" className="input" autoFocus value={form.title || ''} onChange={(e) => set({ title: e.target.value })}
                placeholder={type === 'shopping' ? 'e.g. Milk 2 L' : type === 'spent' ? 'e.g. Lunch' : type === 'bill' ? 'e.g. Electricity' : ''} />
              {type === 'shopping' && <p className="help">Add the amount after the name, like “Eggs 12”.</p>}
            </div>
          )}

          {(type === 'spent' || type === 'bill') && (
            <div className="field">
              <label className="label" htmlFor="qa-amount">Amount</label>
              <div className="amount-input"><span aria-hidden="true">₹</span>
                <input id="qa-amount" inputMode="decimal" value={form.amount || ''} onChange={(e) => set({ amount: e.target.value })} placeholder="0" />
              </div>
            </div>
          )}

          {type === 'spent' && (
            <div className="field">
              <p className="label">Category <span className="muted">(we’ll guess if you skip)</span></p>
              <div className="chips">
                {EXPENSE_CATEGORIES.map((c) => (
                  <button key={c} type="button" className="chip chip--sm" aria-pressed={form.category === c} onClick={() => set({ category: form.category === c ? null : c })}>{c}</button>
                ))}
              </div>
              <p className="notice" style={{ marginTop: 12 }}><Icon name="info" size={16} />Only for money you already paid. Still to pay? Use “Bill to pay”.</p>
            </div>
          )}

          {type === 'bill' && (
            <>
              <div className="field">
                <label className="label" htmlFor="qa-due">Due on</label>
                <input id="qa-due" className="input" type="date" value={form.due || addDays(todayISO(), 7)} onChange={(e) => set({ due: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor="qa-rec">Repeats</label>
                <select id="qa-rec" className="select" value={form.recurrence} onChange={(e) => set({ recurrence: e.target.value })}>
                  <option value="none">Doesn’t repeat</option>
                  <option value="weekly">Every week</option>
                  <option value="monthly">Every month</option>
                  <option value="quarterly">Every 3 months</option>
                  <option value="yearly">Every year</option>
                </select>
              </div>
            </>
          )}

          {(type === 'todo' || type === 'event') && whenChips}

          {(type === 'todo' || type === 'event') && (
            <div className="field">
              <label className="label" htmlFor="qa-time">Time <span className="muted">(optional)</span></label>
              <input id="qa-time" className="input" type="time" value={form.time || ''} onChange={(e) => set({ time: e.target.value })} />
            </div>
          )}

          {type === 'todo' && !isPersonal && activeMembers.length > 1 && (
            <div className="field">
              <label className="label" htmlFor="qa-who">Who’s doing it? <span className="muted">(optional)</span></label>
              <select id="qa-who" className="select" value={form.assignee || ''} onChange={(e) => set({ assignee: e.target.value })}>
                <option value="">Anyone</option>
                {activeMembers.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
              </select>
            </div>
          )}

          {type === 'event' && (
            <div className="field">
              <label className="label" htmlFor="qa-place">Where? <span className="muted">(optional)</span></label>
              <input id="qa-place" className="input" value={form.place || ''} onChange={(e) => set({ place: e.target.value })} />
            </div>
          )}

          {type === 'split' && (
            <div className="field">
              <p className="label">Which trip or event is it for?</p>
              {groups === null && <div className="spinner" role="status" aria-label="Loading" />}
              {groups?.length === 0 && <p className="help">No trips or events yet. Create one in Money first.</p>}
              <div className="chips">
                {(groups || []).map((g) => (
                  <button key={g.id} type="button" role="radio" aria-checked={form.groupId === g.id} className="chip chip--dark" onClick={() => set({ groupId: g.id })}>
                    {g.name}{g.starts_on ? ` · ${formatShort(g.starts_on)}` : ''}
                  </button>
                ))}
              </div>
              {groups?.length === 0 && (
                <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 12 }} onClick={() => { onClose(); navigate('/money?tab=split&new=1'); }}>
                  <Icon name="plus" size={18} /> New trip or event
                </button>
              )}
            </div>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Saving…' : t.cta}</button>
        </form>
      )}
    </BottomSheet>
  );
}
