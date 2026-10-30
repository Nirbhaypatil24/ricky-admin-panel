import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Gauge, ShieldAlert } from 'lucide-react';
import { useLoad } from '../lib/hooks';
import { driverService, drivingService, errorMessage } from '../lib/api';
import { count, dateKeyIST, dateTime, day, mapsLink, startOfTodayIST, time } from '../lib/format';
import { PageHeader, Plate, Segmented, Loading, ErrorNote, Empty } from '../components/ui/bits';
import { Modal } from '../components/ui/Modal';
import { useLive } from '../live/LiveProvider';

/*
 * Driver safety: abnormal driving events detected on the meter from the ESP32's MPU6050
 * (ricky-crash backend/driving_monitor.py). These are NOT emergencies; a suspected crash that
 * nobody cancels becomes a normal SOS on the SOS desk. This page is for spotting patterns.
 */

const PERIODS = [
  { value: '1', label: 'Today' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
];
const LIMIT = 500;

const TYPE_LABEL = {
  HARSH_BRAKING: 'Harsh braking',
  SUDDEN_ACCELERATION: 'Sudden acceleration',
  SHARP_TURN: 'Sharp turn',
  SWERVING: 'Swerving',
  UNUSUAL_IMPACT: 'Unusual impact',
  SEVERE_IMPACT: 'Severe impact',
  ROLLOVER: 'Vehicle tipped over',
  ROAD_BUMP: 'Road bump / pothole',
  CRASH_CANCELLED: 'Crash alarm cancelled',
  CRASH_ESCALATED: 'Crash alarm → SOS sent',
};
// columns of the per-driver table
const COLS = [
  ['HARSH_BRAKING', 'Braking'],
  ['SUDDEN_ACCELERATION', 'Accel.'],
  ['SHARP_TURN', 'Turns'],
  ['SWERVING', 'Swerving'],
  ['IMPACTS', 'Impacts'],
  ['CRASH', 'Crash alarms'],
];
const SEV_CLASS = {
  low: 'bg-sunken text-muted',
  medium: 'bg-caution-soft text-caution',
  high: 'bg-signal-soft text-signal',
  critical: 'bg-signal text-white',
};
const UNIT = { dps: '°/s', deg: '°' };

function fromFor(days) {
  const today = startOfTodayIST();
  return days === '1' ? today : new Date(today.getTime() - (Number(days) - 1) * 86400000);
}

function measure(v, unit) {
  if (v === null || v === undefined) return '—';
  if (unit === 'g') return `${Number(v).toFixed(2)} g`;
  if (unit === 'changes') return `${Math.round(v)} changes`;
  return `${Math.round(v)}${UNIT[unit] ?? (unit ? ` ${unit}` : '')}`;
}

function Severity({ level }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${SEV_CLASS[level] || SEV_CLASS.low}`}>{level}</span>;
}

/** The 25 Hz trace around the event (4 s before, 2 s after): accelerations (g) and yaw rate (°/s). */
function TraceChart({ trace, at }) {
  if (!Array.isArray(trace) || trace.length < 3) return <p className="py-6 text-center text-sm text-muted">No sensor trace was sent with this event.</p>;
  const W = 640;
  const H = 150;
  const n = trace.length;
  const x = (i) => (i / (n - 1)) * W;
  const mark = Number.isInteger(at) && at >= 0 && at < n ? at : null;
  const panel = (series, label, unit) => {
    const vals = series.flatMap((s) => trace.map((r) => r[s.i]).filter((v) => typeof v === 'number'));
    const lim = Math.max(unit === 'g' ? 0.5 : 30, ...vals.map(Math.abs)) * 1.1;
    const y = (v) => H / 2 - (v / lim) * (H / 2 - 6);
    return (
      <figure className="mb-4">
        <figcaption className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="font-semibold text-ink">{label}</span>
          {series.map((s) => (
            <span key={s.i} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
          <span className="ml-auto">±{lim.toFixed(unit === 'g' ? 1 : 0)} {unit}</span>
        </figcaption>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-full rounded-ctl bg-sunken" preserveAspectRatio="none" role="img" aria-label={label}>
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="currentColor" className="text-line" strokeWidth="1" />
          {mark !== null && <line x1={x(mark)} x2={x(mark)} y1="0" y2={H} stroke="currentColor" className="text-ink" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
          {series.map((s) => {
            let d = '';
            trace.forEach((r, i) => {
              const v = r[s.i];
              if (typeof v !== 'number') return;
              d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
            });
            return d ? <path key={s.i} d={d} fill="none" stroke={s.color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /> : null;
          })}
        </svg>
      </figure>
    );
  };
  const hasLong = trace.some((r) => typeof r[0] === 'number');
  return (
    <div>
      {panel(
        [
          ...(hasLong
            ? [
                { i: 0, name: 'Forward (+) / braking (−)', color: 'rgb(var(--signal))' },
                { i: 1, name: 'Sideways', color: 'rgb(var(--viz))' },
              ]
            : []),
          { i: 2, name: 'Up/down', color: 'rgb(var(--muted))' },
        ],
        'Acceleration',
        'g'
      )}
      {panel([{ i: 3, name: 'Turning rate', color: 'rgb(var(--caution))' }], 'Yaw', '°/s')}
      <p className="text-xs text-muted">
        {mark !== null
          ? `${(mark / 25).toFixed(1)} s before and ${((n - 1 - mark) / 25).toFixed(1)} s after the moment it was detected (dashed line), 25 samples per second.`
          : `Last ${(n / 25).toFixed(1)} s before the event, 25 samples per second.`}{' '}
        {hasLong ? '' : 'The forward direction was not learned yet, so only up/down is shown.'}
      </p>
    </div>
  );
}

function EventDetail({ id, onClose }) {
  const ev = useLoad(() => (id ? drivingService.event(id).then((r) => r.data) : Promise.resolve(null)), [id]);
  const e = ev.data;
  return (
    <Modal open={!!id} onClose={onClose} title={e ? e.label : 'Driving event'} description={e ? `${dateTime(e.timestamp)} · ${e.driverName || e.driverId}` : undefined} width="max-w-2xl">
      {ev.loading && !e ? (
        <Loading />
      ) : ev.error ? (
        <ErrorNote error={errorMessage(ev.error, "Couldn't load the event")} onRetry={ev.reload} />
      ) : e ? (
        <>
          <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            {[
              ['Severity', <Severity key="s" level={e.severity} />],
              ['Measured', measure(e.value, e.unit)],
              ['Limit', measure(e.threshold, e.unit)],
              ['Speed', e.speedKmh !== null ? `${Math.round(e.speedKmh)} km/h` : 'no GPS'],
              ['Vehicle', e.plateNumber ? <Plate key="p" number={e.plateNumber} size="sm" /> : e.driverId],
              ['Passenger warned', e.alerted ? 'Yes' : 'No (cooldown)'],
              ['Road profile', e.details?.profile || '—'],
              [
                'Location',
                e.latitude !== null ? (
                  <a key="l" className="inline-flex items-center gap-1 text-signal underline-offset-2 hover:underline" href={mapsLink(e.latitude, e.longitude)} target="_blank" rel="noreferrer">
                    Map <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  'no GPS fix'
                ),
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted">{k}</dt>
                <dd className="mt-0.5 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          {e.details?.outcome && (
            <p className="mb-4 rounded-ctl bg-sunken px-3 py-2 text-sm">
              Outcome:{' '}
              {{ cancelled_driver: 'cancelled by the driver (SOS button)', cancelled_screen: "cancelled on the passenger screen (I'm OK)", sos_sent: 'not cancelled, SOS sent to the control room', sos_manual: 'someone pressed SOS during the countdown' }[e.details.outcome] ||
                e.details.outcome}
            </p>
          )}
          <TraceChart trace={e.trace} at={e.details?.traceEventIndex} />
        </>
      ) : null}
    </Modal>
  );
}

export default function Safety() {
  const { drivingFeed } = useLive();
  const [days, setDays] = useState('7');
  const [driverId, setDriverId] = useState('');
  const [type, setType] = useState('');
  const [bumps, setBumps] = useState(false);
  const [open, setOpen] = useState(null);
  const liveKey = drivingFeed[0]?.id;

  const drivers = useLoad(() => driverService.getAll().then((r) => r.data), []);
  const summary = useLoad(() => drivingService.summary(Number(days)).then((r) => r.data), [days, liveKey]);
  const events = useLoad(
    () => drivingService.events({ driverId, type, excludeBumps: !bumps && !type, from: fromFor(days).toISOString(), limit: LIMIT }).then((r) => r.data),
    [days, driverId, type, bumps, liveKey]
  );
  useEffect(() => setOpen(null), [days]);

  const rows = useMemo(() => {
    const list = (summary.data?.drivers || []).filter((d) => !driverId || d.driverId === driverId);
    return list.map((d) => {
      const c = d.counts || {};
      return {
        ...d,
        IMPACTS: (c.UNUSUAL_IMPACT || 0) + (c.SEVERE_IMPACT || 0) + (c.ROLLOVER || 0),
        CRASH: (c.CRASH_CANCELLED || 0) + (c.CRASH_ESCALATED || 0),
        escalated: c.CRASH_ESCALATED || 0,
      };
    });
  }, [summary.data, driverId]);

  const totals = useMemo(() => {
    const t = { total: 0, braking: 0, impacts: 0, crash: 0, escalated: 0 };
    for (const r of rows) {
      t.total += r.total;
      t.braking += r.counts.HARSH_BRAKING || 0;
      t.impacts += r.IMPACTS;
      t.crash += r.CRASH;
      t.escalated += r.escalated;
    }
    return t;
  }, [rows]);
  const maxScore = Math.max(1, ...rows.map((r) => r.score));
  const list = events.data || [];
  const todayKey = dateKeyIST(new Date());

  return (
    <div>
      <PageHeader title="Driving safety" sub="Harsh braking, sudden acceleration, sharp turns, swerving and impacts detected by each meter's motion sensor. Warnings only, not emergencies." />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Segmented label="Period" value={days} onChange={setDays} options={PERIODS} />
        <select className="field h-9 w-auto min-w-[180px] text-sm" value={driverId} onChange={(e) => setDriverId(e.target.value)} aria-label="Driver">
          <option value="">All drivers</option>
          {(drivers.data || []).map((d) => (
            <option key={d.driverId} value={d.driverId}>
              {d.driverName} ({d.driverId})
            </option>
          ))}
        </select>
        <select className="field h-9 w-auto min-w-[180px] text-sm" value={type} onChange={(e) => setType(e.target.value)} aria-label="Event type">
          <option value="">All event types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        {!type && (
          <label className="flex h-9 items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={bumps} onChange={(e) => setBumps(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--signal))]" />
            Show road bumps
          </label>
        )}
      </div>

      {(summary.error || events.error) && (
        <ErrorNote
          className="mb-5"
          error={errorMessage(summary.error || events.error, "Couldn't load driving events")}
          onRetry={() => {
            summary.reload();
            events.reload();
          }}
        />
      )}

      <section className="panel mb-5">
        <dl className="grid grid-cols-2 border-b border-line sm:grid-cols-4">
          {[
            ['Unsafe driving events', count(totals.total)],
            ['Harsh braking', count(totals.braking)],
            ['Impacts', count(totals.impacts)],
            ['Crash alarms', totals.crash ? `${count(totals.crash)}` : '0', totals.escalated ? `${totals.escalated} became SOS` : null],
          ].map(([k, v, sub], i) => (
            <div key={k} className={`px-5 py-4 ${i > 0 ? 'sm:border-l' : ''} ${i % 2 ? 'border-l' : ''} ${i >= 2 ? 'border-t sm:border-t-0' : ''} border-line`}>
              <dt className="text-sm text-muted">{k}</dt>
              <dd className="mt-1 font-display text-3xl font-semibold leading-none">{v}</dd>
              {sub && <dd className="mt-1 text-xs font-semibold text-signal">{sub}</dd>}
            </div>
          ))}
        </dl>
        {summary.loading && !summary.data ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty icon={Gauge} title="No unsafe driving recorded">
            Events appear here when a meter detects harsh braking, sharp turns or impacts while moving.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th className="min-w-[140px]" title="Weighted: braking ×2, accel. ×1, turns ×2, swerving ×3, impacts ×3, severe/rollover ×5. Lower is safer.">
                    Risk score
                  </th>
                  {COLS.map(([k, l]) => (
                    <th key={k} className="text-right">
                      {l}
                    </th>
                  ))}
                  <th>Last event</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.driverId} className="cursor-pointer" onClick={() => setDriverId(r.driverId === driverId ? '' : r.driverId)} title="Show only this driver's events">
                    <td>
                      <div className="flex items-center gap-2.5">
                        {r.plateNumber ? <Plate number={r.plateNumber} size="sm" /> : null}
                        <span className="whitespace-nowrap">{r.driverName || r.driverId}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                          <span className={`block h-full rounded-full ${r.score / maxScore > 0.66 ? 'bg-signal' : r.score / maxScore > 0.33 ? 'bg-caution' : 'bg-ok'}`} style={{ width: `${Math.max(4, (r.score / maxScore) * 100)}%` }} />
                        </span>
                        <span className="w-8 text-right font-semibold tabular-nums">{r.score}</span>
                      </div>
                    </td>
                    {COLS.map(([k]) => {
                      const v = k === 'IMPACTS' || k === 'CRASH' ? r[k] : r.counts[k] || 0;
                      return (
                        <td key={k} className={`text-right tabular-nums ${v ? '' : 'text-faint'}`}>
                          {v || '·'}
                          {k === 'CRASH' && r.escalated ? <span className="ml-1 text-xs font-semibold text-signal">({r.escalated} SOS)</span> : null}
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap text-muted">{r.lastEventAt ? `${dateKeyIST(r.lastEventAt) === todayKey ? time(r.lastEventAt) : day(r.lastEventAt)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel overflow-hidden">
        <div className="panel-head">
          <h2 className="panel-title">Events</h2>
          <span className="text-sm text-muted">{list.length >= LIMIT ? `latest ${LIMIT}` : count(list.length)}</span>
        </div>
        {events.loading && !events.data ? (
          <Loading />
        ) : list.length === 0 ? (
          <Empty icon={ShieldAlert} title="No events in this period">
            Try a longer period, another driver or another event type.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Vehicle</th>
                  <th>Event</th>
                  <th>Severity</th>
                  <th className="text-right">Measured</th>
                  <th className="text-right">Speed</th>
                  <th>Warned</th>
                  <th>
                    <span className="sr-only">Location</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id} className="cursor-pointer" onClick={() => setOpen(e.id)}>
                    <td className="whitespace-nowrap">
                      <span className="font-medium">{time(e.timestamp)}</span>
                      {dateKeyIST(e.timestamp) !== todayKey && <span className="ml-1.5 text-muted">{day(e.timestamp)}</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        {e.plateNumber ? <Plate number={e.plateNumber} size="sm" /> : null}
                        <span className="whitespace-nowrap">{e.driverName || e.driverId}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap font-medium">{e.label}</td>
                    <td>
                      <Severity level={e.severity} />
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums" title={e.threshold !== null ? `limit ${measure(e.threshold, e.unit)}` : undefined}>
                      {measure(e.value, e.unit)}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums">{e.speedKmh !== null ? `${Math.round(e.speedKmh)} km/h` : <span className="text-faint">—</span>}</td>
                    <td className="text-sm">{e.alerted ? 'Yes' : <span className="text-faint">No</span>}</td>
                    <td className="text-right">
                      {e.latitude !== null ? (
                        <a className="icon-btn h-8 w-8" href={mapsLink(e.latitude, e.longitude)} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()} title="Where it happened" aria-label="Where it happened on Google Maps">
                          <ExternalLink />
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EventDetail id={open} onClose={() => setOpen(null)} />
    </div>
  );
}
