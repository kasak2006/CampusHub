import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { Icon } from '../components/Icons.jsx';

/**
 * Lightweight toast notifications (Phase 5). A single provider holds the queue
 * and renders a fixed viewport; any component calls `useToast()` to push one:
 *
 *   const toast = useToast();
 *   toast.success("You're registered!");
 *   toast.error(err.message);
 *
 * Toasts auto-dismiss; the timers are tracked so a manual close cancels them.
 */
const ToastContext = createContext(null);

const ICONS = { success: 'i-check', error: 'i-x', info: 'i-bell' };

let seq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, type = 'success', duration = 3800) => {
      if (!message) return null;
      const id = (seq += 1);
      setToasts((list) => [...list, { id, message, type }]);
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      push,
      success: (m, d) => push(m, 'success', d),
      error: (m, d) => push(m, 'error', d ?? 5200),
      info: (m, d) => push(m, 'info', d),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-wrap" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} role="status">
            <span className="toast__ic">
              <Icon name={ICONS[t.type]} style={{ width: 13, height: 13 }} />
            </span>
            <span className="toast__msg">{t.message}</span>
            <button
              className="toast__x"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <Icon name="i-x" style={{ width: 14, height: 14 }} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export default ToastContext;
