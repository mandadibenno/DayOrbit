import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

let seq = 0;

/** toast('Saved', { action: { label: 'Undo', onClick }, tone: 'warn', duration }) */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback((message, options = {}) => {
    const id = ++seq;
    setToasts((list) => [...list.slice(-2), { id, message, ...options }]);
    setTimeout(() => dismiss(id), options.duration || (options.action ? 6000 : 3800));
    return id;
  }, [dismiss]);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span className={`toast__icon ${t.tone === 'warn' ? 'toast__icon--warn' : ''}`} aria-hidden="true">
              <Icon name={t.tone === 'warn' ? 'alert' : 'check'} size={15} stroke={3} />
            </span>
            <span className="toast__msg">{t.message}</span>
            {t.action && (
              <button type="button" className="toast__action" onClick={() => { t.action.onClick(); dismiss(t.id); }}>
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
