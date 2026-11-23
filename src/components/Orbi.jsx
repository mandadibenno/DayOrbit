// Orbi — DayOrbit's little planet mascot. Always decorative; words carry the meaning.
// moods: hello | hooray | sleepy | thinking
export default function Orbi({ mood = 'hello', size = 96, outline = false, float = false, className = '' }) {
  const body = (
    <>
      <circle cx="80" cy="70" r="34" fill="#8C86FF" stroke={outline ? '#FFFFFF' : 'none'} strokeWidth="3" />
      <circle cx="67" cy="55" r="8" fill="#FFFFFF" fillOpacity="0.3" />
      <circle cx="60" cy="80" r="4.6" fill="#FF8FB1" fillOpacity="0.85" />
      <circle cx="100" cy="80" r="4.6" fill="#FF8FB1" fillOpacity="0.85" />
    </>
  );
  const ringBack = <path d="M28 78 A52 15 0 0 1 132 78" fill="none" stroke="#FFC83D" strokeWidth="7" strokeLinecap="round" />;
  const ringFront = <path d="M28 78 A52 15 0 0 0 132 78" fill="none" stroke="#FFC83D" strokeWidth="7" strokeLinecap="round" />;

  let face;
  let extras = null;
  if (mood === 'hooray') {
    face = (
      <>
        <path d="M64 67q5-6 10 0M86 67q5-6 10 0" fill="none" stroke="#14161C" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M68 78q12 16 24 0z" fill="#14161C" />
      </>
    );
    extras = (
      <>
        <rect x="18" y="16" width="8" height="14" rx="2" fill="#FF7A59" transform="rotate(-20 22 23)" />
        <rect x="134" y="22" width="8" height="14" rx="2" fill="#34C796" transform="rotate(25 138 29)" />
        <rect x="40" y="6" width="6" height="11" rx="2" fill="#7CC4FF" transform="rotate(15 43 11)" />
        <rect x="112" y="4" width="6" height="11" rx="2" fill="#FF8FB1" transform="rotate(-30 115 9)" />
        <circle cx="28" cy="116" r="4" fill="#7CC4FF" />
        <circle cx="134" cy="112" r="4" fill="#FF7A59" />
      </>
    );
  } else if (mood === 'sleepy') {
    face = (
      <>
        <path d="M63 70q6 5 12 0M85 70q6 5 12 0" fill="none" stroke="#14161C" strokeWidth="3.2" strokeLinecap="round" />
        <ellipse cx="80" cy="84" rx="4" ry="3" fill="#14161C" />
      </>
    );
    extras = (
      <>
        <text x="112" y="34" fontFamily="Bricolage Grotesque, sans-serif" fontSize="22" fontWeight="800" fill="#7CC4FF">z</text>
        <text x="128" y="20" fontFamily="Bricolage Grotesque, sans-serif" fontSize="16" fontWeight="800" fill="#7CC4FF">z</text>
      </>
    );
  } else if (mood === 'thinking') {
    face = (
      <>
        <ellipse cx="71" cy="68" rx="4.6" ry="6" fill="#14161C" />
        <ellipse cx="93" cy="68" rx="4.6" ry="6" fill="#14161C" />
        <circle cx="73.4" cy="64" r="1.8" fill="#FFFFFF" />
        <circle cx="95.4" cy="64" r="1.8" fill="#FFFFFF" />
        <path d="M73 84h14" fill="none" stroke="#14161C" strokeWidth="3.2" strokeLinecap="round" />
      </>
    );
    extras = <circle cx="140" cy="44" r="7" fill="#FFC83D" />;
  } else {
    face = (
      <>
        <ellipse cx="69" cy="70" rx="4.6" ry="6" fill="#14161C" />
        <ellipse cx="91" cy="70" rx="4.6" ry="6" fill="#14161C" />
        <circle cx="70.6" cy="67.6" r="1.7" fill="#FFFFFF" />
        <circle cx="92.6" cy="67.6" r="1.7" fill="#FFFFFF" />
        <path d="M71 81 Q80 90 89 81" fill="none" stroke="#14161C" strokeWidth="3.2" strokeLinecap="round" />
      </>
    );
    extras = <circle cx="128" cy="28" r="6" fill="#FFC83D" />;
  }

  return (
    <svg width={size} height={size * 0.875} viewBox="0 0 160 140" aria-hidden="true" className={`${float ? 'float' : ''} ${className}`}>
      {extras}
      {ringBack}
      {body}
      {face}
      {ringFront}
    </svg>
  );
}
