import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };
const TONES = {
  success: 'text-ok',
  error: 'text-signal',
  info: 'text-muted',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (tone, title, body) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { id, tone, title, body }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
    },
    [dismiss]
  );

  const api = useRef(null);
  if (!api.current) api.current = {};
  api.current.success = (title, body) => push('success', title, body);
  api.current.error = (title, body) => push('error', title, body);
  api.current.info = (title, body) => push('info', title, body);

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[2000] flex flex-col items-end gap-2 sm:left-auto sm:right-5 sm:w-96" aria-live="polite">
          {toasts.map((t) => {
            const Icon = ICONS[t.tone] || Info;
            return (
              <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className="toast-in pointer-events-auto flex w-full items-start gap-3 rounded-panel border border-line bg-surface px-4 py-3 shadow-float">
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${TONES[t.tone]}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-sm text-muted">{t.body}</p>}
                </div>
                <button className="icon-btn -mr-2 -mt-1 h-7 w-7" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                  <X />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext);
}
