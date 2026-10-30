import { useMemo, useState } from 'react';
import { CarTaxiFront, Crosshair, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useLive } from '../live/LiveProvider';
import { useLoad, useNow, navigate } from '../lib/hooks';
import { driverService, vehicleService, errorMessage } from '../lib/api';
import { ago, plate } from '../lib/format';
import { rideSummary } from '../lib/fleet';
import { PageHeader, Plate, ModeBadge, Battery, StateDot, Empty, Loading, Segmented, ErrorNote } from '../components/ui/bits';
import { ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import VehicleForm from '../components/forms/VehicleForm';

const GPS_LABEL = { PI_GPS: 'Pi GPS', ESP_GPS: 'ESP GPS', SIM: 'Simulated', NONE: 'None' };

export default function Fleet() {
  const { units, loaded, refresh, api } = useLive();
  const now = useNow();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(null); // { vehicle?, driverId? }
  const [removing, setRemoving] = useState(null);
  const drivers = useLoad(() => driverService.getAll().then((r) => r.data), [form === null]);

  const registered = units.filter((u) => u.registered);
  const unregistered = units.filter((u) => !u.registered);
  const problems = (u) => u.online && (u.lowBattery || u.espConnected === false || u.gpsFix === false);

  const summary = [
    ['On the road', `${registered.filter((u) => u.online).length} of ${registered.length}`],
    ['Low battery', registered.filter((u) => u.online && u.lowBattery).length],
    ['ESP not responding', registered.filter((u) => u.online && u.espConnected === false).length],
    ['Never reported', registered.filter((u) => !u.lastSeen).length],
  ];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '');
    return registered.filter((u) => {
      if (filter === 'road' && !u.online) return false;
      if (filter === 'offline' && u.online) return false;
      if (filter === 'problems' && !problems(u)) return false;
      if (!q) return true;
      return [u.plateNumber, u.driverName, u.driverId, u.driverPhone, u.vehicleId].some((v) => v && String(v).toLowerCase().replace(/\s+/g, '').includes(q));
    });
  }, [registered, filter, query]);

  const remove = async () => {
    try {
      await vehicleService.remove(removing.vehicleId);
      toast.success('Vehicle removed', `${plate(removing.plateNumber)} is no longer on the fleet list.`);
      refresh();
    } catch (e) {
      toast.error("Couldn't remove the vehicle", errorMessage(e));
      throw e;
    }
  };

  const driversById = Object.fromEntries((drivers.data || []).map((d) => [d.driverId, d]));

  return (
    <div>
      <PageHeader title="Fleet health" sub="Registered autos, who drives them, and how each meter is doing right now.">
        <button className="btn-primary" onClick={() => setForm({})}>
          <Plus /> Add vehicle
        </button>
      </PageHeader>

      {api.ok === false && <ErrorNote className="mb-5" error={api.error} onRetry={refresh} />}

      <dl className="panel mb-5 grid grid-cols-2 lg:grid-cols-4">
        {summary.map(([k, v], i) => (
          <div key={k} className={`border-line px-5 py-4 ${i % 2 ? 'border-l' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l' : ''}`}>
            <dt className="text-sm text-muted">{k}</dt>
            <dd className={`mt-1 font-display text-3xl font-semibold leading-none ${i > 0 && v > 0 && i < 3 ? 'text-caution' : ''}`}>{v}</dd>
          </div>
        ))}
      </dl>

      {unregistered.length > 0 && (
        <div className="mb-5 rounded-panel border border-caution/30 bg-caution-soft px-4 py-3 text-sm">
          <p className="font-semibold">
            {unregistered.length === 1 ? '1 device is' : `${unregistered.length} devices are`} reporting without a registered vehicle
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unregistered.map((u) => (
              <button key={u.key} className="btn-ghost btn-sm" onClick={() => (driversById[u.driverId] ? setForm({ driverId: u.driverId }) : navigate('drivers', { add: u.driverId }))}>
                <Plus /> Register {u.driverId}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="panel-head flex-wrap">
          <Segmented
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'road', label: 'On road' },
              { value: 'problems', label: 'Problems' },
              { value: 'offline', label: 'Offline' },
            ]}
          />
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input className="field h-9 pl-9 text-sm" placeholder="Plate, driver or phone" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search fleet" />
          </div>
        </div>

        {!loaded ? (
          <Loading />
        ) : registered.length === 0 ? (
          <Empty
            icon={CarTaxiFront}
            title="No vehicles yet"
            action={
              <button className="btn-primary" onClick={() => setForm({})}>
                <Plus /> Add the first vehicle
              </button>
            }
          >
            Add a vehicle and link it to a driver. The meter shows up on the map once it starts reporting.
          </Empty>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No vehicles match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Meter</th>
                  <th>Battery</th>
                  <th>ESP board</th>
                  <th>GPS</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.key}>
                    <td>
                      <Plate number={u.plateNumber} />
                      <span className="mt-1 block text-xs text-faint">{u.vehicleId}</span>
                    </td>
                    <td>
                      {u.driverId ? (
                        <>
                          <span className="block whitespace-nowrap font-semibold">{u.driverName || u.driverId}</span>
                          {u.driverPhone && (
                            <a href={`tel:${u.driverPhone}`} className="text-sm text-muted hover:text-ink">
                              {u.driverPhone}
                            </a>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-faint">No driver</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        {u.state === 'sos' ? <StateDot state="sos" /> : <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${u.online ? 'bg-ok' : 'bg-idle'}`} />}
                        <span>
                          <span className="block font-medium">{u.state === 'sos' ? 'SOS open' : u.online ? 'On the road' : u.lastSeen ? 'Offline' : 'Never reported'}</span>
                          {u.lastSeen && <span className="block text-xs text-muted">{u.online ? `updated ${ago(u.lastSeen, now)}` : `last seen ${ago(u.lastSeen, now)}`}</span>}
                        </span>
                      </span>
                    </td>
                    <td>
                      <ModeBadge mode={u.mode} passengers={u.passengers} online={u.online} />
                      {u.ride && (
                        <span className="mt-1 block whitespace-nowrap text-xs font-semibold tabular-nums text-ink" title="Fare running on the meter now">
                          {rideSummary(u.ride).total} running
                        </span>
                      )}
                    </td>
                    <td>
                      <Battery pct={u.batteryPct} charging={u.charging} low={u.lowBattery} voltage={u.batteryVoltage} />
                    </td>
                    <td className="whitespace-nowrap text-sm">
                      {u.espConnected === null ? <span className="text-faint">—</span> : u.espConnected ? 'Connected' : <span className="font-semibold text-caution">Not responding</span>}
                    </td>
                    <td className="whitespace-nowrap text-sm">
                      {u.gpsSource ? GPS_LABEL[u.gpsSource] || u.gpsSource : <span className="text-faint">—</span>}
                      {u.gpsFix === false && <span className="block text-xs font-semibold text-caution">No fix</span>}
                    </td>
                    <td>
                      <div className="flex justify-end gap-0.5">
                        <button className="icon-btn" onClick={() => navigate('map', { focus: u.key })} disabled={!u.hasPosition} title="Show on map" aria-label={`Show ${plate(u.plateNumber)} on map`}>
                          <Crosshair />
                        </button>
                        <button className="icon-btn" onClick={() => setForm({ vehicle: u })} title="Edit" aria-label={`Edit ${plate(u.plateNumber)}`}>
                          <Pencil />
                        </button>
                        <button className="icon-btn hover:text-signal" onClick={() => setRemoving(u)} title="Remove" aria-label={`Remove ${plate(u.plateNumber)}`}>
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <VehicleForm
        open={form !== null}
        vehicle={form?.vehicle}
        presetDriverId={form?.driverId}
        drivers={drivers.data || []}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null);
          refresh();
        }}
      />

      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} onConfirm={remove} title={`Remove ${plate(removing?.plateNumber) || 'this vehicle'}?`} confirmLabel="Remove vehicle">
        {removing?.driverName ? `${removing.driverName} stays registered as a driver. ` : ''}Past rides and SOS alerts stay in the history. The meter will show up as an unregistered device if it keeps reporting.
      </ConfirmDialog>
    </div>
  );
}
