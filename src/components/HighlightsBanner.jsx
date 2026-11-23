import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { BannerArt } from './Illustrations.jsx';
import { todayISO } from '../lib/dates.js';

const TONES = { butter: '#FFF3C4', mint: '#DDF5EA', sky: '#DDEEFF', blush: '#FFE3EC', lavender: '#ECEBFF', peach: '#FFE8D6' };
const INKS = { butter: '#5A3B00', mint: '#0B4F45', sky: '#123F7F', blush: '#7A1F3E', lavender: '#3A3D7A', peach: '#8A3B07' };
const KEY = 'dayorbit-banner-hidden';

/**
 * A slot for announcements, reminders and tips. Each slide:
 * { key, tag, title, text, cta, to | onClick, tone, art: 'suitcase' | 'coins' | 'planets' | 'cart' }
 * Hidden for the rest of the day when closed.
 */
export default function HighlightsBanner({ slides = [] }) {
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === todayISO(); } catch { return false; } });
  if (hidden || !slides.length) return null;
  const slide = slides[Math.min(index, slides.length - 1)];
  const tone = slide.tone || 'butter';

  const close = () => {
    setHidden(true);
    try { localStorage.setItem(KEY, todayISO()); } catch { /* ignore */ }
  };

  return (
    <section className="banner" aria-roledescription="carousel" aria-label="Highlights" style={{ background: TONES[tone] }}>
      <div className="banner__art"><BannerArt kind={slide.art} /></div>
      <div className="banner__body" key={slide.key}>
        <span className="banner__tag" style={{ color: INKS[tone] }}>{slide.tag}</span>
        <h2 className="banner__title">{slide.title}</h2>
        <p className="banner__text" style={{ color: INKS[tone] }}>{slide.text}</p>
      </div>
      <div className="banner__foot">
        {slide.to ? (
          <Link className="banner__cta" to={slide.to}>{slide.cta} <Icon name="arrowRight" size={14} stroke={2.6} /></Link>
        ) : (
          <button type="button" className="banner__cta" onClick={slide.onClick}>{slide.cta} <Icon name="arrowRight" size={14} stroke={2.6} /></button>
        )}
        {slides.length > 1 && slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className="banner__dot"
            aria-pressed={i === index}
            aria-label={`Show highlight ${i + 1} of ${slides.length}: ${s.title}`}
            onClick={() => setIndex(i)}
          >
            <span />
          </button>
        ))}
      </div>
      <button type="button" className="banner__close" aria-label="Hide highlights for today" onClick={close}>
        <span><Icon name="x" size={13} stroke={3} /></span>
      </button>
    </section>
  );
}
