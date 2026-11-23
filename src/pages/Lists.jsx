import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Orbi from '../components/Orbi.jsx';
import SpacePill from '../components/SpacePill.jsx';
import GroceryIcon from '../components/GroceryIcon.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { BagScene, Confetti, HeroDeco } from '../components/Illustrations.jsx';
import { CheckButton, EmptyState, LoadError, Loading, Segmented } from '../components/Controls.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSpace } from '../context/SpaceContext.jsx';
import { useShell } from '../context/ShellContext.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLoad } from '../hooks/useLoad.js';
import * as api from '../lib/api.js';
import { dueLabel, formatTime, todayISO } from '../lib/dates.js';
import { friendlyError } from '../lib/errors.js';
import { parseItem, guessSection, SECTIONS } from '../lib/groceries.js';

export default function Lists() {
  const { space, ready, has, isOwner } = useSpace();
  const [params, setParams] = useSearchParams();
  const tabs = [has('tasks') && { value: 'todo', label: 'To-do' }, has('shopping') && { value: 'shopping', label: 'Shopping' }].filter(Boolean);
  const tab = tabs.find((t) => t.value === params.get('tab'))?.value || tabs[0]?.value;

  return (
    <>
      <section className="hero" style={{ paddingBottom: 46 }}>
        <HeroDeco />
        <div className="hero__inner">
          <div className="topbar"><SpacePill onHero /></div>
          <div className="row" style={{ minHeight: 0, marginTop: 10 }}>
            <div className="grow">
              <h1>Lists</h1>
              <p className="small" style={{ marginTop: 2 }}>{space.type === 'personal' ? 'Only you can see these.' : 'Everyone in this space can tick these.'}</p>
            </div>
            <BagScene size={84} />
          </div>
          {tabs.length > 1 && (
            <div style={{ marginTop: 12 }}>
              <Segmented label="Which list" options={tabs} value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} />
            </div>
          )}
        </div>
      </section>
      <div className="page" style={{ paddingTop: 0 }}>
        {ready && !tabs.length && (
          <div className="card" style={{ marginTop: 16 }}>
            <EmptyState mood="sleepy" title="Lists are turned off here" action={isOwner && <Link className="btn btn-secondary" to="/spaces/settings">Open space settings</Link>}>
              Turning a feature off only hides it. Nothing was deleted.
            </EmptyState>
          </div>
        )}
        {tab === 'todo' && <TodoList />}
        {tab === 'shopping' && <ShoppingList />}
      </div>
    </>
  );
}

