import { useEffect, useMemo, useState } from 'react';
import { useLive } from '../live/LiveProvider';
import { useLoad } from '../lib/hooks';
import { fareService, errorMessage } from '../lib/api';
import { dateTime, rupees } from '../lib/format';
import { PageHeader, Field, Loading, ErrorNote } from '../components/ui/bits';
import { ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

const CHART = [
  { km: 1.5, wait: 0 },
  { km: 3, wait: 0 },
  { km: 5, wait: 0 },
  { km: 5, wait: 10 },
  { km: 8, wait: 0 },
  { km: 12, wait: 5 },
  { km: 20, wait: 0 },
];

const fareFor = (t, km, wait) => {
  if (!t) return null;
  const raw = km * (Number(t.rate) || 0) + wait * (Number(t.waiting) || 0);
  return Math.max(Number(t.minimum) || 0, raw);
};

const toNum = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

export default function Tariff() {
  const { fare, setFare } = useLive();
  const toast = useToast();
  const history = useLoad(() => fareService.history(30).then((r) => r.data), [fare?.last_updated]);
  const [form, setForm] = useState({ rate: '', waiting: '', minimum: '' });
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState(null);

  const current = useMemo(
    () => (fare ? { rate: fare.fare_rate, waiting: fare.waiting_rate_per_min, minimum: fare.minimum_fare } : null),
    [fare]
  );

  useEffect(() => {
    if (current) setForm({ rate: String(current.rate ?? ''), waiting: String(current.waiting ?? ''), minimum: current.minimum ? String(current.minimum) : '' });
  }, [current]);

  const next = { rate: toNum(form.rate), waiting: toNum(form.waiting), minimum: toNum(form.minimum) };
  const errs = {};
  if (next.rate === null || Number.isNaN(next.rate) || next.rate < 1 || next.rate > 500) errs.rate = 'Between ₹1 and ₹500 per km.';
  if (next.waiting === null || Number.isNaN(next.waiting) || next.waiting < 0 || next.waiting > 100) errs.waiting = 'Between ₹0 and ₹100 per minute.';
  if (next.minimum !== null && (Number.isNaN(next.minimum) || next.minimum < 0 || next.minimum > 5000)) errs.minimum = 'Between ₹0 and ₹5,000. Leave empty for no minimum.';
  const valid = Object.keys(errs).length === 0;
  const changed =
    current && valid && (next.rate !== Number(current.rate) || next.waiting !== Number(current.waiting) || (next.minimum || null) !== (current.minimum ? Number(current.minimum) : null));

  const save = async () => {
    setError(null);
    try {
      const { data } = await fareService.change({ newRate: next.rate, waitingRate: next.waiting, minimumFare: next.minimum ?? 0 });
      setFare(data);
      toast.success('Tariff updated', `₹${data.fare_rate}/km and ₹${data.waiting_rate_per_min}/min. Meters pick it up within about 15 seconds.`);
      history.reload();
    } catch (e) {
      const msg = errorMessage(e, "Couldn't update the tariff");
      setError(msg);
      toast.error("Couldn't update the tariff", msg);
      throw e;
    }
  };

  const pct = current && next.rate ? ((next.rate - current.rate) / current.rate) * 100 : 0;

  return (
    <div>
      <PageHeader title="Tariff" sub="One tariff for every Ricky meter. A change reaches all meters within about 15 seconds." />

      {!fare ? (
        <Loading label="Loading the current tariff…" />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">
          {/* The card a passenger sees in the auto */}
          <section className="self-start overflow-hidden rounded-panel border-2 border-ink/80 bg-surface">
            <div className="bg-canopy px-5 py-3 text-canopy-ink">
              <p className="font-display text-xl font-bold leading-tight">Ricky meter tariff</p>
              <p className="text-sm font-medium opacity-80">In force since {fare.last_updated ? dateTime(fare.last_updated) : 'the server default'}</p>
            </div>
            <dl className="divide-y divide-line">
              <TariffRow label="Per kilometre" value={`₹${Number(current.rate).toFixed(2)}`} />
              <TariffRow label="Waiting, per minute" value={`₹${Number(current.waiting ?? 0).toFixed(2)}`} />
              <TariffRow label="Minimum fare" value={current.minimum ? `₹${Number(current.minimum).toFixed(2)}` : 'None'} />
            </dl>
            <p className="border-t border-line px-5 py-3 text-sm text-muted">Set by {fare.updated_by || 'server default'}</p>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">Change the tariff</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[minmax(0,260px)_1fr]">
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (changed) setConfirm(true);
                }}
                noValidate
              >
                <Money id="t-rate" label="Per kilometre" suffix="/km" value={form.rate} onChange={(v) => setForm((f) => ({ ...f, rate: v }))} error={errs.rate} step="0.5" />
                <Money id="t-wait" label="Waiting, per minute" suffix="/min" value={form.waiting} onChange={(v) => setForm((f) => ({ ...f, waiting: v }))} error={errs.waiting} step="0.5" />
                <Money
                  id="t-min"
                  label="Minimum fare"
                  value={form.minimum}
                  onChange={(v) => setForm((f) => ({ ...f, minimum: v }))}
                  error={errs.minimum}
                  hint="Optional. Saved and sent to meters; current meter software doesn't apply it yet."
                  step="1"
                  placeholder="None"
                />
                {error && <ErrorNote error={error} />}
                <button type="submit" className="btn-dark w-full" disabled={!changed}>
                  Review change
                </button>
              </form>

              <div>
                <p className="mb-2 text-sm font-semibold text-muted">Fare chart</p>
                <div className="overflow-hidden rounded-ctl border border-line">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Ride</th>
                        <th className="text-right">Now</th>
                        <th className="text-right">New</th>
                        <th className="text-right">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CHART.map((r) => {
                        const now = fareFor(current, r.km, r.wait);
                        const nxt = valid ? fareFor(next, r.km, r.wait) : null;
                        const diff = nxt !== null ? nxt - now : null;
                        return (
                          <tr key={`${r.km}-${r.wait}`}>
                            <td className="whitespace-nowrap">
                              {r.km} km{r.wait ? <span className="text-muted">, {r.wait} min waiting</span> : ''}
                            </td>
                            <td className="text-right">{rupees(Math.round(now))}</td>
                            <td className="text-right font-semibold">{nxt === null ? '—' : rupees(Math.round(nxt))}</td>
                            <td className={`text-right ${diff > 0.5 ? 'text-caution' : diff < -0.5 ? 'text-ok' : 'text-faint'}`}>
                              {diff === null || Math.abs(diff) < 0.5 ? '—' : `${diff > 0 ? '+' : '−'}${rupees(Math.abs(Math.round(diff)))}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted">Rounded to the rupee. Waiting is billed per minute the auto stands still during a hire.</p>
              </div>
            </div>
          </section>
        </div>
      )}

      <section className="panel mt-5 overflow-hidden">
        <div className="panel-head">
          <h2 className="panel-title">Previous tariffs</h2>
        </div>
        {history.error && <ErrorNote className="m-4" error={errorMessage(history.error)} onRetry={history.reload} />}
        {history.loading && !history.data ? (
          <Loading />
        ) : (history.data || []).length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">No changes yet. Meters use the server default until you set a tariff.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>From</th>
                  <th className="text-right">Per km</th>
                  <th className="text-right">Waiting per min</th>
                  <th className="text-right">Minimum</th>
                  <th>Set by</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((h) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap">
                      {dateTime(h.createdAt)}
                      {h.active && <span className="ml-2 rounded-full bg-canopy px-2 py-0.5 text-xs font-bold text-canopy-ink">Current</span>}
                    </td>
                    <td className="text-right">₹{Number(h.rate).toFixed(2)}</td>
                    <td className="text-right">{h.waitingRatePerMin !== null && h.waitingRatePerMin !== undefined ? `₹${Number(h.waitingRatePerMin).toFixed(2)}` : '—'}</td>
                    <td className="text-right">{h.minimumFare ? `₹${Number(h.minimumFare).toFixed(2)}` : '—'}</td>
                    <td className="text-muted">{h.updatedBy || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={save} title="Change the tariff on every meter?" confirmLabel="Apply new tariff" tone="neutral">
        {current && valid && (
          <ul className="space-y-1.5 text-ink">
            <li>
              Per km: ₹{current.rate} → <b>₹{next.rate}</b>
              {Math.abs(pct) >= 0.05 && <span className="text-muted"> ({pct > 0 ? '+' : ''}{pct.toFixed(1)}%)</span>}
            </li>
            <li>
              Waiting: ₹{current.waiting}/min → <b>₹{next.waiting}/min</b>
            </li>
            <li>
              Minimum fare: {current.minimum ? `₹${current.minimum}` : 'none'} → <b>{next.minimum ? `₹${next.minimum}` : 'none'}</b>
            </li>
          </ul>
        )}
        <p className="mt-3">Each meter switches over at its next tariff check, within about 15 seconds.</p>
      </ConfirmDialog>
    </div>
  );
}

function TariffRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between px-5 py-4">
      <dt className="text-base text-muted">{label}</dt>
      <dd className="font-display text-4xl font-semibold leading-none tracking-tight">{value}</dd>
    </div>
  );
}

function Money({ id, label, suffix, value, onChange, error, hint, step, placeholder }) {
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">₹</span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          className={`field pl-7 ${suffix ? 'pr-14' : ''}`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{suffix}</span>}
      </div>
    </Field>
  );
}
