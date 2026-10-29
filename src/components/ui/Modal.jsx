import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Accessible dialog: Escape and backdrop close it, focus moves inside and returns afterwards. */
export function Modal({ open, onClose, title, description, children, footer, width = 'max-w-lg', busy = false }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previously = document.activeElement;
    const panel = panelRef.current;
    const first = panel?.querySelector('input, select, textarea, button:not([data-close])');
    (first || panel)?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) closeRef.current?.();
      if (e.key === 'Tab' && panel) {
        const items = [...panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')];
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previously?.focus?.();
    };
  }, [open, busy]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1500] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose?.()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`toast-in flex max-h-[92vh] w-full ${width} flex-col rounded-t-panel border border-line bg-surface shadow-float outline-none sm:rounded-panel`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5">
          <div>
            <h2 id={titleId} className="font-display text-2xl font-semibold leading-tight">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button data-close className="icon-btn -mr-2 -mt-1" onClick={onClose} disabled={busy} aria-label="Close">
            <X />
          </button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-3">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/** Confirmation for actions that change or remove data. `onConfirm` may return a promise. */
export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel, tone = 'danger' }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      /* caller shows the error */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      busy={busy}
      width="max-w-md"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={tone === 'danger' ? 'btn-danger' : 'btn-dark'} onClick={run} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="pb-2 text-base text-muted">{children}</div>
    </Modal>
  );
}
