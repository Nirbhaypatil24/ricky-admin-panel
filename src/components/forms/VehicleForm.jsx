import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Field } from '../ui/bits';
import { vehicleService, errorMessage } from '../../lib/api';
import { plate as plateFmt } from '../../lib/format';
import { useToast } from '../ui/Toast';

const INDIAN_PLATE = /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/;
const norm = (p) => String(p || '').toUpperCase().replace(/[\s-]/g, '');

/** Add a vehicle or edit one. The backend links one vehicle per driver (POST /vehicles/assign/{driverId}). */
export default function VehicleForm({ open, vehicle, presetDriverId, drivers, onClose, onSaved }) {
  const toast = useToast();
  const [plateNumber, setPlate] = useState('');
  const [driverId, setDriverId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlate(vehicle?.plateNumber || '');
    setDriverId(vehicle?.driverId || presetDriverId || '');
    setDeviceId('');
    setErrors({});
  }, [open, vehicle, presetDriverId]);

  const p = norm(plateNumber);
  const choices = drivers.filter((d) => !d.vehicle || d.driverId === vehicle?.driverId || d.vehicle?.vehicleId === vehicle?.vehicleId);
  const taken = drivers.filter((d) => d.vehicle && d.driverId !== vehicle?.driverId);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!/^[A-Z0-9]{4,20}$/.test(p)) errs.plate = 'Enter the plate as printed, for example MH 20 EE 1234.';
    if (!driverId) errs.driver = 'Pick the driver who drives this auto.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await vehicleService.assign(driverId, { plateNumber: p, ...(deviceId.trim() ? { deviceId: deviceId.trim() } : {}) });
      toast.success(vehicle ? 'Vehicle updated' : 'Vehicle added', `${plateFmt(p)} is linked to ${drivers.find((d) => d.driverId === driverId)?.driverName || driverId}.`);
      onSaved();
    } catch (err) {
      const msg = errorMessage(err, "Couldn't save the vehicle");
      if (/plate/i.test(msg)) setErrors({ plate: msg });
      else toast.error("Couldn't save the vehicle", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title={vehicle ? 'Edit vehicle' : 'Add vehicle'}
      description="Each driver has one vehicle. Linking a plate that is already on the fleet moves it to this driver."
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-dark" type="submit" form="vehicle-form" disabled={busy}>
            {busy ? 'Saving…' : vehicle ? 'Save vehicle' : 'Add vehicle'}
          </button>
        </>
      }
    >
      <form id="vehicle-form" onSubmit={submit} className="space-y-5 pb-2" noValidate>
        <Field label="Number plate" htmlFor="v-plate" error={errors.plate} hint={p && !INDIAN_PLATE.test(p) ? "This doesn't look like an Indian plate. Check it before saving." : 'Spaces and dashes are removed when saving.'}>
          <div className="flex items-center gap-3">
            <input
              id="v-plate"
              className="field flex-1 uppercase"
              value={plateNumber}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="MH 20 EE 1234"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!errors.plate}
            />
            {p.length >= 4 && <span className="plate text-lg">{plateFmt(p)}</span>}
          </div>
        </Field>

        <Field label="Driver" htmlFor="v-driver" error={errors.driver} hint={choices.length === 0 ? 'Every driver already has a vehicle. Add a driver first.' : taken.length === 1 ? '1 driver already has a vehicle and isn’t listed.' : `${taken.length} drivers already have a vehicle and aren’t listed.`}>
          <select id="v-driver" className="field" value={driverId} onChange={(e) => setDriverId(e.target.value)} aria-invalid={!!errors.driver}>
            <option value="">Choose a driver</option>
            {choices.map((d) => (
              <option key={d.driverId} value={d.driverId}>
                {d.driverName}, {d.driverPhone} ({d.driverId})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Device ID (optional)" htmlFor="v-device" hint="Serial of the meter unit, if you track hardware separately.">
          <input id="v-device" className="field" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} placeholder="e.g. RICKY-PI-0042" autoComplete="off" />
        </Field>
      </form>
    </Modal>
  );
}
