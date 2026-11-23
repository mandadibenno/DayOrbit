// Flat, rounded illustrations. All decorative (aria-hidden).

export function OrbitScene() {
  const planet = (x, y, bg, fg, icon, label) => (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-26" y="-26" width="52" height="52" rx="18" fill={bg} />
      <g transform="translate(-12 -12)" stroke={fg} strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round">{icon}</g>
      <text x="0" y="44" textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor" fontFamily="Plus Jakarta Sans, sans-serif">{label}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 342 340" width="100%" aria-hidden="true" style={{ maxWidth: 342, margin: '0 auto', color: 'var(--ink-2)' }}>
      <circle cx="171" cy="170" r="148" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="2 7" strokeLinecap="round" />
      <circle cx="171" cy="170" r="90" fill="none" stroke="var(--line)" strokeWidth="1.5" />
      <circle cx="171" cy="80" r="4" fill="#4B4FD8" />
      <circle cx="86" cy="139" r="3" fill="#0F7B6C" />
      <circle cx="256" cy="139" r="3" fill="#B8335E" />
      {planet(58, 75, '#FBF0D9', '#8A5A00', <path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" />, 'Family')}
      {planet(288, 79, '#DFF3EE', '#0F7B6C', <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></>, 'Friends')}
      {planet(37, 233, '#FBE7EE', '#B8335E', <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />, 'Couple')}
      {planet(299, 244, '#E5ECF6', '#34588F', <><rect x="3" y="7" width="18" height="13" rx="3" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 13h18" /></>, 'Office')}
      <rect x="115" y="114" width="112" height="112" rx="36" fill="var(--surface)" stroke="var(--line)" />
      <rect x="147" y="134" width="48" height="48" rx="16" fill="#4B4FD8" />
      <g transform="translate(159 146)" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></g>
      <text x="171" y="206" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--ink)" fontFamily="Plus Jakarta Sans, sans-serif">My Space</text>
    </svg>
  );
}

export function BeachScene({ height = 112, sway = true }) {
  return (
    <svg viewBox="0 0 358 112" preserveAspectRatio="xMidYMid slice" width="100%" height={height} aria-hidden="true">
      <rect width="358" height="112" fill="#CFEFFF" />
      <circle cx="292" cy="34" r="18" fill="#FFC83D" />
      <ellipse cx="200" cy="26" rx="22" ry="7" fill="#FFFFFF" />
      <ellipse cx="220" cy="20" rx="14" ry="7" fill="#FFFFFF" />
      <path d="M0 66 Q 30 58 60 66 T 120 66 T 180 66 T 240 66 T 300 66 T 360 66 V112 H0Z" fill="#2BB3A3" />
      <path d="M0 78 Q 30 70 60 78 T 120 78 T 180 78 T 240 78 T 300 78 T 360 78 V112 H0Z" fill="#5FD0C0" />
      <path d="M0 96 Q 110 84 220 94 T 360 90 V112 H0Z" fill="#FFE3A3" />
      <g style={sway ? { transformOrigin: '62px 100px', animation: 'sway 4s ease-in-out infinite' } : undefined}>
        <path d="M62 100 Q 68 70 60 44" fill="none" stroke="#8A5A00" strokeWidth="5" strokeLinecap="round" />
        <path d="M60 44 q -22 -8 -32 6 q 16 -4 32 -6z" fill="#2FA36B" />
        <path d="M60 44 q 22 -10 34 2 q -18 -2 -34 -2z" fill="#34C796" />
        <path d="M60 44 q -8 -20 -24 -22 q 12 8 24 22z" fill="#34C796" />
        <path d="M60 44 q 6 -22 22 -26 q -10 10 -22 26z" fill="#2FA36B" />
      </g>
      <path d="M230 98 V76" stroke="#14161C" strokeWidth="2" />
      <path d="M210 78 Q 230 58 250 78 Z" fill="#FF6B57" />
    </svg>
  );
}

export function PartyScene({ height = 112 }) {
  return (
    <svg viewBox="0 0 358 112" preserveAspectRatio="xMidYMid slice" width="100%" height={height} aria-hidden="true">
      <rect width="358" height="112" fill="#FFE3EC" />
      <path d="M150 62 q -4 22 2 50" fill="none" stroke="#B8335E" strokeWidth="1.4" />
      <ellipse cx="150" cy="42" rx="16" ry="20" fill="#FF6B57" />
      <path d="M184 54 q 4 24 -2 58" fill="none" stroke="#B8335E" strokeWidth="1.4" />
      <ellipse cx="184" cy="34" rx="16" ry="20" fill="#FFC83D" />
      <path d="M216 66 q -2 20 3 46" fill="none" stroke="#B8335E" strokeWidth="1.4" />
      <ellipse cx="216" cy="46" rx="16" ry="20" fill="#9B8CFF" />
      <rect x="60" y="24" width="8" height="14" rx="2" fill="#34C796" transform="rotate(-20 64 31)" />
      <rect x="290" y="30" width="8" height="14" rx="2" fill="#7CC4FF" transform="rotate(25 294 37)" />
      <circle cx="90" cy="80" r="4" fill="#FF8FB1" />
      <circle cx="270" cy="84" r="4" fill="#FFC83D" />
      <circle cx="40" cy="60" r="3" fill="#9B8CFF" />
    </svg>
  );
}

export function BagScene({ size = 88 }) {
  return (
    <svg width={size} height={size * 0.875} viewBox="0 0 96 84" aria-hidden="true" className="float">
      <path d="M27 31 21 6l14 21z" fill="#FF7A59" />
      <path d="M21 7c-5-4-9-2-9 2M21 7c-1-6 4-7 7-5" fill="none" stroke="#2FA36B" strokeWidth="3" strokeLinecap="round" />
      <rect x="42" y="2" width="13" height="38" rx="6.5" fill="#E8B04B" transform="rotate(14 48 21)" />
      <circle cx="68" cy="22" r="10" fill="#34C796" />
      <circle cx="77" cy="29" r="8" fill="#2FA36B" />
      <path d="M12 31h72l-6 47a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" fill="#FFFFFF" stroke="#14161C" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="40" cy="53" r="2.8" fill="#14161C" />
      <circle cx="56" cy="53" r="2.8" fill="#14161C" />
      <path d="M42 61q6 5 12 0" fill="none" stroke="#14161C" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="34" cy="60" r="3" fill="#FF8FB1" fillOpacity="0.8" />
      <circle cx="62" cy="60" r="3" fill="#FF8FB1" fillOpacity="0.8" />
    </svg>
  );
}

export function BannerArt({ kind }) {
  if (kind === 'coins') {
    return (
      <svg viewBox="0 0 96 86" width="96" height="86" aria-hidden="true">
        {[74, 66, 58, 50].map((y) => <ellipse key={y} cx="32" cy={y} rx="20" ry="6.5" fill="#FFC83D" stroke="#D99A00" strokeWidth="2" />)}
        {[74, 66].map((y) => <ellipse key={y} cx="68" cy={y} rx="18" ry="6" fill="#FFD66B" stroke="#D99A00" strokeWidth="2" />)}
        <circle cx="66" cy="30" r="17" fill="#FFD66B" stroke="#D99A00" strokeWidth="2.4" />
        <text x="66" y="37" textAnchor="middle" fontFamily="Bricolage Grotesque, sans-serif" fontSize="20" fontWeight="800" fill="#8A5A00">₹</text>
      </svg>
    );
  }
  if (kind === 'planets') {
    return (
      <svg viewBox="0 0 96 86" width="96" height="86" aria-hidden="true">
        <ellipse cx="50" cy="46" rx="42" ry="30" fill="none" stroke="#1B62C8" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="3 7" strokeLinecap="round" />
        <circle cx="50" cy="46" r="15" fill="#8C86FF" stroke="#FFFFFF" strokeWidth="3" />
        <circle cx="12" cy="40" r="9" fill="#FFC83D" />
        <circle cx="84" cy="30" r="8" fill="#34C796" />
        <circle cx="66" cy="76" r="7" fill="#FF8FB1" />
      </svg>
    );
  }
  if (kind === 'cart') {
    return (
      <svg viewBox="0 0 96 86" width="96" height="86" aria-hidden="true">
        <circle cx="30" cy="30" r="12" fill="#FF6B57" />
        <circle cx="52" cy="24" r="10" fill="#34C796" />
        <rect x="58" y="10" width="11" height="30" rx="5.5" fill="#E8B04B" transform="rotate(14 63 25)" />
        <path d="M10 36h76l-8 34a4 4 0 0 1-4 3H22a4 4 0 0 1-4-3z" fill="#FFFFFF" stroke="#14161C" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="30" cy="80" r="4" fill="#14161C" />
        <circle cx="68" cy="80" r="4" fill="#14161C" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 96 86" width="96" height="86" aria-hidden="true">
      <circle cx="70" cy="20" r="14" fill="#FFFFFF" fillOpacity="0.7" />
      <path d="M38 26v-7a5 5 0 0 1 5-5h12a5 5 0 0 1 5 5v7" fill="none" stroke="#14161C" strokeWidth="3.4" />
      <rect x="16" y="26" width="66" height="46" rx="11" fill="#FF7A59" />
      <rect x="29" y="26" width="7" height="46" fill="#FFC83D" />
      <rect x="62" y="26" width="7" height="46" fill="#FFC83D" />
      <circle cx="49" cy="46" r="9" fill="#7CC4FF" />
      <circle cx="26" cy="76" r="4" fill="#14161C" />
      <circle cx="72" cy="76" r="4" fill="#14161C" />
    </svg>
  );
}

export function Confetti() {
  const bits = [
    [8, '#FFC83D', 0], [22, '#FF8FB1', 0.3], [38, '#34C796', 0.6], [52, '#FFFFFF', 0.2], [66, '#FFC83D', 0.8], [80, '#7CC4FF', 0.4], [92, '#FF7A59', 1],
  ];
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map(([left, color, delay]) => <i key={left} style={{ left: `${left}%`, background: color, animationDelay: `${delay}s` }} />)}
    </div>
  );
}

export function HeroDeco() {
  return (
    <svg className="hero__deco" viewBox="0 0 390 300" preserveAspectRatio="xMaxYMin slice" width="100%" height="100%" aria-hidden="true">
      <circle cx="330" cy="80" r="132" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="2" />
      <circle cx="330" cy="80" r="84" fill="none" stroke="currentColor" strokeOpacity="0.16" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
      <circle cx="-10" cy="280" r="120" fill="currentColor" fillOpacity="0.06" />
      <circle cx="206" cy="104" r="4" fill="#FFC83D" />
      <circle cx="176" cy="22" r="3" fill="#FF8FB1" />
      <circle cx="376" cy="212" r="5" fill="#34C796" />
      <circle cx="22" cy="132" r="3" fill="#FFC83D" />
    </svg>
  );
}
