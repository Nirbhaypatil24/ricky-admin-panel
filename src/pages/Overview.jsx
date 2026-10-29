import { useMemo } from 'react';
import { BatteryWarning, ChevronRight, Cpu, FlaskConical, Map as MapIcon, SatelliteDish, ShieldCheck, Siren } from 'lucide-react';
import { useLive } from '../live/LiveProvider';
import { useLoad, useNow, navigate } from '../lib/hooks';
import { statsService, rideService, errorMessage } from '../lib/api';
import { attentionItems, rideTypeLabel, STATE_META } from '../lib/fleet';
import { rupees, rupeesRounded, km, time, elapsed, plate, hourIST, startOfTodayIST, count } from '../lib/format';
import { PageHeader, Plate, ErrorNote, Empty, Loading } from '../components/ui/bits';
import FleetMap from '../components/map/FleetMap';
import BarChart, { StackBar } from '../components/charts/BarChart';

const h12 = (h) => `${h % 12 || 12} ${h % 24 < 12 ? 'am' : 'pm'}`;
// "8–9 am", "11 am–12 pm"
const hourRange = (h) => {
  const [a, b] = [h12(h), h12(h + 1)];
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`;
};

const dayFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' });

export default function Overview() {
  const { units, openAlerts, rideFeed, api, loaded, refresh } = useLive();
  const now = useNow();
  const latestRideId = rideFeed[0]?.id;

  const stats = useLoad(() => statsService.dashboard().then((r) => r.data), [latestRideId], { interval: 60000 });
  const rides = useLoad(() => rideService.recent(24, 500).then((r) => r.data), [latestRideId], { interval: 120000 });

  const counts = useMemo(() => {
    const c = { sos: 0, FOR_HIRE: 0, PRIVATE: 0, SHARING: 0, WAITING: 0, online: 0, offline: 0 };
    units.forEach((u) => (c[u.state] = (c[u.state] || 0) + 1));
    return c;
  }, [units]);
  const onRoad = units.filter((u) => u.online).length;

  const parts = ['sos', 'FOR_HIRE', 'PRIVATE', 'SHARING', 'WAITING', 'online', 'offline']
    .map((k) => ({ key: k, label: STATE_META[k].label, value: counts[k] || 0, color: STATE_META[k].color }))
    .filter((p) => p.value > 0 || ['FOR_HIRE', 'PRIVATE', 'SHARING', 'offline'].includes(p.key));

  const todayRides = useMemo(() => {
    const since = startOfTodayIST();
    const merged = new Map();
    [...rideFeed, ...(rides.data || [])].forEach((r) => merged.set(r.id, r));
    return [...merged.values()].filter((r) => new Date(r.receivedAt) >= since).sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
  }, [rides.data, rideFeed]);

  const byHour = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ key: h, value: 0, n: 0 }));
    todayRides.forEach((r) => {
      const h = hourIST(r.endTime || r.receivedAt);
      buckets[h].value += Number(r.fareAmount) || 0;
      buckets[h].n += 1;
    });
    return buckets.map((b) => ({
      key: b.key,
      label: b.key === 0 ? '12a' : b.key < 12 ? `${b.key}a` : b.key === 12 ? '12p' : `${b.key - 12}p`,
      value: Math.round(b.value),
      detail: `${hourRange(b.key)}, ${b.n} ride${b.n === 1 ? '' : 's'}`,
    }));
  }, [todayRides]);

  const s = stats.data;
  const busiest = byHour.reduce((best, b) => (b.value > (best?.value || 0) ? b : best), null);
  const attention = attentionItems(units, openAlerts);
  const currentHour = hourIST(now);

  return (
    <div>
      <PageHeader title="Overview" sub={dayFmt.format(now)}>
        <a href="#/map" className="btn-ghost">
          <MapIcon /> Open live map
        </a>
      </PageHeader>

      {api.ok === false && <ErrorNote className="mb-5" error={api.error} onRetry={refresh} />}

      {/* Fleet board */}
      <section className="panel mb-5 grid grid-cols-1 lg:grid-cols-[1.35fr_1fr]">
        <div className="flex flex-col justify-between gap-6 p-5 sm:p-6">
          <div>
            <p className="text-sm font-semibold text-muted">Vehicles on the road</p>
            <p className="mt-1 flex items-baseline gap-2 font-display">
              <span className="text-5xl font-bold leading-none tracking-tight">{loaded && api.ok !== false ? onRoad : '–'}</span>
              <span className="text-2xl font-semibold text-muted">of {units.length}</span>
            </p>
          </div>
          <div>
            <div>
              <StackBar parts={parts} ariaLabel={parts.map((p) => `${p.label} ${p.value}`).join(', ')} />
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {parts.map((p) => (
                <li key={p.key} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${p.key === 'sos' ? 'beacon' : ''}`} style={{ background: p.color }} />
                  <span className="text-muted">{p.label}</span>
                  <span className="font-semibold">{p.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-line lg:border-l lg:border-t-0">
          <Figure label="Fares collected today" value={s ? rupeesRounded(s.todayRevenue) : '–'} wide />
          <Figure label="Rides today" value={s ? count(s.todayRides) : '–'} className="border-r" />
          <Figure label="Distance on meter" value={s ? km(s.todayDistanceKm, 0) : '–'} />
          <Figure label="Average fare" value={s && s.todayRides ? rupeesRounded(s.todayRevenue / s.todayRides) : '–'} className="border-r border-t" />
          <Figure label="Tariff" value={s ? `₹${s.currentFareRate}/km` : '–'} href="#/tariff" className="border-t" />
        </div>
      </section>
      {stats.error && !s && api.ok !== false && <ErrorNote className="mb-5" error={errorMessage(stats.error, "Couldn't load today's figures")} onRetry={stats.reload} />}

      {/* Map + attention */}
      <section className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="panel overflow-hidden">
          <div className="panel-head">
            <h2 className="panel-title">Fleet now</h2>
            <span className="text-sm text-muted">{units.filter((u) => u.hasPosition).length} with a position</span>
          </div>
          <FleetMap
            className="h-[340px] sm:h-[420px]"
            units={units}
            alerts={openAlerts}
            onSelectUnit={(key) => navigate('map', { focus: key })}
            onSelectAlert={(id) => navigate('sos', { id })}
          />
        </div>

        <div className="panel flex min-h-[300px] flex-col">
          <div className="panel-head">
            <h2 className="panel-title">Needs attention</h2>
            {attention.length > 0 && <span className="text-sm font-semibold text-muted">{attention.length}</span>}
          </div>
          {attention.length === 0 ? (
            <Empty icon={ShieldCheck} title="All clear">
              No open SOS and no device problems on vehicles that are on the road.
            </Empty>
          ) : (
            <ul className="scroll-thin max-h-[420px] divide-y divide-line overflow-y-auto">
              {attention.map((item) => (
                <AttentionRow key={item.id} item={item} now={now} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Fares by hour + latest rides */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Fares by hour today</h2>
            <a href="#/rides" className="btn-quiet btn-sm">
              All rides <ChevronRight />
            </a>
          </div>
          <div className="px-3 pb-3 pt-4">
            {rides.loading && !rides.data ? (
              <Loading />
            ) : (
              <BarChart
                data={byHour}
                height={220}
                axisPrefix="₹"
                valueLabel={(v) => rupees(v)}
                highlightKey={currentHour}
                ariaLabel="Fares collected per hour today"
              />
            )}
          </div>
          {busiest && (
            <dl className="grid grid-cols-2 border-t border-line">
              <div className="px-5 py-3">
                <dt className="text-sm text-muted">Busiest hour</dt>
                <dd className="font-semibold">
                  {busiest.detail.split(',')[0]}, {rupees(busiest.value)}
                </dd>
              </div>
              <div className="border-l border-line px-5 py-3">
                <dt className="text-sm text-muted">This hour so far</dt>
                <dd className="font-semibold">
                  {rupees(byHour[currentHour].value)}, {byHour[currentHour].detail.split(', ')[1]}
                </dd>
              </div>
            </dl>
          )}
        </div>

        <div className="panel flex flex-col">
          <div className="panel-head">
            <h2 className="panel-title">Latest rides</h2>
          </div>
          {todayRides.length === 0 ? (
            <Empty title="No rides yet today">Rides appear here the moment a meter finishes one.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {todayRides.slice(0, 7).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-16 shrink-0 text-sm text-muted">{time(r.endTime || r.receivedAt)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.driverName || r.driverId}</p>
                    <p className="text-sm text-muted">
                      {rideTypeLabel(r)}, {km(r.distanceKm)}
                    </p>
                  </div>
                  <span className="font-display text-lg font-semibold">{rupees(r.fareAmount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Figure({ label, value, href, wide, className = '' }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 font-display font-semibold leading-none tracking-tight ${wide ? 'text-4xl' : 'text-3xl'}`}>{value}</p>
    </>
  );
  const cls = `border-line px-5 py-4 sm:px-6 ${wide ? 'col-span-2 border-b' : ''} ${className}`;
  return href ? (
    <a href={href} className={`${cls} transition-colors hover:bg-sunken/60`}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const KIND = {
  battery: { icon: BatteryWarning, title: (u) => `Battery ${u.batteryPct ?? '?'}%, not charging` },
  esp: { icon: Cpu, title: () => 'ESP board not responding', hint: 'SOS buttons and battery readings are offline on this meter.' },
  gps: { icon: SatelliteDish, title: () => 'No GPS fix', hint: 'An SOS from this vehicle would carry its last known position.' },
  sim: { icon: FlaskConical, title: () => 'Sending simulated GPS', hint: 'Bench unit in simulation mode.' },
};

function AttentionRow({ item, now }) {
  if (item.alert) {
    const a = item.alert;
    const active = item.level === 'sos';
    return (
      <li>
        <a
          href={`#/sos?id=${encodeURIComponent(a.id)}`}
          className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-sunken/60 ${active ? 'bg-signal-soft' : ''}`}
        >
          <Siren className={`mt-0.5 h-5 w-5 shrink-0 ${active ? 'text-signal' : 'text-caution'}`} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{active ? `SOS: ${a.sourceLabel}` : 'SOS acknowledged, not resolved'}</p>
            <p className="truncate text-sm text-muted">{[a.driverName || a.driverId, plate(a.plateNumber), a.areaName].filter(Boolean).join(', ')}</p>
          </div>
          <span className={`font-display text-lg font-semibold tabular-nums ${active ? 'text-signal' : 'text-muted'}`}>
            {elapsed(a.receivedAt || a.timestamp, now)}
          </span>
        </a>
      </li>
    );
  }
  const k = KIND[item.kind];
  const Icon = k.icon;
  const u = item.unit;
  return (
    <li>
      <a href={`#/map?focus=${encodeURIComponent(u.key)}`} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-sunken/60">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${item.level === 'warn' ? 'text-caution' : 'text-muted'}`} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{k.title(u)}</p>
          <p className="truncate text-sm text-muted">{k.hint || u.driverName || u.driverId}</p>
        </div>
        <Plate number={u.plateNumber} size="sm" />
      </a>
    </li>
  );
}
