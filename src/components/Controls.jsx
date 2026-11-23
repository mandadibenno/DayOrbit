import Icon from './Icon.jsx';
import Orbi from './Orbi.jsx';

export function SwitchRow({ checked, onChange, label, sub, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch-row" disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="grow">
        <span className="row__title" style={{ fontSize: 15, fontWeight: 800 }}>{label}</span>
        {sub && <span className="row__meta">{sub}</span>}
      </span>
      <span className="switch" aria-hidden="true" />
    </button>
  );
}

/** Tabs (default) or a single-choice radio group. */
export function Segmented({ options, value, onChange, label, kind = 'tabs' }) {
  const tabs = kind === 'tabs';
  return (
    <div className="seg" role={tabs ? 'tablist' : 'radiogroup'} aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role={tabs ? 'tab' : 'radio'}
          aria-selected={tabs ? o.value === value : undefined}
          aria-checked={tabs ? undefined : o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ mood = 'sleepy', title, children, action }) {
  return (
    <div className="empty">
      <Orbi mood={mood} size={110} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function LoadError({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="notice notice--warn" role="alert">
      <Icon name="alert" size={18} />
      <span className="grow">We couldn’t load this. Check your connection and try again.</span>
      {onRetry && <button type="button" className="btn btn-sm btn-secondary" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Loading({ rows = 3 }) {
  return (
    <div className="stack-sm" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" style={{ height: 56 }} />)}
    </div>
  );
}

export function CheckButton({ checked, onClick, label, square = false }) {
  return (
    <button type="button" className="check" aria-pressed={checked} aria-label={label} onClick={onClick}>
      <span className={`check__box ${square ? 'check__box--square' : ''} ${checked ? 'check__box--on' : ''}`} aria-hidden="true">
        {checked && <Icon name="check" size={16} stroke={3.2} />}
      </span>
    </button>
  );
}

export function PageHeader({ back, backLabel = 'Back', title, sub, right }) {
  return (
    <>
      <div className="topbar">
        {back}
        <span className="grow" />
        {right}
      </div>
      {title && <h1 className="page-title" style={{ marginTop: 12 }}>{title}</h1>}
      {sub && <p className="page-sub">{sub}</p>}
    </>
  );
}