const sortOpen = (a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999') || (a.due_time || '99').localeCompare(b.due_time || '99') || a.created_at.localeCompare(b.created_at);

function useLive(table, spaceId, reload) {
  useEffect(() => api.subscribe(table, spaceId, reload), [table, spaceId, reload]);
}

function TodoList() {
  const { user } = useAuth();
  const { space, isPersonal, activeMembers, nameOf } = useSpace();
  const { dataVersion } = useShell();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [more, setMore] = useState(false);
  const [due, setDue] = useState('');
  const [assignee, setAssignee] = useState('');
  const [showDone, setShowDone] = useState(false);
  const { data: tasks, error, loading, reload, setData } = useLoad(() => api.listTasks(space.id), [space.id, dataVersion]);
  useLive('tasks', space.id, reload);

  const open = (tasks || []).filter((t) => !t.completed_at).sort(sortOpen);
  const done = (tasks || []).filter((t) => t.completed_at).sort((a, b) => b.completed_at.localeCompare(a.completed_at));

  async function add(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const row = await api.addTask(space.id, { title: title.trim(), due_date: due || null, assignee_id: assignee || null });
      setData((list) => [...(list || []), row]);
      setTitle(''); setDue(''); setAssignee('');
    } catch (err) { toast(friendlyError(err), { tone: 'warn' }); }
  }

  async function toggle(task) {
    const isDone = !task.completed_at;
    setData((list) => list.map((t) => (t.id === task.id ? { ...t, completed_at: isDone ? new Date().toISOString() : null } : t)));
    try {
      await api.setTaskDone(task.id, user.id, isDone);
      if (isDone) toast(`Done: ${task.title}`, { action: { label: 'Undo', onClick: () => toggle({ ...task, completed_at: 'now' }) } });
    } catch (err) { toast(friendlyError(err), { tone: 'warn' }); reload(); }
  }

  async function remove(task) {
    setData((list) => list.filter((t) => t.id !== task.id));
    try {
      await api.deleteTask(task.id);
      toast('To-do deleted', {
        action: {
          label: 'Undo',
          onClick: async () => {
            const { id, created_at, ...rest } = task;
            const row = await api.addTask(space.id, { ...rest, space_id: undefined });
            setData((list) => [...list, row]);
          },
        },
      });
    } catch (err) { toast(friendlyError(err), { tone: 'warn' }); reload(); }
  }

  return (
    <div className="stack" style={{ marginTop: -24, position: 'relative', zIndex: 2 }}>
      <form onSubmit={add} className="card" style={{ padding: 10 }}>
        <div className="input-row">
          <label className="sr-only" htmlFor="todo-new">Add a to-do</label>
          <input id="todo-new" className="input" placeholder="Add a to-do" value={title} onChange={(e) => setTitle(e.target.value)} style={{ border: 'none', boxShadow: 'none' }} />
          <button type="submit" className="icon-btn" aria-label="Add to-do" style={{ background: 'var(--primary-bg)', color: 'var(--primary-fg)', border: 'none' }} disabled={!title.trim()}>
            <Icon name="plus" size={22} stroke={2.6} />
          </button>
        </div>
        <button type="button" className="link-btn" aria-expanded={more} onClick={() => setMore((m) => !m)}>
          {more ? 'Fewer options' : 'Add a date or person'}
        </button>
        {more && (
          <div className="input-row" style={{ marginTop: 6 }}>
            <input className="input" type="date" aria-label="Due date" value={due} min={todayISO()} onChange={(e) => setDue(e.target.value)} />
            {!isPersonal && (
              <select className="select" aria-label="Who's doing it" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Anyone</option>
                {activeMembers.map((m) => <option key={m.user_id} value={m.user_id}>{m.user_id === user.id ? 'You' : m.display_name}</option>)}
              </select>
            )}
          </div>
        )}
      </form>

      <LoadError error={error} onRetry={reload} />
      {loading && !tasks && <Loading />}

      {tasks && (
        <section className="card card--tight" aria-label="To-dos">
          {open.length === 0 ? (
            <EmptyState mood="hooray" title="All clear">Nothing left to do. Add something above.</EmptyState>
          ) : (
            <ul className="list">
              {open.map((t) => {
                const d = dueLabel(t.due_date);
                const who = t.assignee_id && !isPersonal ? nameOf(t.assignee_id) : null;
                return (
                  <li key={t.id} className="row">
                    <CheckButton square checked={false} onClick={() => toggle(t)} label={`Mark done: ${t.title}`} />
                    <span className="row__main">
                      <span className="row__title">{t.title}</span>
                      <span className={`row__meta ${d.late ? 'late' : ''}`}>
                        {d.late && <Icon name="clock" size={14} stroke={2.4} />}
                        {[t.due_date ? d.text : 'No date', t.due_time ? formatTime(t.due_time) : null, who].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {who && <Avatar id={t.assignee_id} name={nameOf(t.assignee_id, { you: false })} size={30} />}
                    <button type="button" className="icon-btn icon-btn--ghost icon-btn--sm" aria-label={`Delete ${t.title}`} onClick={() => remove(t)}>
                      <Icon name="trash" size={18} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {done.length > 0 && (
        <section className="card card--tight">
          <button type="button" className="row row--button" aria-expanded={showDone} onClick={() => setShowDone((s) => !s)}>
            <Icon name="check" size={20} stroke={2.6} />
            <span className="row__main"><span className="row__title">Done <span className="muted">· {done.length}</span></span></span>
            <span className="small bold muted">{showDone ? 'Hide' : 'Show'}</span>
          </button>
          {showDone && (
            <ul className="list">
              {done.slice(0, 20).map((t) => (
                <li key={t.id} className="row">
                  <CheckButton square checked onClick={() => toggle(t)} label={`Mark not done: ${t.title}`} />
                  <span className="row__main">
                    <span className="row__title done-text">{t.title}</span>
                    {!isPersonal && t.completed_by && <span className="row__meta">Done by {nameOf(t.completed_by)} — thank you!</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function ShoppingList() {
  const { user } = useAuth();
  const { space, isPersonal, nameOf } = useSpace();
  const { dataVersion } = useShell();
  const toast = useToast();
  const [text, setText] = useState('');
  const [showCart, setShowCart] = useState(false);
  const { data: items, error, loading, reload, setData } = useLoad(() => api.listGroceries(space.id), [space.id, dataVersion]);
  useLive('grocery_items', space.id, reload);

  const open = (items || []).filter((i) => !i.purchased_at);
  const cart = (items || []).filter((i) => i.purchased_at);
  const total = (items || []).length;
  const pct = total ? (cart.length / total) * 100 : 0;
  const grouped = useMemo(() => SECTIONS.map((s) => ({ name: s, items: open.filter((i) => (i.section || 'Other') === s) })).filter((g) => g.items.length), [open]);

  async function add(e) {
    e.preventDefault();
    const { name, quantity } = parseItem(text);
    if (!name) return;
    try {
      const row = await api.addGrocery(space.id, { name, quantity, section: guessSection(name) });
      setData((list) => [...(list || []), row]);
      setText('');
    } catch (err) { toast(friendlyError(err), { tone: 'warn' }); }
  }

  async function setBought(item, bought) {
    setData((list) => list.map((i) => (i.id === item.id ? { ...i, purchased_at: bought ? new Date().toISOString() : null } : i)));
    try {
      await api.setPurchased(item.id, user.id, bought);
      if (bought) {
        const left = open.length - 1;
        toast(`${item.name} is in the cart${left > 0 ? ` · ${left} to go` : ''}`, { action: { label: 'Undo', onClick: () => setBought(item, false) } });
      }
    } catch (err) { toast(friendlyError(err), { tone: 'warn' }); reload(); }
  }

  async function remove(item) {
    setData((list) => list.filter((i) => i.id !== item.id));
    try { await api.deleteGrocery(item.id); } catch (err) { toast(friendlyError(err), { tone: 'warn' }); reload(); }
  }

  async function clearCart() {
    try {
      await api.clearPurchased(space.id);
      setData((list) => list.filter((i) => !i.purchased_at));
      toast('Cart cleared');
    } catch (err) { toast(friendlyError(err), { tone: 'warn' }); }
  }

  return (
    <div className="stack" style={{ marginTop: -24, position: 'relative', zIndex: 2 }}>
      <form onSubmit={add} className="card" style={{ padding: 10 }}>
        <div className="input-row">
          <label className="sr-only" htmlFor="shop-new">Add an item</label>
          <input id="shop-new" className="input" placeholder="Add an item, e.g. Eggs 12" value={text} onChange={(e) => setText(e.target.value)} style={{ border: 'none', boxShadow: 'none' }} />
          <button type="submit" className="icon-btn" aria-label="Add item" style={{ background: 'var(--primary-bg)', color: 'var(--primary-fg)', border: 'none' }} disabled={!text.trim()}>
            <Icon name="plus" size={22} stroke={2.6} />
          </button>
        </div>
      </form>

      <LoadError error={error} onRetry={reload} />
      {loading && !items && <Loading />}

      {items && (
        <section className="card" aria-label="Shopping list" style={{ position: 'relative', overflow: 'hidden' }}>
          {total > 0 && (
            <>
              <div className="row-between">
                <p className="bold">{cart.length} of {total} in the cart <span style={{ color: 'var(--space-ink)' }}>· {open.length === 0 ? 'all done!' : open.length === 1 ? 'just 1 to go!' : `${open.length} to go`}</span></p>
                {cart.length > 0 && <button type="button" className="btn btn-sm btn-secondary" aria-expanded={showCart} onClick={() => setShowCart((s) => !s)}>{showCart ? 'Hide cart' : 'See cart'}</button>}
              </div>
              <div className="cart-track" role="progressbar" aria-label="Items in the cart" aria-valuemin={0} aria-valuemax={total} aria-valuenow={cart.length}>
                <div className="cart-track__rail" />
                <div className="cart-track__fill" style={{ width: `${pct}%` }} />
                <span className="cart-track__cart" style={{ left: `calc(${pct}% - ${Math.round(pct * 0.3)}px)` }} aria-hidden="true"><Icon name="cart" size={15} stroke={2.4} /></span>
              </div>
            </>
          )}

          {showCart && cart.length > 0 && (
            <ul className="list" style={{ marginTop: 10, padding: '4px 12px', borderRadius: 16, background: 'var(--surface-2)' }}>
              {cart.map((i) => (
                <li key={i.id} className="row" style={{ minHeight: 48 }}>
                  <span className="row__main"><span className="row__title done-text" style={{ fontSize: 15 }}>{i.name}</span></span>
                  <button type="button" className="btn btn-sm btn-quiet" onClick={() => setBought(i, false)}>Put back</button>
                </li>
              ))}
              <li className="row" style={{ minHeight: 48 }}>
                <span className="row__main small muted bold">Bought everything in the cart?</span>
                <button type="button" className="btn btn-sm btn-secondary" onClick={clearCart}>Clear cart</button>
              </li>
            </ul>
          )}

          {total === 0 && <EmptyState mood="sleepy" title="The list is empty">Add the first thing you need above.</EmptyState>}

          {total > 0 && open.length === 0 && (
            <div className="center" role="status" style={{ position: 'relative', padding: '14px 0 6px' }}>
              <Confetti />
              <Orbi mood="hooray" size={120} />
              <p className="section-title" style={{ marginTop: 4 }}>Cart complete!</p>
              <p className="muted" style={{ fontWeight: 600 }}>{isPersonal ? 'Everything’s in the cart.' : 'Nice teamwork. Everything’s in the cart.'}</p>
              <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={clearCart}>Clear the cart</button>
            </div>
          )}

          {grouped.map((g) => (
            <div key={g.name}>
              <h2 className="eyebrow" style={{ marginTop: 14, color: 'var(--space-ink)' }}>{g.name}</h2>
              <ul className="list">
                {g.items.map((i) => (
                  <li key={i.id} className="row" style={{ minHeight: 56 }}>
                    <CheckButton checked={false} onClick={() => setBought(i, true)} label={`Put in the cart: ${i.name}${i.quantity ? `, ${i.quantity}` : ''}`} />
                    <GroceryIcon name={i.name} />
                    <span className="row__main">
                      <span className="row__title">{i.name}</span>
                      {!isPersonal && i.added_by && <span className="row__meta">Added by {nameOf(i.added_by)}</span>}
                    </span>
                    {i.quantity && <span className="badge badge--neutral tabular">{i.quantity}</span>}
                    <button type="button" className="icon-btn icon-btn--ghost icon-btn--sm" aria-label={`Remove ${i.name}`} onClick={() => remove(i)}>
                      <Icon name="x" size={16} stroke={2.4} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
