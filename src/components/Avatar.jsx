import { initials, personColor } from '../lib/spaceTypes.js';

export function Avatar({ id, name, size = 36, title }) {
  const { bg, fg } = personColor(id || name || '');
  return (
    <span
      className="avatar"
      title={title || name}
      aria-hidden={title ? undefined : true}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: bg, color: fg }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people = [], max = 5, size = 30, ring, label }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="avatar-stack" role="img" aria-label={label || people.map((p) => p.name).join(', ')} style={ring ? { '--ring': ring } : undefined}>
      {shown.map((p) => <Avatar key={p.id} id={p.id} name={p.name} size={size} />)}
      {extra > 0 && (
        <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
          +{extra}
        </span>
      )}
    </span>
  );
}
