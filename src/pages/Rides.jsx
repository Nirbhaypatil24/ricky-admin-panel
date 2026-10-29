import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FlaskConical, Route as RouteIcon } from 'lucide-react';
import { useLoad } from '../lib/hooks';
import { driverService, rideService, errorMessage } from '../lib/api';
import { rideTypeLabel } from '../lib/fleet';
import { rupees, rupeesRounded, km, minutes, time, day, dateKeyIST, hourIST, startOfTodayIST, count, dateTime } from '../lib/format';
import { PageHeader, Plate, Segmented, Loading, ErrorNote, Empty } from '../components/ui/bits';
import { ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { useLive } from '../live/LiveProvider';
import BarChart from '../components/charts/BarChart';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];
const LIMIT = 5000; // backend maximum per request
const PAGE = 100;

function rangeFor(period) {
  const today = startOfTodayIST();
  if (period === 'today') return { from: today, days: 1 };
  const days = period === '7d' ? 7 : 30;
  return { from: new Date(today.getTime() - (days - 1) * 86400000), days };
}

function toCsv(rows) {
  const head = ['Ended (IST)', 'Ride ID', 'Driver ID', 'Driver', 'Plate', 'Type', 'Distance km', 'Minutes', 'Waiting min', 'Waiting charge', 'Rate per km', 'Fare'];
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [dateTime(r.endTime || r.receivedAt), r.rideId, r.driverId, r.driverName, r.plateNumber, rideTypeLabel(r), r.distanceKm, r.durationMinutes, r.waitingTimeMinutes, r.waitingCharge, r.fareRate, r.fareAmount]
      .map(esc)
      .join(',')
  );
  return [head.join(','), ...lines].join('\n');
}

