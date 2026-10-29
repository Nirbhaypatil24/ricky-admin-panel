import { BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, BatteryWarning, RefreshCw, TriangleAlert } from 'lucide-react';
import { plate as plateFmt, initials } from '../../lib/format';
import { MODES, STATE_META } from '../../lib/fleet';

/** Yellow commercial number plate */
export function Plate({ number, className = '', size = 'md' }) {
  if (!number) return <span className="text-sm text-faint">No plate</span>;
  const sizes = { sm: 'text-[0.8rem]', md: 'text-[0.95rem]', lg: 'text-lg px-2' };
  return <span className={`plate ${sizes[size]} ${className}`}>{plateFmt(number)}</span>;
}

const toneDot = { hire: 'bg-hire', single: 'bg-single', sharing: 'bg-sharing' };

/** Meter mode pill: For hire / Single / Sharing 2 of 3 */
export function ModeBadge({ mode, passengers, online = true }) {
  const m = MODES[mode];
  if (!online) return <span className="inline-flex items-center gap-1.5 text-sm text-faint">Offline</span>;
  if (!m) return <span className="text-sm text-faint">Not reported</span>;
  return (
    <span className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-sunken/70 px-2.5 text-xs font-semibold text-ink">
      <span className={`h-2 w-2 rounded-full ${toneDot[m.tone]}`} />
      {m.label}
      {mode === 'SHARING' && passengers !== null && passengers !== undefined && <span className="font-medium opacity-80">{passengers}/3</span>}
    </span>
  );
}

export function StateDot({ state, className = '' }) {
  const meta = STATE_META[state] || STATE_META.offline;
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${state === 'sos' ? 'beacon' : ''} ${className}`} style={{ background: meta.color }} title={meta.label} />;
}

/** Battery reading from the ESP $POWER packet */
export function Battery({ pct, charging, low, voltage, compact = false }) {
  if (pct === null || pct === undefined) return <span className="text-sm text-faint">—</span>;
  const Icon = charging ? BatteryCharging : low ? BatteryWarning : pct >= 70 ? BatteryFull : pct >= 35 ? BatteryMedium : BatteryLow;
  const color = low ? 'text-signal' : pct < 35 ? 'text-caution' : 'text-ok';
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm" title={voltage ? `${voltage} V` : undefined}>
      <Icon className={`h-4 w-4 ${color}`} />
      <span className={low ? 'font-semibold text-signal' : 'text-ink'}>{pct}%</span>
      {!compact && charging && <span className="text-xs text-muted">charging</span>}
    </span>
  );
}

export function Avatar({ name, className = '' }) {
  return (
    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cng/10 font-display text-sm font-bold text-cng dark:bg-canopy/15 dark:text-canopy ${className}`} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function Spinner({ className = 'h-5 w-5' }) {
  return <RefreshCw className={`animate-spin text-faint ${className}`} aria-hidden />;
}

export function Loading({ label = 'Loading…', className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-2.5 py-14 text-sm text-muted ${className}`} role="status">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorNote({ error, onRetry, className = '' }) {
  if (!error) return null;
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-ctl border border-signal/30 bg-signal-soft px-4 py-3 text-sm ${className}`} role="alert">
      <TriangleAlert className="h-4 w-4 shrink-0 text-signal" />
      <span className="flex-1 text-ink">{typeof error === 'string' ? error : error.message}</span>
      {onRetry && (
        <button className="btn-ghost btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-sunken text-muted">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <p className="font-display text-xl font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Page heading with optional actions on the right */
export function PageHeader({ title, sub, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}
