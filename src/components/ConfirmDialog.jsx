import { useEffect, useState } from 'react';
import { Dialog } from './BottomSheet.jsx';

/**
 * Confirmation for actions with consequences. `requireText` asks the person to type
 * a word (e.g. DELETE or the space name) before the button unlocks.
 */
export default function ConfirmDialog({
  open, title, children, confirmLabel = 'Confirm', danger = false, requireText, busy = false, onConfirm, onCancel,
}) {
  const [typed, setTyped] = useState('');
  useEffect(() => { if (open) setTyped(''); }, [open]);
  const locked = requireText ? typed.trim() !== requireText : false;

  return (
    <Dialog open={open} onClose={onCancel} title={title} role="alertdialog">
      <h2>{title}</h2>
      <div className="stack" style={{ marginTop: 8 }}>{children}</div>
      {requireText && (
        <div className="field" style={{ marginTop: 14 }}>
          <label className="label" htmlFor="confirm-text">Type <strong>{requireText}</strong> to confirm</label>
          <input id="confirm-text" className="input" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
      )}
      <div className="btn-row" style={{ marginTop: 18 }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={locked || busy} onClick={onConfirm}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