export default function Rides() {
  const toast = useToast();
  const { rideFeed } = useLive();
  const [period, setPeriod] = useState('today');
  const [driverId, setDriverId] = useState('');
  const [type, setType] = useState('');
  const [testOpen, setTestOpen] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const range = rangeFor(period);

  const drivers = useLoad(() => driverService.getAll().then((r) => r.data), []);
  const rides = useLoad(
    () => rideService.query({ from: range.from.toISOString(), driverId, rideType: type, limit: LIMIT }).then((r) => r.data),
    [period, driverId, type, rideFeed[0]?.id]
  );
  useEffect(() => setShown(PAGE), [period, driverId, type]);

  const list = useMemo(() => rides.data || [], [rides.data]);
  const totals = useMemo(() => {
    const t = { n: list.length, fare: 0, km: 0, waiting: 0 };
    list.forEach((r) => {
      t.fare += Number(r.fareAmount) || 0;
      t.km += Number(r.distanceKm) || 0;
      t.waiting += Number(r.waitingCharge) || 0;
    });
    return t;
  }, [list]);

  const chart = useMemo(() => {
    if (period === 'today') {
      const b = Array.from({ length: 24 }, (_, h) => ({ key: h, value: 0, n: 0 }));
      list.forEach((r) => {
        const h = hourIST(r.endTime || r.receivedAt);
        b[h].value += Number(r.fareAmount) || 0;
        b[h].n += 1;
      });
      return b.map((x) => ({
        key: x.key,
        label: x.key === 0 ? '12a' : x.key < 12 ? `${x.key}a` : x.key === 12 ? '12p' : `${x.key - 12}p`,
        value: Math.round(x.value),
        detail: `${x.n} ride${x.n === 1 ? '' : 's'}`,
      }));
    }
    const days = Array.from({ length: range.days }, (_, i) => {
      const d = new Date(range.from.getTime() + i * 86400000 + 12 * 3600000);
      return { key: dateKeyIST(d), date: d, value: 0, n: 0 };
    });
    const idx = Object.fromEntries(days.map((d, i) => [d.key, i]));
    list.forEach((r) => {
      const i = idx[dateKeyIST(r.endTime || r.receivedAt)];
      if (i !== undefined) {
        days[i].value += Number(r.fareAmount) || 0;
        days[i].n += 1;
      }
    });
    return days.map((d) => ({ key: d.key, label: day(d.date), value: Math.round(d.value), detail: `${day(d.date)}, ${d.n} ride${d.n === 1 ? '' : 's'}` }));
  }, [list, period, range.days, range.from]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(list)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ricky-rides-${period}-${dateKeyIST(new Date())}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const sendTest = async () => {
    const distanceKm = Math.round((Math.random() * 8 + 1) * 10) / 10;
    const waiting = Math.round(Math.random() * 6);
    try {
      await rideService.submitTest({
        rideId: `TEST-RIDE-${Date.now()}`,
        driverId: 'TEST-PANEL',
        rideType: 'SINGLE',
        startTime: new Date(Date.now() - 25 * 60000).toISOString(),
        endTime: new Date().toISOString(),
        startLatitude: 19.0596,
        startLongitude: 72.8295,
        endLatitude: 19.076,
        endLongitude: 72.8777,
        distanceKm,
        waitingTimeMinutes: waiting,
        waitingRatePerMin: 2,
        fareRate: 12,
        fareAmount: Math.round((distanceKm * 12 + waiting * 2) * 100) / 100,
      });
      toast.success('Test ride added', 'It counts towards today’s figures under TEST-PANEL.');
      rides.reload();
    } catch (e) {
      toast.error("Couldn't add the test ride", errorMessage(e));
      throw e;
    }
  };

  const todayKey = dateKeyIST(new Date());

  return (
    <div>
      <PageHeader title="Rides" sub="Every ride a meter completes, with its fare breakdown.">
        <button className="btn-quiet" onClick={() => setTestOpen(true)}>
          <FlaskConical /> Add test ride
        </button>
        <button className="btn-ghost" onClick={exportCsv} disabled={!list.length}>
          <Download /> Export CSV
        </button>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Segmented label="Period" value={period} onChange={setPeriod} options={PERIODS} />
        <select className="field h-9 w-auto min-w-[180px] text-sm" value={driverId} onChange={(e) => setDriverId(e.target.value)} aria-label="Driver">
          <option value="">All drivers</option>
          {(drivers.data || []).map((d) => (
            <option key={d.driverId} value={d.driverId}>
              {d.driverName} ({d.driverId})
            </option>
          ))}
        </select>
        <select className="field h-9 w-auto min-w-[140px] text-sm" value={type} onChange={(e) => setType(e.target.value)} aria-label="Ride type">
          <option value="">Single and sharing</option>
          <option value="PRIVATE">Single only</option>
          <option value="SHARED">Sharing only</option>
        </select>
      </div>

      {rides.error && <ErrorNote className="mb-5" error={errorMessage(rides.error, "Couldn't load rides")} onRetry={rides.reload} />}

      <section className="panel mb-5">
        <dl className="grid grid-cols-2 border-b border-line sm:grid-cols-5">
          {[
            ['Rides', count(totals.n)],
            ['Fares', rupeesRounded(totals.fare)],
            ['Distance', km(totals.km, 0)],
            ['Average fare', totals.n ? rupeesRounded(totals.fare / totals.n) : '—'],
            ['Waiting charges', rupeesRounded(totals.waiting)],
          ].map(([k, v], i) => (
            <div key={k} className={`px-5 py-4 ${i > 0 ? 'sm:border-l' : ''} ${i % 2 ? 'border-l' : ''} ${i >= 2 ? 'border-t sm:border-t-0' : ''} border-line`}>
              <dt className="text-sm text-muted">{k}</dt>
              <dd className="mt-1 font-display text-3xl font-semibold leading-none">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="px-3 pb-3 pt-4">
          <p className="mb-2 px-2 text-sm font-semibold text-muted">{period === 'today' ? 'Fares per hour' : 'Fares per day'}</p>
          {rides.loading && !rides.data ? (
            <Loading />
          ) : (
            <BarChart
              data={chart}
              height={190}
              axisPrefix="₹"
              valueLabel={(v) => rupees(v)}
              highlightKey={period === 'today' ? hourIST(new Date()) : todayKey}
              ariaLabel={period === 'today' ? 'Fares per hour today' : 'Fares per day'}
            />
          )}
        </div>
      </section>

      <section className="panel overflow-hidden">
        {rides.loading && !rides.data ? (
          <Loading />
        ) : list.length === 0 ? (
          <Empty icon={RouteIcon} title="No rides in this period">
            {period === 'today' ? 'Rides show up here as soon as a meter finishes one.' : 'Try a longer period or another driver.'}
          </Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Ended</th>
                    <th>Vehicle</th>
                    <th>Type</th>
                    <th className="text-right">Distance</th>
                    <th className="text-right">On meter</th>
                    <th className="text-right">Waiting</th>
                    <th className="text-right">Fare</th>
                    <th>
                      <span className="sr-only">Route</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.slice(0, shown).map((r) => {
                    const ended = r.endTime || r.receivedAt;
                    const hasRoute = r.startLatitude && r.endLatitude;
                    const distanceFare = r.distanceKm && r.fareRate ? r.distanceKm * r.fareRate : null;
                    return (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">
                          <span className="font-medium">{time(ended)}</span>
                          {dateKeyIST(ended) !== todayKey && <span className="ml-1.5 text-muted">{day(ended)}</span>}
                        </td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            {r.plateNumber ? <Plate number={r.plateNumber} size="sm" /> : null}
                            <span className="whitespace-nowrap">{r.driverName || r.driverId}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap">
                          {rideTypeLabel(r)}
                          {r.passengerId && <span className="ml-1 text-muted">seat {String(r.passengerId).replace(/\D/g, '') || r.passengerId}</span>}
                        </td>
                        <td className="whitespace-nowrap text-right">{km(r.distanceKm)}</td>
                        <td className="whitespace-nowrap text-right" title={r.avgSpeedKmh ? `Average ${r.avgSpeedKmh} km/h, top ${r.maxSpeedKmh ?? '?'} km/h` : undefined}>
                          {minutes(r.durationMinutes)}
                        </td>
                        <td className="whitespace-nowrap text-right">
                          {r.waitingTimeMinutes ? (
                            <>
                              {minutes(r.waitingTimeMinutes)}
                              {r.waitingCharge ? <span className="block text-xs text-muted">{rupees(r.waitingCharge)}</span> : null}
                            </>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-right" title={distanceFare !== null ? `${km(r.distanceKm)} × ₹${r.fareRate}/km = ${rupees(distanceFare, { exact: true })}` : undefined}>
                          <span className="font-display text-lg font-semibold">{rupees(r.fareAmount)}</span>
                          {r.fareRate ? <span className="block text-xs text-muted">₹{r.fareRate}/km</span> : null}
                        </td>
                        <td className="text-right">
                          {hasRoute ? (
                            <a
                              className="icon-btn h-8 w-8"
                              href={`https://www.google.com/maps/dir/?api=1&origin=${r.startLatitude},${r.startLongitude}&destination=${r.endLatitude},${r.endLongitude}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Start and end on Google Maps"
                              aria-label="Start and end on Google Maps"
                            >
                              <ExternalLink />
                            </a>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {list.length > shown && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
                <span>
                  Showing {shown} of {count(list.length)} rides. Export CSV gets all of them.
                </span>
                <button className="btn-ghost btn-sm" onClick={() => setShown((n) => n + PAGE)}>
                  Show {Math.min(PAGE, list.length - shown)} more
                </button>
              </div>
            )}
            {list.length >= LIMIT && <p className="border-t border-line px-4 py-3 text-sm text-caution">Only the latest {count(LIMIT)} rides were loaded, so the totals above are incomplete. Pick a driver or a shorter period.</p>}
          </>
        )}
      </section>

      <ConfirmDialog open={testOpen} onClose={() => setTestOpen(false)} onConfirm={sendTest} title="Add a test ride?" confirmLabel="Add test ride" tone="neutral">
        This saves a real ride from <b className="text-ink">TEST-PANEL</b>, so it counts towards today’s fares and ride count.
      </ConfirmDialog>
    </div>
  );
}
