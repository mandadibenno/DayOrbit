import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps focus inside the dialog, closes on Escape, restores focus when closed. */
function useModal(open, onClose) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const node = ref.current;
    node?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current?.(); }
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  return ref;
}

export default function BottomSheet({ open, onClose, title, hideTitle = false, children }) {
  const ref = useModal(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="sheet__handle" aria-hidden="true" />
        {!hideTitle && (
          <div className="sheet__head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn icon-btn--sm" aria-label="Close" onClick={onClose}>
              <Icon name="x" size={18} stroke={2.4} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Dialog({ open, onClose, title, role = 'dialog', children }) {
  const ref = useModal(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role={role} aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
