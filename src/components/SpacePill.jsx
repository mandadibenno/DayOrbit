import { useSpace } from '../context/SpaceContext.jsx';
import { useShell } from '../context/ShellContext.js';
import Icon from './Icon.jsx';

export function spaceSubtitle(space) {
  if (!space) return '';
  if (space.type === 'personal') return 'Only you can see this';
  const n = Number(space.member_count) || 1;
  return n === 1 ? 'Just you so far' : `Shared with ${n} people`;
}

/** Always shows where you are and who can see it. Tap to switch space. */
export default function SpacePill({ onHero = false }) {
  const { space } = useSpace();
  const { openSwitcher } = useShell();
  if (!space) return null;
  const sub = spaceSubtitle(space);
  return (
    <button
      type="button"
      className={`space-pill ${onHero ? 'space-pill--hero' : ''}`}
      onClick={openSwitcher}
      aria-label={`You are in ${space.name}. ${sub}. Switch space`}
    >
      <span className="space-pill__tile" aria-hidden="true"><Icon name={space.icon} size={20} /></span>
      <span className="grow">
        <span className="space-pill__name">{space.name}</span>
        <span className="space-pill__sub">
          <Icon name={space.type === 'personal' ? 'lock' : 'users'} size={12} stroke={2.4} />
          {sub}
        </span>
      </span>
      <span className="space-pill__switch" aria-hidden="true">Switch <Icon name="chevronDown" size={16} stroke={2.4} /></span>
    </button>
  );
}
