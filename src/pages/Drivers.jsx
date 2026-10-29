import { useEffect, useMemo, useState } from 'react';
import { Link2, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { useLoad, useRoute, navigate } from '../lib/hooks';
import { driverService, errorMessage } from '../lib/api';
import { PageHeader, Plate, Avatar, Empty, Loading, ErrorNote, Segmented } from '../components/ui/bits';
import { ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { useLive } from '../live/LiveProvider';
import DriverForm from '../components/forms/DriverForm';
import VehicleForm from '../components/forms/VehicleForm';
import { ago } from '../lib/format';

export default function Drivers() {
  const toast = useToast();
  const { params } = useRoute();
  const { units, refresh } = useLive();
  const drivers = useLoad(() => driverService.getAll().then((r) => r.data), []);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [form, setForm] = useState(null); // { driver? , presetId? }
  const [vehicleFor, setVehicleFor] = useState(null);
  const [removing, setRemoving] = useState(null);

  // #/drivers?add=DRIVER-9 opens the form prefilled (from the fleet page's "unregistered device")
  useEffect(() => {
    if (params.add) setForm({ presetId: params.add });
  }, [params.add]);

  const unitBy = useMemo(() => Object.fromEntries(units.map((u) => [u.driverId, u])), [units]);
  const all = useMemo(() => drivers.data || [], [drivers.data]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '');
    return all.filter((d) => {
      if (status === 'active' && !d.active) return false;
      if (status === 'inactive' && d.active) return false;
      if (!q) return true;
      return [d.driverName, d.driverId, d.driverPhone, d.licenseNumber, d.vehicle?.plateNumber].some((v) => v && String(v).toLowerCase().replace(/\s+/g, '').includes(q));
    });
  }, [all, query, status]);

  const remove = async () => {
    try {
      await driverService.remove(removing.driverId);
      toast.success('Driver removed', `${removing.driverName} is no longer registered.`);
      drivers.reload();
      refresh();
    } catch (e) {
      toast.error("Couldn't remove the driver", errorMessage(e));
      throw e;
    }
  };

  const closeForm = () => {
    setForm(null);
    if (params.add) navigate('drivers');
  };

  return (
    <div>
      <PageHeader title="Drivers" sub="The driver ID is what each meter sends with its rides, location and SOS.">
        <button className="btn-primary" onClick={() => setForm({})}>
          <Plus /> Add driver
        </button>
      </PageHeader>

      <div className="panel overflow-hidden">
        <div className="panel-head flex-wrap">
          <Segmented
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: `All (${all.length})` },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input className="field h-9 pl-9 text-sm" placeholder="Name, phone, licence or plate" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search drivers" />
          </div>
        </div>

        {drivers.error && <ErrorNote className="m-4" error={errorMessage(drivers.error, "Couldn't load drivers")} onRetry={drivers.reload} />}

        {drivers.loading && !drivers.data ? (
          <Loading />
        ) : all.length === 0 && !drivers.error ? (
          <Empty
            icon={Users}
            title="No drivers yet"
            action={
              <button className="btn-primary" onClick={() => setForm({})}>
                <Plus /> Add the first driver
              </button>
            }
          >
            Add a driver, then link their auto on the fleet page.
          </Empty>
        ) : list.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No drivers match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Mobile</th>
                  <th>Licence</th>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((d) => {
                  const u = unitBy[d.driverId];
                  return (
                    <tr key={d.driverId}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={d.driverName} />
                          <div>
                            <p className="whitespace-nowrap font-semibold">{d.driverName}</p>
                            <p className="text-xs text-muted">{d.driverId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <a href={`tel:${d.driverPhone}`} className="hover:underline">
                          {d.driverPhone}
                        </a>
                      </td>
                      <td className="whitespace-nowrap text-muted">{d.licenseNumber}</td>
                      <td>
                        {d.vehicle ? (
                          <div>
                            <Plate number={d.vehicle.plateNumber} size="sm" />
                            {u && <p className="mt-1 text-xs text-muted">{u.online ? 'On the road now' : u.lastSeen ? `Last seen ${ago(u.lastSeen)}` : 'Never reported'}</p>}
                          </div>
                        ) : (
                          <button className="btn-quiet btn-sm -ml-2" onClick={() => setVehicleFor(d.driverId)}>
                            <Link2 /> Link vehicle
                          </button>
                        )}
                      </td>
                      <td>
                        <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold ${d.active ? 'bg-ok-soft text-ok' : 'bg-sunken text-muted'}`}>{d.active ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-0.5">
                          <button className="icon-btn" onClick={() => setForm({ driver: d })} title="Edit" aria-label={`Edit ${d.driverName}`}>
                            <Pencil />
                          </button>
                          <button className="icon-btn hover:text-signal" onClick={() => setRemoving(d)} title="Remove" aria-label={`Remove ${d.driverName}`}>
                            <Trash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DriverForm
        open={form !== null}
        driver={form?.driver}
        presetId={form?.presetId}
        onClose={closeForm}
        onSaved={() => {
          closeForm();
          drivers.reload();
          refresh();
        }}
      />

      <VehicleForm
        open={vehicleFor !== null}
        presetDriverId={vehicleFor}
        drivers={all}
        onClose={() => setVehicleFor(null)}
        onSaved={() => {
          setVehicleFor(null);
          drivers.reload();
          refresh();
        }}
      />

      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} onConfirm={remove} title={`Remove ${removing?.driverName || 'this driver'}?`} confirmLabel="Remove driver">
        {removing?.vehicle ? 'Their vehicle is unlinked but stays on the fleet. ' : ''}Their past rides and SOS alerts stay in the history. A meter still sending {removing?.driverId} will show up as an unregistered device.
      </ConfirmDialog>
    </div>
  );
}
