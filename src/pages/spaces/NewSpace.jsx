import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { useSpace } from '../../context/SpaceContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as api from '../../lib/api.js';
import { friendlyError } from '../../lib/errors.js';
import { COLORS, DEFAULT_FEATURES, FEATURES, SHARED_TYPES, SPACE_ICONS, SPACE_TYPES, featureKeysFor } from '../../lib/spaceTypes.js';

const EXAMPLES = { family: 'e.g. Mehta Family', friends: 'e.g. Goa Gang', couple: 'e.g. Aarav & Meera', office: 'e.g. Design team', custom: 'e.g. Book club' };
const hexOf = (id) => COLORS.find((c) => c.id === id)?.hex || '#4B4FD8';

export default function NewSpace() {
  const [params, setParams] = useSearchParams();
  const type = SHARED_TYPES.includes(params.get('type')) ? params.get('type') : null;
  return type ? <SpaceForm type={type} onChangeType={() => setParams({})} /> : <PickType onPick={(t) => setParams({ type: t })} />;
}

function PickType({ onPick }) {
  return (
    <div className="page">
      <div className="topbar"><Link className="back-btn" to="/menu"><Icon name="chevronLeft" size={20} stroke={2.4} /> Back</Link></div>
      <h1 className="page-title" style={{ marginTop: 12 }}>New space</h1>
      <p className="page-sub">Who is it for? Each space keeps its own lists, plans and money.</p>
      <ul className="list stack-sm" style={{ marginTop: 16 }}>
        {SHARED_TYPES.map((t) => {
          const info = SPACE_TYPES[t];
          return (
            <li key={t}>
              <button type="button" className="row row--button card card--flat" style={{ padding: '6px 14px 6px 8px', minHeight: 64 }} onClick={() => onPick(t)}>
                <span className="icon-tile" style={{ background: hexOf(info.color), color: '#fff' }}><Icon name={info.icon} size={21} /></span>
                <span className="row__main">
                  <span className="row__title" style={{ fontSize: 16, fontWeight: 800 }}>{info.label}</span>
                  <span className="row__meta">{info.blurb}</span>
                </span>
                <Icon name="chevronRight" size={16} />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="notice" style={{ marginTop: 16 }}><Icon name="lock" size={16} />Your My Space stays private. Nothing moves into a new space unless you add it there.</p>
    </div>
  );
}

function SpaceForm({ type, onChangeType }) {
  const info = SPACE_TYPES[type];
  const { refreshSpaces, switchTo } = useSpace();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(info.icon);
  const [color, setColor] = useState(info.color);
  const [features, setFeatures] = useState(DEFAULT_FEATURES[type] || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const keys = featureKeysFor(type);

  async function create(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Give your space a name.'); return; }
    setBusy(true);
    try {
      const space = await api.createSpace({ type, name: name.trim(), icon, color, features });
      const created = Array.isArray(space) ? space[0] : space;
      await refreshSpaces();
      switchTo(created.id);
      toast(`${created.name} is ready`);
      navigate('/spaces/settings?new=1', { replace: true });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="page" onSubmit={create} noValidate>
      <div className="topbar">
        <button type="button" className="back-btn" onClick={onChangeType}><Icon name="chevronLeft" size={20} stroke={2.4} /> Type</button>
      </div>
      <h1 className="page-title" style={{ marginTop: 12 }}>New {info.label.toLowerCase()} space</h1>
      <p className="page-sub">{info.blurb}.</p>

      <section className="card row" style={{ marginTop: 16, minHeight: 0 }} aria-label="Preview">
        <span className="icon-tile icon-tile--lg" style={{ background: hexOf(color), color: '#fff' }}><Icon name={icon} size={24} /></span>
        <span className="grow">
          <span className="row__title" style={{ fontSize: 18, fontWeight: 800 }}>{name.trim() || 'Your space'}</span>
          <span className="row__meta"><Icon name="users" size={12} stroke={2.4} /> Just you so far · invite people next</span>
        </span>
      </section>

      <section className="card stack" style={{ marginTop: 14 }}>
        <div className="field">
          <label className="label" htmlFor="ns-name">Name</label>
          <input id="ns-name" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={EXAMPLES[type]} autoFocus />
        </div>
        <div className="field">
          <p className="label">Icon</p>
          <div className="choice-grid" role="radiogroup" aria-label="Icon">
            {SPACE_ICONS.map((i) => (
              <button key={i} type="button" role="radio" aria-checked={icon === i} aria-label={i} className="icon-choice" onClick={() => setIcon(i)}><Icon name={i} size={21} /></button>
            ))}
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
      </section>

      <section className="card" style={{ marginTop: 14 }} aria-labelledby="ns-features">
        <h2 id="ns-features" className="section-title" style={{ fontSize: 20 }}>What will you use it for?</h2>
        <p className="small muted bold" style={{ marginBottom: 10 }}>You can change this any time.</p>
        <div className="feature-grid">
          {FEATURES.filter((f) => keys.includes(f.key)).map((f) => {
            const on = features.includes(f.key);
            return (
              <button key={f.key} type="button" role="switch" aria-checked={on} className="feature-tile" onClick={() => setFeatures((list) => (on ? list.filter((k) => k !== f.key) : [...list, f.key]))}>
                <span className={`check__box check__box--square ${on ? 'check__box--on' : ''}`} aria-hidden="true">{on && <Icon name="check" size={14} stroke={3.2} />}</span>
                <span style={{ minWidth: 0, textAlign: 'left' }}>
                  <span className="bold" style={{ display: 'block', fontSize: 14 }}>{f.label}</span>
                  <span className="tiny muted" style={{ display: 'block', fontWeight: 600 }}>{f.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>
        {type === 'couple' && <p className="notice" style={{ marginTop: 12 }}><Icon name="heart" size={16} />A couple space has room for two. Health stays private unless you choose to share cycle dates.</p>}
      </section>

      {error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      <div className="sticky-footer">
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create space'}</button>
      </div>
    </form>
  );
}
