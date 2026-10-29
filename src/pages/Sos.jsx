import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, ExternalLink, FlaskConical, MapPinOff, Phone, ShieldCheck, Siren } from 'lucide-react';
import { useLive } from '../live/LiveProvider';
import { useLoad, useNow, useRoute, navigate } from '../lib/hooks';
import { sosService, errorMessage } from '../lib/api';
import { alertPosition } from '../lib/fleet';
import { ago, coords, dateTime, elapsed, fullDate, mapsLink, plate, span, time } from '../lib/format';
import { PageHeader, Plate, Empty, ErrorNote, Loading, Segmented } from '../components/ui/bits';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import FleetMap from '../components/map/FleetMap';

const STATUS = {
  ACTIVE: { label: 'Open', cls: 'bg-signal text-white' },
  ACKNOWLEDGED: { label: 'Acknowledged', cls: 'bg-caution-soft text-caution' },
  RESOLVED: { label: 'Resolved', cls: 'bg-ok-soft text-ok' },
  CANCELLED: { label: 'Cancelled on vehicle', cls: 'bg-sunken text-muted' },
};

export function StatusPill({ status }) {
  const s = STATUS[status] || { label: status, cls: 'bg-sunken text-muted' };
  return <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold ${s.cls}`}>{s.label}</span>;
}

export default function Sos() {
  const { openAlerts, units, notifyPermission, requestNotify } = useLive();
  const { params } = useRoute();
  const toast = useToast();
  const [tab, setTab] = useState('open');
  const [testOpen, setTestOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');

  const history = useLoad(() => sosService.list({ limit: 300 }).then((r) => r.data), [tab === 'history', openAlerts.length]);

  // Selected alert: from the URL, else the newest open one
  const selectedId = params.id || openAlerts[0]?.id || null;
  const fromLists = openAlerts.find((a) => a.id === selectedId) || history.data?.find((a) => a.id === selectedId);
  const single = useLoad(() => (selectedId && !fromLists ? sosService.get(selectedId).then((r) => r.data) : Promise.resolve(null)), [selectedId, Boolean(fromLists)]);
  const selected = fromLists || single.data || null;

  useEffect(() => {
    if (params.id && !openAlerts.some((a) => a.id === params.id) && history.data?.some((a) => a.id === params.id)) setTab('history');
  }, [params.id, openAlerts, history.data]);

  const pastAlerts = useMemo(() => {
    const list = (history.data || []).filter((a) => a.status === 'RESOLVED' || a.status === 'CANCELLED');
    return historyFilter === 'all' ? list : list.filter((a) => a.status === historyFilter);
  }, [history.data, historyFilter]);

  const sendTest = async () => {
    try {
      await sosService.sendTest({
        type: 'SOS_BUTTON',
        sourceDetail: 'SOS_BUTTON',
        driverId: 'TEST-PANEL',
        latitude: 19.076 + (Math.random() - 0.5) * 0.02,
        longitude: 72.8777 + (Math.random() - 0.5) * 0.02,
        timestamp: new Date().toISOString(),
      });
      toast.success('Test SOS sent', 'Acknowledge and resolve it to clear the alarm.');
    } catch (e) {
      toast.error("Couldn't send the test SOS", errorMessage(e));
      throw e;
    }
  };

  return (
    <div>
      <PageHeader title="SOS desk" sub="Every SOS from a panic button, crash sensor or passenger screen lands here.">
        {notifyPermission === 'default' && (
          <button className="btn-ghost" onClick={requestNotify}>
            <Bell /> Turn on desktop alerts
          </button>
        )}
        <button className="btn-quiet" onClick={() => setTestOpen(true)}>
          <FlaskConical /> Send test SOS
        </button>
      </PageHeader>

      <div className="mb-4">
        <Segmented
          label="Alerts"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'open', label: `Open (${openAlerts.length})` },
            { value: 'history', label: 'History' },
          ]}
        />
      </div>

      {tab === 'open' ? (
        openAlerts.length === 0 && !params.id ? (
          <div className="panel">
            <Empty icon={ShieldCheck} title="No open SOS">
              When a driver or passenger raises an SOS, it appears here with an alarm, and a red bar shows on every page until someone acknowledges it.
            </Empty>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">
            <ul className="space-y-2">
              {openAlerts.map((a) => (
                <AlertListItem key={a.id} alert={a} active={a.id === selected?.id} />
              ))}
              {openAlerts.length === 0 && <li className="panel px-4 py-6 text-center text-sm text-muted">No open SOS right now.</li>}
            </ul>
            {selected ? <AlertDetail alert={selected} units={units} /> : single.loading ? <Loading /> : null}
          </div>
        )
      ) : (
        <div className="space-y-5">
          {selected && params.id && !openAlerts.some((a) => a.id === selected.id) && <AlertDetail alert={selected} units={units} />}
          <div className="panel overflow-hidden">
            <div className="panel-head flex-wrap">
              <h2 className="panel-title">Closed alerts</h2>
              <Segmented
                label="Filter"
                value={historyFilter}
                onChange={setHistoryFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'RESOLVED', label: 'Resolved' },
                  { value: 'CANCELLED', label: 'Cancelled' },
                ]}
              />
            </div>
            {history.error && <ErrorNote className="m-4" error={errorMessage(history.error)} onRetry={history.reload} />}
            {history.loading && !history.data ? (
              <Loading />
            ) : pastAlerts.length === 0 ? (
              <Empty title="No closed alerts">Resolved and cancelled alerts are kept here.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Raised</th>
                      <th>Vehicle</th>
                      <th>Trigger</th>
                      <th>Outcome</th>
                      <th>Acknowledged in</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastAlerts.map((a) => (
                      <tr key={a.id} className="cursor-pointer" onClick={() => navigate('sos', { id: a.id })}>
                        <td className="whitespace-nowrap">{dateTime(a.receivedAt || a.timestamp)}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Plate number={a.plateNumber} size="sm" />
                            <span className="whitespace-nowrap text-muted">{a.driverName || a.driverId}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap">{a.sourceLabel}</td>
                        <td>
                          <StatusPill status={a.status} />
                        </td>
                        <td className="whitespace-nowrap">{span(a.receivedAt, a.acknowledgedAt) || '—'}</td>
                        <td className="max-w-[280px] truncate text-muted" title={a.notes || ''}>
                          {a.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog open={testOpen} onClose={() => setTestOpen(false)} onConfirm={sendTest} title="Send a test SOS?" confirmLabel="Send test SOS">
        This creates a real alert from <b className="text-ink">TEST-PANEL</b> near Mumbai. Every open dashboard will sound the alarm until someone acknowledges it.
      </ConfirmDialog>
    </div>
  );
}

function AlertListItem({ alert: a, active }) {
  const now = useNow();
  const open = a.status === 'ACTIVE';
  return (
    <li>
      <a
        href={`#/sos?id=${encodeURIComponent(a.id)}`}
        aria-current={active ? 'true' : undefined}
        className={`block rounded-panel border bg-surface p-4 transition-colors ${active ? 'border-ink/40 ring-1 ring-ink/20' : 'border-line hover:border-ink/25'} ${open ? 'border-l-4 border-l-signal' : 'border-l-4 border-l-caution'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold leading-tight">{a.sourceLabel}</p>
            <p className="mt-0.5 truncate text-sm text-muted">{a.driverName || a.driverId}</p>
          </div>
          <span className={`font-display text-2xl font-bold tabular-nums leading-none ${open ? 'text-signal' : 'text-muted'}`}>{elapsed(a.receivedAt || a.timestamp, now)}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Plate number={a.plateNumber} size="sm" />
          <StatusPill status={a.status} />
          {!a.locationValid && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-caution">
              <MapPinOff className="h-3.5 w-3.5" /> No GPS fix
            </span>
          )}
        </div>
      </a>
    </li>
  );
}

function AlertDetail({ alert: a, units }) {
  const { acknowledge, resolve } = useLive();
  const now = useNow();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const pos = alertPosition(a);
  const unit = units.find((u) => u.driverId === a.driverId);
  const isOpen = a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED';

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

  const doResolve = async () => {
    setBusy(true);
    try {
      await resolve(a.id, notes.trim());
      toast.success('SOS resolved', notes.trim() ? 'Your notes are saved with the alert.' : undefined);
      setResolveOpen(false);
      setNotes('');
    } catch (e) {
      toast.error("Couldn't resolve the SOS", errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    { label: 'Raised on the vehicle', at: a.deviceTime || a.timestamp, done: true },
    { label: 'Received by the server', at: a.receivedAt, done: true },
    { label: a.acknowledgedBy ? `Acknowledged by ${a.acknowledgedBy}` : 'Acknowledged', at: a.acknowledgedAt, done: !!a.acknowledgedAt, after: span(a.receivedAt, a.acknowledgedAt) },
    {
      label: a.status === 'CANCELLED' ? 'Cancelled from the vehicle' : a.resolvedBy ? `Resolved by ${a.resolvedBy}` : 'Resolved',
      at: a.resolvedAt,
      done: !!a.resolvedAt,
      after: span(a.receivedAt, a.resolvedAt),
    },
  ];

  const mapUnits = unit ? [unit] : [];

  return (
    <div className="panel overflow-hidden">
      <div className={`px-5 py-4 ${a.status === 'ACTIVE' ? 'bg-signal-soft' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={a.status} />
              <span className="text-sm text-muted">{fullDate(a.receivedAt || a.timestamp)}</span>
            </div>
            <h2 className="mt-2 flex items-center gap-2 font-display text-3xl font-semibold leading-tight">
              <Siren className={`h-6 w-6 ${a.status === 'ACTIVE' ? 'text-signal' : 'text-muted'}`} />
              {a.sourceLabel}
            </h2>
          </div>
          {isOpen && (
            <div className="text-right">
              <p className={`font-display text-4xl font-bold tabular-nums leading-none ${a.status === 'ACTIVE' ? 'text-signal' : ''}`}>{elapsed(a.receivedAt || a.timestamp, now)}</p>
              <p className="mt-1 text-sm text-muted">since raised</p>
            </div>
          )}
        </div>
        {isOpen && (
          <div className="mt-4 flex flex-wrap gap-2">
            {a.status === 'ACTIVE' && (
              <button className="btn-danger" onClick={ack} disabled={busy}>
                {busy ? 'Acknowledging…' : 'Acknowledge'}
              </button>
            )}
            <button className={a.status === 'ACTIVE' ? 'btn-ghost' : 'btn-dark'} onClick={() => setResolveOpen(true)} disabled={busy}>
              <CheckCircle2 /> Mark resolved
            </button>
            {a.driverPhone && (
              <a className="btn-ghost" href={`tel:${a.driverPhone}`}>
                <Phone /> Call {a.driverPhone}
              </a>
            )}
            {pos && (
              <a className="btn-quiet" href={mapsLink(pos.lat, pos.lng)} target="_blank" rel="noreferrer">
                <ExternalLink /> Google Maps
              </a>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 border-t border-line lg:grid-cols-[1fr_300px]">
        <FleetMap className="h-[320px] lg:h-auto lg:min-h-[440px]" units={mapUnits} alerts={[a]} selectedAlertId={a.id} fitKey={a.id} />
        <div className="space-y-5 border-t border-line p-5 lg:border-l lg:border-t-0">
          <section>
            <h3 className="text-sm font-semibold text-muted">Vehicle</h3>
            <div className="mt-2 flex items-center gap-2">
              <Plate number={a.plateNumber} size="lg" />
            </div>
            <p className="mt-2 font-semibold">{a.driverName || 'Unregistered driver'}</p>
            <p className="text-sm text-muted">{a.driverId}</p>
          </section>
          <section>
            <h3 className="text-sm font-semibold text-muted">Location</h3>
            {pos ? (
              <>
                <p className="mt-1 font-semibold">{a.areaName || 'Area not known yet'}</p>
                <p className="text-sm text-muted">{coords(pos.lat, pos.lng)}</p>
                {pos.estimate && (
                  <p className="mt-2 rounded-ctl bg-caution-soft px-3 py-2 text-sm text-ink">
                    The device had no GPS fix. This is its last known position{pos.at ? `, reported at ${time(pos.at)}` : ''}.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-caution">No position. The device had no GPS fix and has never reported one.</p>
            )}
            {unit?.online && unit.hasPosition && (
              <p className="mt-2 text-sm text-muted">
                Vehicle is reporting live: {unit.speed !== null && unit.speed !== undefined ? `${Math.round(unit.speed)} km/h, ` : ''}last update {ago(unit.lastSeen, now)}.
              </p>
            )}
          </section>
          <section>
            <h3 className="text-sm font-semibold text-muted">Timeline</h3>
            <ol className="mt-2 space-y-3">
              {steps.map((s) => (
                <li key={s.label} className="flex gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${s.done ? 'bg-ink' : 'border-2 border-line'}`} />
                  <div>
                    <p className={`text-sm font-semibold ${s.done ? '' : 'text-faint'}`}>{s.label}</p>
                    {s.done && (
                      <p className="text-xs text-muted">
                        {time(s.at)}
                        {s.after ? `, ${s.after} after the alert` : ''}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {a.notes && <p className="mt-3 rounded-ctl bg-sunken px-3 py-2 text-sm">{a.notes}</p>}
          </section>
        </div>
      </div>

      <Modal
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        busy={busy}
        title="Mark this SOS resolved?"
        description={`${a.sourceLabel} from ${a.driverName || a.driverId}${a.plateNumber ? `, ${plate(a.plateNumber)}` : ''}`}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setResolveOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn-dark" onClick={doResolve} disabled={busy}>
              {busy ? 'Saving…' : 'Mark resolved'}
            </button>
          </>
        }
      >
        <label className="field-label" htmlFor="sos-notes">
          What happened? <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="sos-notes"
          rows={4}
          className="field h-auto py-2"
          placeholder="For example: called the driver, passenger pressed it by mistake."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
        />
        <p className="field-hint">Saved with the alert so the next person on the desk can see it.</p>
      </Modal>
    </div>
  );
}
