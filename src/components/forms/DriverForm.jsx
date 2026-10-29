import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Field, Spinner } from '../ui/bits';
import { driverService, errorMessage } from '../../lib/api';
import { useToast } from '../ui/Toast';

const empty = { driverName: '', driverPhone: '', licenseNumber: '', driverId: '', active: true };

/** Add or edit a driver. Phone numbers are checked against other drivers as you type. */
export default function DriverForm({ open, driver, presetId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState({ state: 'idle' }); // idle | checking | free | taken

  useEffect(() => {
    if (!open) return;
    setForm(
      driver
        ? { driverName: driver.driverName || '', driverPhone: driver.driverPhone || '', licenseNumber: driver.licenseNumber || '', driverId: driver.driverId, active: driver.active !== false }
        : { ...empty, driverId: presetId || '' }
    );
    setErrors({});
    setPhone({ state: 'idle' });
  }, [open, driver, presetId]);

  useEffect(() => {
    if (!open) return undefined;
    const digits = form.driverPhone.replace(/\D/g, '');
    if (digits.length < 10 || (driver && digits === String(driver.driverPhone || '').replace(/\D/g, ''))) {
      setPhone({ state: 'idle' });
      return undefined;
    }
    setPhone({ state: 'checking' });
    const t = setTimeout(async () => {
      try {
        const { data } = await driverService.validatePhone(digits, driver?.driverId);
        setPhone({ state: data.available ? 'free' : 'taken', by: data.takenBy });
      } catch {
        setPhone({ state: 'idle' });
      }
    }, 450);
    return () => clearTimeout(t);
  }, [form.driverPhone, open, driver]);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    const digits = form.driverPhone.replace(/\D/g, '');
    if (form.driverName.trim().length < 2) errs.driverName = 'Enter the driver’s full name.';
    if (!/^\d{10,15}$/.test(digits)) errs.driverPhone = 'Enter a 10-digit mobile number.';
    else if (phone.state === 'taken') errs.driverPhone = `This number belongs to ${phone.by || 'another driver'}.`;
    if (!form.licenseNumber.trim()) errs.licenseNumber = 'Enter the driving licence number.';
    if (!driver && form.driverId && !/^[A-Za-z0-9_-]{1,50}$/.test(form.driverId.trim())) errs.driverId = 'Use letters, numbers, - and _ only.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const body = {
      driverName: form.driverName.trim(),
      driverPhone: digits,
      licenseNumber: form.licenseNumber.trim().toUpperCase(),
      active: form.active,
      ...(!driver && form.driverId.trim() ? { driverId: form.driverId.trim() } : {}),
    };
    setBusy(true);
    try {
      const { data } = driver ? await driverService.update(driver.driverId, body) : await driverService.create(body);
      toast.success(driver ? 'Driver updated' : 'Driver added', driver ? undefined : `${data.driverName} is ${data.driverId}. Set this ID on their meter.`);
      onSaved(data);
    } catch (err) {
      const msg = errorMessage(err, "Couldn't save the driver");
      if (/phone/i.test(msg)) setErrors({ driverPhone: msg });
      else if (/licen[sc]e/i.test(msg)) setErrors({ licenseNumber: msg });
      else if (/id/i.test(msg) && err.response?.status === 409) setErrors({ driverId: msg });
      else toast.error("Couldn't save the driver", msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title={driver ? 'Edit driver' : 'Add driver'}
      description={driver ? `Driver ID ${driver.driverId}` : undefined}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn-dark" type="submit" form="driver-form" disabled={busy || phone.state === 'checking'}>
            {busy ? 'Saving…' : driver ? 'Save driver' : 'Add driver'}
          </button>
        </>
      }
    >
      <form id="driver-form" onSubmit={submit} className="space-y-5 pb-2" noValidate>
        <Field label="Full name" htmlFor="d-name" error={errors.driverName}>
          <input id="d-name" className="field" value={form.driverName} onChange={set('driverName')} autoComplete="off" aria-invalid={!!errors.driverName} />
        </Field>

        <Field
          label="Mobile number"
          htmlFor="d-phone"
          error={errors.driverPhone || (phone.state === 'taken' ? `Already registered to ${phone.by || 'another driver'}.` : undefined)}
          hint={phone.state === 'free' ? 'Not used by any other driver.' : 'Shown to the control room during an SOS.'}
        >
          <div className="relative">
            <input
              id="d-phone"
              className="field pr-10"
              inputMode="tel"
              value={form.driverPhone}
              onChange={(e) => set('driverPhone')({ target: { value: e.target.value.replace(/[^\d+\s]/g, '').slice(0, 16) } })}
              placeholder="98765 43210"
              autoComplete="off"
              aria-invalid={!!errors.driverPhone || phone.state === 'taken'}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {phone.state === 'checking' && <Spinner className="h-4 w-4" />}
              {phone.state === 'free' && <Check className="h-4 w-4 text-ok" aria-label="Available" />}
              {phone.state === 'taken' && <X className="h-4 w-4 text-signal" aria-label="Already used" />}
            </span>
          </div>
        </Field>

        <Field label="Driving licence number" htmlFor="d-licence" error={errors.licenseNumber}>
          <input id="d-licence" className="field uppercase" value={form.licenseNumber} onChange={set('licenseNumber')} placeholder="MH20 20190012345" autoComplete="off" spellCheck={false} aria-invalid={!!errors.licenseNumber} />
        </Field>

        {!driver && (
          <Field label="Driver ID (optional)" htmlFor="d-id" error={errors.driverId} hint="Leave empty to get the next ID, like DRIVER-12. To link a meter that is already reporting, enter its RICKY_DRIVER_ID.">
            <input id="d-id" className="field" value={form.driverId} onChange={set('driverId')} placeholder="DRIVER-12" autoComplete="off" spellCheck={false} />
          </Field>
        )}

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-ctl border border-line px-4 py-3">
          <span>
            <span className="block font-semibold">Active</span>
            <span className="block text-sm text-muted">Inactive drivers stay in the records but are flagged on the list.</span>
          </span>
          <input type="checkbox" className="peer sr-only" checked={form.active} onChange={set('active')} />
          <span className="relative h-6 w-11 shrink-0 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-cng peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 dark:peer-checked:bg-canopy" />
        </label>
      </form>
    </Modal>
  );
}
