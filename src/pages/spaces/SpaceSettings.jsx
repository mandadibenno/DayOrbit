import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import BottomSheet from '../../components/BottomSheet.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { LoadError, SwitchRow } from '../../components/Controls.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSpace } from '../../context/SpaceContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useLoad } from '../../hooks/useLoad.js';
import * as api from '../../lib/api.js';
import { diffDays, formatShort, todayISO } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { COLORS, FEATURES, SPACE_ICONS, SPACE_TYPES, featureKeysFor } from '../../lib/spaceTypes.js';
import { spaceSubtitle } from '../../components/SpacePill.jsx';

const hexOf = (id) => COLORS.find((c) => c.id === id)?.hex || '#4B4FD8';

export default function SpaceSettings() {
  const { user } = useAuth();
  const { space, spaces, members, activeMembers, features, isOwner, isPersonal, refreshDetails, refreshSpaces, switchTo } = useSpace();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const justCreated = params.get('new') === '1';
  const [link, setLink] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: 'remove' | 'owner' | 'leave' | 'delete', member? }
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [memberMenu, setMemberMenu] = useState(null);

  const shared = !isPersonal;
  const manage = shared && isOwner;
  const { data: invites, reload: reloadInvites } = useLoad(() => (manage ? api.listInvites(space.id) : []), [space.id, manage]);
  const { data: requests, error: reqError, reload: reloadRequests } = useLoad(() => (manage ? api.listJoinRequests(space.id) : []), [space.id, manage]);

  useEffect(() => { setLink(null); setEditing(false); }, [space.id]);
  useEffect(() => {
    if (justCreated) document.getElementById('invite')?.scrollIntoView({ block: 'start' });
  }, [justCreated]);

  const coupleFull = space.type === 'couple' && activeMembers.length >= 2;
  const activeInvites = (invites || []).filter((i) => new Date(i.expires_at) > new Date());
  const personal = spaces.find((s) => s.type === 'personal');

  async function run(action, message, after) {
    setBusy(true);
    try {
      await action();
      if (message) toast(message);
      setConfirm(null);
      await after?.();
    } catch (err) {
      toast(friendlyError(err), { tone: 'warn' });
    } finally {
      setBusy(false);
    }
  }

  async function newLink() {
    await run(async () => {
      const invite = await api.createInvite(space.id);
      setLink({ url: api.inviteLink(invite.token), expires: invite.expires_at });
      reloadInvites();
    });
  }

  async function copy(url) {
    try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast('Couldn’t copy. Press and hold the link to copy it.', { tone: 'warn' }); }
  }
  async function share(url) {
    try { await navigator.share({ title: `Join ${space.name} on DayOrbit`, text: `Join ${space.name} on DayOrbit`, url }); } catch { /* cancelled */ }
  }

  const afterLeaving = async () => {
    await refreshSpaces();
    if (personal) switchTo(personal.id);
    navigate('/home', { replace: true });
  };

  return (
    <div className="page">
      <div className="topbar">
        <Link className="back-btn" to="/menu"><Icon name="chevronLeft" size={20} stroke={2.4} /> Menu</Link>
      </div>
      <h1 className="page-title" style={{ marginTop: 12 }}>Space settings</h1>

      <section className="card row" style={{ marginTop: 16, minHeight: 0 }}>
        <span className="icon-tile icon-tile--lg" style={{ background: hexOf(space.color), color: '#fff' }}><Icon name={space.icon} size={24} /></span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="row__title" style={{ fontSize: 18, fontWeight: 800 }}>{space.name}</span>
          <span className="row__meta">{SPACE_TYPES[space.type]?.label} · {spaceSubtitle(space)}</span>
        </span>
        {manage && <button type="button" className="icon-btn" aria-label="Edit name, icon and colour" onClick={() => setEditing((e) => !e)}><Icon name="edit" size={20} /></button>}
      </section>

      {editing && <EditDetails onDone={() => setEditing(false)} />}

      {justCreated && shared && (
        <p className="notice notice--ok" role="status" style={{ marginTop: 14 }}><Icon name="check" size={16} stroke={2.6} />Your space is ready. Invite people with a link — you approve everyone who asks to join.</p>
      )}

      {isPersonal && (
        <p className="notice notice--private" style={{ marginTop: 14 }}><Icon name="lock" size={16} />My Space is just for you. To share things, create a shared space from the space switcher.</p>
      )}

      {manage && (
        <section id="invite" className="card" style={{ marginTop: 14, scrollMarginTop: 16 }} aria-labelledby="h-invite">
          <h2 id="h-invite" className="section-title" style={{ fontSize: 20 }}>Invite people</h2>
          {coupleFull ? (
            <p className="small muted bold" style={{ marginTop: 4 }}>A couple space has room for two people, and it’s full.</p>
          ) : (
            <>
              <p className="small muted bold" style={{ marginTop: 2 }}>Anyone with the link can ask to join. Nobody gets in until you approve them.</p>
              {link ? (
                <div className="stack-sm" style={{ marginTop: 12 }}>
                  <div className="input-row">
                    <input className="input" readOnly value={link.url} aria-label="Invite link" onFocus={(e) => e.target.select()} />
                  </div>
                  <div className="btn-row">
                    <button type="button" className="btn btn-primary" onClick={() => copy(link.url)}><Icon name="copy" size={18} /> Copy link</button>
                    {typeof navigator !== 'undefined' && navigator.share
                      ? <button type="button" className="btn btn-secondary" onClick={() => share(link.url)}><Icon name="share" size={18} /> Share</button>
                      : <button type="button" className="btn btn-secondary" onClick={newLink} disabled={busy}><Icon name="refresh" size={18} /> New link</button>}
                  </div>
                  <p className="tiny muted bold">Works for 14 days, until {formatShort(link.expires.slice(0, 10))}.</p>
                </div>
              ) : (
                <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={newLink} disabled={busy}><Icon name="link" size={18} /> Create invite link</button>
              )}
              {activeInvites.length > 0 && (
                <details style={{ marginTop: 12 }}>
                  <summary className="small bold" style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Active links · {activeInvites.length}</summary>
                  <ul className="list">
                    {activeInvites.map((i) => (
                      <li key={i.id} className="row" style={{ minHeight: 52 }}>
                        <Icon name="link" size={18} />
                        <span className="row__main">
                          <span className="row__title" style={{ fontSize: 14 }}>Made {formatShort(i.created_at.slice(0, 10))}</span>
                          <span className="row__meta">Expires in {Math.max(0, diffDays(i.expires_at.slice(0, 10), todayISO()))} days</span>
                        </span>
                        <button type="button" className="btn btn-sm btn-quiet" onClick={() => run(() => api.revokeInvite(i.id), 'Link turned off', reloadInvites)}>Turn off</button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </section>
      )}

      {manage && (requests?.length > 0 || reqError) && (
        <section className="card card--tight" style={{ marginTop: 14 }} aria-labelledby="h-requests">
          <div className="card-head"><h2 id="h-requests" className="section-title" style={{ fontSize: 20 }}>Asking to join</h2><span className="badge">{requests?.length || 0}</span></div>
          <LoadError error={reqError} onRetry={reloadRequests} />
          <ul className="list">
            {(requests || []).map((r) => (
              <li key={r.id} className="row">
                <Avatar id={r.user_id} name={r.display_name} size={38} />
                <span className="row__main">
                  <span className="row__title" style={{ fontSize: 15 }}>{r.display_name}</span>
                  <span className="row__meta">Asked {formatShort(r.created_at.slice(0, 10))}</span>
                </span>
                <button type="button" className="btn btn-sm btn-quiet" disabled={busy} onClick={() => run(() => api.decideJoinRequest(r.id, false), `Declined ${r.display_name}`, reloadRequests)}>Decline</button>
                <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => run(() => api.decideJoinRequest(r.id, true), `${r.display_name} joined ${space.name}`, async () => { reloadRequests(); await Promise.all([refreshDetails(), refreshSpaces()]); })}>Approve</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {shared && (
        <section className="card card--tight" style={{ marginTop: 14 }} aria-labelledby="h-members">
          <div className="card-head"><h2 id="h-members" className="section-title" style={{ fontSize: 20 }}>Members</h2><span className="small bold muted">{activeMembers.length}</span></div>
          <ul className="list">
            {activeMembers.map((m) => (
              <li key={m.user_id} className="row">
                <Avatar id={m.user_id} name={m.display_name} size={38} />
                <span className="row__main">
                  <span className="row__title" style={{ fontSize: 15 }}>{m.display_name}{m.user_id === user.id ? ' (you)' : ''}</span>
                  <span className="row__meta">{m.role === 'owner' ? 'Owner' : 'Member'}{m.joined_at ? ` · joined ${formatShort(m.joined_at.slice(0, 10))}` : ''}</span>
                </span>
                {m.role === 'owner' && <Icon name="star" size={18} stroke={2.4} label="Owner" />}
                {isOwner && m.user_id !== user.id && (
                  <button type="button" className="icon-btn icon-btn--ghost icon-btn--sm" aria-label={`Options for ${m.display_name}`} onClick={() => setMemberMenu(m)}><Icon name="more" size={18} /></button>
                )}
              </li>
            ))}
          </ul>
          {members.some((m) => m.left_at) && <p className="tiny muted bold" style={{ paddingBottom: 10 }}>People who left still appear in old costs so balances stay correct.</p>}
        </section>
      )}

      <section className="card" style={{ marginTop: 14 }} aria-labelledby="h-features">
        <h2 id="h-features" className="section-title" style={{ fontSize: 20 }}>Features</h2>
        <p className="small muted bold">{isOwner ? 'Turning a feature off only hides it. Nothing is deleted.' : 'Only the owner can change these.'}</p>
        {FEATURES.filter((f) => featureKeysFor(space.type).includes(f.key)).map((f) => (
          <SwitchRow
            key={f.key}
            checked={!!features[f.key]}
            disabled={!isOwner || busy}
            label={f.label}
            sub={f.key === 'health' ? 'Medicines and cycle — always private to you' : f.blurb}
            onChange={(v) => run(() => api.setFeature(space.id, f.key, v), `${f.label} ${v ? 'on' : 'off'}`, refreshDetails)}
          />
        ))}
      </section>

      {shared && (
        <section className="card stack-sm" style={{ marginTop: 14 }}>
          {!isOwner && <button type="button" className="btn btn-danger-text btn-block" onClick={() => setConfirm({ kind: 'leave' })}><Icon name="logout" size={18} /> Leave {space.name}</button>}
          {isOwner && activeMembers.length > 1 && <p className="small muted bold center">To leave, make someone else the owner first.</p>}
          {isOwner && <button type="button" className="btn btn-danger-text btn-block" onClick={() => setConfirm({ kind: 'delete' })}><Icon name="trash" size={18} /> Delete this space…</button>}
        </section>
      )}

      <BottomSheet open={!!memberMenu} onClose={() => setMemberMenu(null)} title={memberMenu?.display_name || 'Member'}>
        {memberMenu && (
          <div className="stack-sm">
            <button type="button" className="btn btn-secondary btn-block" onClick={() => { setConfirm({ kind: 'owner', member: memberMenu }); setMemberMenu(null); }}>
              <Icon name="star" size={18} /> Make owner
            </button>
            <button type="button" className="btn btn-danger-text btn-block" onClick={() => { setConfirm({ kind: 'remove', member: memberMenu }); setMemberMenu(null); }}>
              <Icon name="x" size={18} stroke={2.4} /> Remove from {space.name}
            </button>
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog open={confirm?.kind === 'remove'} title={`Remove ${confirm?.member?.display_name}?`} danger confirmLabel="Remove" busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api.removeMember(space.id, confirm.member.user_id), `${confirm.member.display_name} was removed`, () => Promise.all([refreshDetails(), refreshSpaces()]))}>
        <p>They lose access to {space.name} right away. Their past costs and payments stay, so balances remain correct. Any cycle sharing between you stops.</p>
      </ConfirmDialog>

      <ConfirmDialog open={confirm?.kind === 'owner'} title={`Make ${confirm?.member?.display_name} the owner?`} confirmLabel="Make owner" busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api.transferOwnership(space.id, confirm.member.user_id), `${confirm.member.display_name} is now the owner`, () => Promise.all([refreshDetails(), refreshSpaces()]))}>
        <p>The owner invites and removes people, changes features and can delete the space. You’ll become a member.</p>
      </ConfirmDialog>

      <ConfirmDialog open={confirm?.kind === 'leave'} title={`Leave ${space.name}?`} danger confirmLabel="Leave" busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api.leaveSpace(space.id), `You left ${space.name}`, afterLeaving)}>
        <p>You won’t see this space any more. Your past costs stay so everyone’s balances remain correct. You’d need a new invite to come back.</p>
      </ConfirmDialog>

      <ConfirmDialog open={confirm?.kind === 'delete'} title={`Delete ${space.name}?`} danger requireText={space.name} confirmLabel="Delete for everyone" busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(() => api.deleteSpace(space.id, space.name), `${space.name} was deleted`, afterLeaving)}>
        <p>This deletes every list, bill, event, trip and cost in {space.name} for all {activeMembers.length} {activeMembers.length === 1 ? 'member' : 'members'}. It can’t be undone. Everyone’s My Space is not affected.</p>
      </ConfirmDialog>
    </div>
  );
}

function EditDetails({ onDone }) {
  const { space, refreshSpaces } = useSpace();
  const toast = useToast();
  const [name, setName] = useState(space.name);
  const [icon, setIcon] = useState(space.icon);
  const [color, setColor] = useState(space.color);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Add a name.'); return; }
    setBusy(true);
    try {
      await api.updateSpace(space.id, { name: name.trim(), icon, color });
      await refreshSpaces();
      toast('Saved');
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" style={{ marginTop: 14 }} onSubmit={save} noValidate>
      <div className="field">
        <label className="label" htmlFor="sp-name">Name</label>
        <input id="sp-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <p className="label">Icon</p>
        <div className="choice-grid" role="radiogroup" aria-label="Icon">
          {SPACE_ICONS.map((i) => <button key={i} type="button" role="radio" aria-checked={icon === i} aria-label={i} className="icon-choice" onClick={() => setIcon(i)}><Icon name={i} size={21} /></button>)}
        </div>
      </div>
      <div className="field">
        <p className="label">Colour</p>
        <div className="chips" role="radiogroup" aria-label="Colour">
          {COLORS.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={color === c.id} aria-label={c.label} className="swatch" style={{ background: c.hex }} onClick={() => setColor(c.id)}>
              {color === c.id && <Icon name="check" size={18} stroke={3} />}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn btn-secondary" onClick={onDone}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}
