import { classify } from '../lib/groceries.js';
import Icon from './Icon.jsx';

const TINTS = {
  tomato: '#FFE6E1', banana: '#FFF3C4', apple: '#FFE6E1', onion: '#F6E6F5', leaf: '#DDF5EA', cheese: '#FFF8E1', milk: '#DDEEFF',
  egg: '#FFF8E1', bread: '#FFEBD2', cup: '#F1E6DC', sack: '#F4F1EA', soap: '#ECEBFF',
};

const ART = {
  tomato: <><circle cx="12" cy="14" r="7" fill="#FF6B57" /><ellipse cx="9.6" cy="7" rx="2.8" ry="1.3" fill="#2FA36B" transform="rotate(-25 9.6 7)" /><ellipse cx="14.4" cy="7" rx="2.8" ry="1.3" fill="#2FA36B" transform="rotate(25 14.4 7)" /><circle cx="9.5" cy="12" r="1.4" fill="#fff" fillOpacity="0.5" /></>,
  banana: <><path d="M5 7c1 8 8 12 15 9-6-1-10-5-11-10z" fill="#FFC83D" stroke="#D99A00" strokeWidth="1.2" strokeLinejoin="round" /><path d="M5 7 4 4.5" stroke="#6E4800" strokeWidth="1.8" strokeLinecap="round" /></>,
  apple: <><path d="M12 8c-3-2-7 0-7 4.5S8 21 10.5 21c1 0 1-.5 1.5-.5s.5.5 1.5.5C16 21 19 17 19 12.5S15 6 12 8z" fill="#FF6B57" /><path d="M12 8c0-2 1-3.5 2.5-4" stroke="#6E4800" strokeWidth="1.6" fill="none" strokeLinecap="round" /></>,
  onion: <><path d="M12 4c-1 3-6 5-6 10a6 6 0 0 0 12 0c0-5-5-7-6-10z" fill="#C77DB8" /><path d="M12 9v10" stroke="#F6E6F5" strokeWidth="1.2" /></>,
  leaf: <><path d="M12 21V10M12 15l-4-3M12 12.5l4-3.5" stroke="#2FA36B" strokeWidth="1.8" strokeLinecap="round" fill="none" /><circle cx="12" cy="7.5" r="3" fill="#34C796" /><circle cx="7.5" cy="10.5" r="2.6" fill="#34C796" /><circle cx="16.5" cy="8" r="2.6" fill="#2FA36B" /></>,
  cheese: <><path d="M5 9l7-4 7 4v7l-7 4-7-4z" fill="#FFF8E1" stroke="#C9A14A" strokeWidth="1.5" strokeLinejoin="round" /><path d="M5 9l7 4 7-4M12 13v7" fill="none" stroke="#C9A14A" strokeWidth="1.5" /></>,
  milk: <><path d="M8 8l2-4h4l2 4v12H8z" fill="#FFFFFF" stroke="#1B62C8" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8 12h8v4H8z" fill="#7CC4FF" /></>,
  egg: <><ellipse cx="12" cy="13" rx="5.5" ry="7" fill="#FFFFFF" stroke="#C9A14A" strokeWidth="1.5" /><circle cx="12" cy="14" r="2.6" fill="#FFC83D" /></>,
  bread: <><path d="M5 11a4 4 0 0 1 2-7h10a4 4 0 0 1 2 7v9H5z" fill="#E8B04B" stroke="#B07A1E" strokeWidth="1.4" strokeLinejoin="round" /><path d="M9 12v5M15 12v5" stroke="#B07A1E" strokeWidth="1.4" strokeLinecap="round" /></>,
  cup: <><path d="M5 9h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" fill="#FFFFFF" stroke="#8A5A00" strokeWidth="1.5" /><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" fill="none" stroke="#8A5A00" strokeWidth="1.5" /><path d="M9 4c0 1.5 1 1.5 1 3M12 4c0 1.5 1 1.5 1 3" stroke="#B49A6A" strokeWidth="1.3" strokeLinecap="round" /></>,
  sack: <><path d="M7 9c0-2 2-3 5-3s5 1 5 3l1 9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" fill="#FFFFFF" stroke="#B49A6A" strokeWidth="1.5" /><path d="M9 6l3 2 3-2" fill="none" stroke="#B49A6A" strokeWidth="1.5" /></>,
  soap: <><path d="M8.5 10h7l1 3v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7z" fill="#9B8CFF" /><path d="M11 10V7h3M12.5 7V5H10" fill="none" stroke="#4B4FD8" strokeWidth="1.6" strokeLinecap="round" /><circle cx="18" cy="6" r="1.6" fill="#7CC4FF" /></>,
};

export default function GroceryIcon({ name, size = 40 }) {
  const { icon } = classify(name);
  if (!icon) {
    return (
      <span className="icon-tile bg-butter ink-butter" style={{ width: size, height: size }} aria-hidden="true">
        <Icon name="bag" size={size * 0.5} />
      </span>
    );
  }
  return (
    <span className="icon-tile" style={{ width: size, height: size, background: TINTS[icon] }} aria-hidden="true">
      <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24">{ART[icon]}</svg>
    </span>
  );
}
