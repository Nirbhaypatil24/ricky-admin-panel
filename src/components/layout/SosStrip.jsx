import { useState } from 'react';
import { BellOff, MapPin, Siren, Phone } from 'lucide-react';
import { useLive } from '../../live/LiveProvider';
import { useNow, navigate } from '../../lib/hooks';
import { elapsed, plate } from '../../lib/format';
import { errorMessage } from '../../lib/api';
import { useToast } from '../ui/Toast';

/**
 * Shown on every page while an SOS is open. Red while nobody has acknowledged it,
 * a slim amber bar once acknowledged but not yet resolved.
 */
export default function SosStrip() {
  const { activeAlerts, openAlerts, acknowledge, silence, silenced } = useLive();
  const now = useNow();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!openAlerts.length) return null;

  if (!activeAlerts.length) {
    const n = openAlerts.length;
    return (
      <div className="flex-none border-b border-caution/30 bg-caution-soft px-4 py-2 text-sm lg:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Siren className="h-4 w-4 text-caution" />
          <span className="font-semibold text-ink">
            {n === 1 ? '1 SOS acknowledged' : `${n} SOS acknowledged`}, waiting to be resolved
          </span>
          <button className="font-semibold text-caution underline-offset-2 hover:underline" onClick={() => navigate('sos')}>
            Open SOS desk
          </button>
        </div>
      </div>
    );
  }

  const a = activeAlerts[0];
  const more = activeAlerts.length - 1;
  const since = a.receivedAt || a.timestamp;

  const ack = async () => {
    setBusy(true);
    try {
      await acknowledge(a.id);
      toast.success('SOS acknowledged', 'The alarm stops on every dashboard. Resolve it once the situation is handled.');
    } catch (e) {
      toast.error("Couldn't acknowledge the SOS", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="strip-in z-[900] flex-none bg-signal-strong text-white" role="alert">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="beacon inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
            <Siren className="h-5 w-5" />
          </span>
          <span className="font-display text-3xl font-bold leading-none tracking-tight">SOS</span>
          {a.plateNumber && <span className="plate hidden text-base sm:inline-flex">{plate(a.plateNumber)}</span>}
          <div className="min-w-0 leading-tight">
            <p className="font-semibold">{a.sourceLabel}</p>
            <p className="truncate text-sm text-white/85">
              {a.driverName || a.driverId}
              {a.areaName ? `, ${a.areaName}` : a.locationValid ? '' : ', no GPS fix'}
            </p>
          </div>
        </div>

        <div className="flex items-baseline gap-1.5" aria-label="Time since the SOS was raised">
          <span className="font-display text-3xl font-bold tabular-nums leading-none">{elapsed(since, now)}</span>
          <span className="text-sm opacity-90">since raised</span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {more > 0 && (
            <button className="btn btn-sm border border-white/50 text-white hover:bg-white/10" onClick={() => navigate('sos')}>
              +{more} more
            </button>
          )}
          {a.driverPhone && (
            <a className="btn btn-sm border border-white/50 text-white hover:bg-white/10" href={`tel:${a.driverPhone}`}>
              <Phone /> Call driver
            </a>
          )}
          <button className="btn btn-sm border border-white/50 text-white hover:bg-white/10" onClick={() => navigate('sos', { id: a.id })}>
            <MapPin /> Locate
          </button>
          <button className="btn btn-sm bg-white text-signal-strong hover:bg-white/90" onClick={ack} disabled={busy}>
            {busy ? 'Acknowledging…' : 'Acknowledge'}
          </button>
          {!silenced && (
            <button className="icon-btn h-8 w-8 text-white hover:bg-white/10 hover:text-white" onClick={silence} title="Silence alarm until the next SOS" aria-label="Silence alarm">
              <BellOff />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
