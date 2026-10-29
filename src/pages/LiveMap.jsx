import { useEffect, useMemo, useState } from 'react';
import { Crosshair, ExternalLink, Phone, Route as RouteIcon, Search, Siren, X } from 'lucide-react';
import { useLive } from '../live/LiveProvider';
import { useRoute, useNow, navigate } from '../lib/hooks';
import { locationService, errorMessage } from '../lib/api';
import { STATE_META } from '../lib/fleet';
import { ago, coords, mapsLink, plate, startOfTodayIST } from '../lib/format';
import { Plate, ModeBadge, Battery, StateDot } from '../components/ui/bits';
import FleetMap from '../components/map/FleetMap';
import { useToast } from '../components/ui/Toast';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'road', label: 'On road' },
  { value: 'FOR_HIRE', label: 'For hire' },
  { value: 'PRIVATE', label: 'Single' },
  { value: 'SHARING', label: 'Sharing' },
  { value: 'offline', label: 'Offline' },
];

const GPS_LABEL = { PI_GPS: 'Pi GPS', ESP_GPS: 'ESP GPS', SIM: 'Simulated', NONE: 'No source' };

function haversineKm(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]];
    const R = 6371;
    const dLat = ((b[0] - a[0]) * Math.PI) / 180;
    const dLng = ((b[1] - a[1]) * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    d += 2 * R * Math.asin(Math.sqrt(x));
  }
  return d;
}

export default function LiveMap() {
  const { units, openAlerts, loaded } = useLive();
  const { params } = useRoute();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(params.focus || null);
  const [focus, setFocus] = useState(null);
  const [trail, setTrail] = useState({ key: null, points: [], loading: false });

  const unit = units.find((u) => u.key === selected) || null;

  // Deep link: #/map?focus=DRIVER-1
  useEffect(() => {
    if (!params.focus) return;
    setSelected(params.focus);
  }, [params.focus]);
  useEffect(() => {
    if (unit?.hasPosition && params.focus === unit.key) setFocus({ lat: unit.lat, lng: unit.lng, zoom: 16, nonce: unit.key });
    // only when the deep link target first resolves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.focus, Boolean(unit?.hasPosition)]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '');
    return units.filter((u) => {
      if (filter === 'road' && !u.online) return false;
      if (filter === 'offline' && u.online) return false;
      if (['FOR_HIRE', 'PRIVATE', 'SHARING'].includes(filter) && !(u.online && u.mode === filter)) return false;
      if (!q) return true;
      return [u.plateNumber, u.driverName, u.driverId, u.areaName].some((v) => v && String(v).toLowerCase().replace(/\s+/g, '').includes(q));
    });
  }, [units, filter, query]);

  const select = (u) => {
    setSelected(u.key);
    if (u.hasPosition) setFocus({ lat: u.lat, lng: u.lng, zoom: 16, nonce: `${u.key}-${Date.now()}` });
  };

  const close = () => {
    setSelected(null);
    setTrail({ key: null, points: [], loading: false });
    if (params.focus) navigate('map');
  };

  const showRoute = async () => {
    if (!unit?.driverId) return;
    if (trail.key === unit.key) {
      setTrail({ key: null, points: [], loading: false });
      return;
    }
    setTrail({ key: unit.key, points: [], loading: true });
    try {
      const { data } = await locationService.history(unit.driverId, startOfTodayIST().toISOString(), new Date().toISOString());
      const pts = (data || []).map((p) => [p.latitude, p.longitude]);
      setTrail({ key: unit.key, points: pts, loading: false });
      if (pts.length < 2) toast.info('No route recorded today', `${plate(unit.plateNumber) || unit.driverId} has not sent positions since midnight.`);
    } catch (e) {
      setTrail({ key: null, points: [], loading: false });
      toast.error("Couldn't load today's route", errorMessage(e));
    }
  };

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* List */}
      <aside className="order-2 flex min-h-0 flex-1 flex-col border-line bg-surface lg:order-1 lg:w-[340px] lg:flex-none lg:border-r">
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex items-baseline justify-between">
            <h1 className="page-title text-2xl">Live map</h1>
            <span className="text-sm text-muted">
              {units.filter((u) => u.online).length} on road, {units.length} total
            </span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input className="field pl-9" placeholder="Plate, driver or area" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search vehicles" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={`h-8 shrink-0 rounded-full border px-3 text-sm font-semibold transition-colors ${
                  filter === f.value ? 'border-cng bg-cng text-white dark:border-canopy dark:bg-canopy dark:text-canopy-ink' : 'border-line text-muted hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {openAlerts.map((a) => (
            <li key={a.id}>
              <a href={`#/sos?id=${encodeURIComponent(a.id)}`} className="flex items-center gap-3 border-b border-line bg-signal-soft px-4 py-3">
                <Siren className="h-5 w-5 text-signal" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{a.status === 'ACTIVE' ? 'SOS open' : 'SOS acknowledged'}</span>
                  <span className="block truncate text-sm text-muted">{a.driverName || a.driverId}</span>
                </span>
                <Plate number={a.plateNumber} size="sm" />
              </a>
            </li>
          ))}
          {list.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted">{loaded ? 'No vehicles match.' : 'Loading vehicles…'}</li>
          )}
          {list.map((u) => (
            <li key={u.key}>
              <button
                onClick={() => select(u)}
                className={`flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors hover:bg-sunken/60 ${selected === u.key ? 'bg-sunken' : ''}`}
                aria-current={selected === u.key ? 'true' : undefined}
              >
                <StateDot state={u.state} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <Plate number={u.plateNumber} size="sm" />
                    {!u.registered && <span className="text-xs text-faint">not registered</span>}
                  </span>
                  <span className="mt-1 block truncate text-sm text-muted">
                    {u.driverName || u.driverId}
                    {u.online ? (u.areaName ? `, ${u.areaName}` : '') : `, seen ${ago(u.lastSeen)}`}
                  </span>
                </span>
                <span className="text-right text-sm">
                  {u.online && u.speed !== null && u.speed !== undefined ? (
                    <>
                      <span className="font-semibold">{Math.round(u.speed)}</span>
                      <span className="text-muted"> km/h</span>
                    </>
                  ) : (
                    <span className="text-faint">{STATE_META[u.state]?.label}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Map */}
      <div className="relative order-1 h-[52vh] flex-none lg:order-2 lg:h-full lg:flex-1">
        <FleetMap
          className="h-full w-full"
          units={units}
          alerts={openAlerts}
          selectedKey={selected}
          onSelectUnit={(key) => setSelected(key)}
          onSelectAlert={(id) => navigate('sos', { id })}
          trail={trail.key === selected ? trail.points : null}
          focus={focus}
        />
        <Legend />
        {unit && <UnitCard unit={unit} onClose={close} onRoute={showRoute} trail={trail} onCenter={() => unit.hasPosition && setFocus({ lat: unit.lat, lng: unit.lng, zoom: 16, nonce: Date.now() })} />}
      </div>
    </div>
  );
}

function Legend() {
  const items = ['FOR_HIRE', 'PRIVATE', 'SHARING', 'offline'];
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[500] hidden rounded-ctl border border-line bg-surface/95 px-3 py-2 text-xs shadow-float sm:block">
      <ul className="space-y-1">
        {items.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: STATE_META[k].color }} />
            {STATE_META[k].label}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-signal ring-2 ring-white" />
          SOS
        </li>
      </ul>
    </div>
  );
}

function UnitCard({ unit: u, onClose, onRoute, trail, onCenter }) {
  const now = useNow();
  const routeOn = trail.key === u.key;
  const rows = [
    ['Speed', u.online && u.speed !== null && u.speed !== undefined ? `${Math.round(u.speed)} km/h` : '—'],
    ['Battery', <Battery key="b" pct={u.batteryPct} charging={u.charging} low={u.lowBattery} voltage={u.batteryVoltage} />],
    ['GPS', u.gpsSource ? `${GPS_LABEL[u.gpsSource] || u.gpsSource}${u.gpsFix === false ? ', no fix' : ''}` : '—'],
    ['ESP board', u.espConnected === null ? '—' : u.espConnected ? 'Connected' : <span key="e" className="font-semibold text-caution">Not responding</span>],
    ['Last report', ago(u.lastSeen, now)],
    ['Position', u.hasPosition ? coords(u.lat, u.lng) : 'Unknown'],
  ];
  return (
    <div className="absolute inset-x-3 bottom-3 z-[600] rounded-panel border border-line bg-surface shadow-float sm:left-3 sm:right-auto sm:w-[360px]">
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Plate number={u.plateNumber} size="lg" />
            <ModeBadge mode={u.mode} passengers={u.passengers} online={u.online} />
          </div>
          <p className="mt-2 truncate font-semibold">{u.driverName || u.driverId}</p>
          <p className="truncate text-sm text-muted">{u.areaName || (u.online ? 'Area not known yet' : `Offline, last seen ${ago(u.lastSeen, now)}`)}</p>
        </div>
        <button className="icon-btn -mr-2 -mt-1" onClick={onClose} aria-label="Close vehicle details">
          <X />
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="truncate font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {routeOn && trail.points.length > 1 && (
        <p className="border-t border-line px-4 py-2 text-sm text-muted">
          Route since midnight: <span className="font-semibold text-ink">{haversineKm(trail.points).toFixed(1)} km</span> from {trail.points.length} positions
        </p>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
        <button className={routeOn ? 'btn-dark btn-sm' : 'btn-ghost btn-sm'} onClick={onRoute} disabled={trail.loading || !u.driverId}>
          <RouteIcon /> {trail.loading && trail.key === u.key ? 'Loading route…' : routeOn ? 'Hide route' : "Today's route"}
        </button>
        {u.hasPosition && (
          <button className="btn-ghost btn-sm" onClick={onCenter}>
            <Crosshair /> Centre
          </button>
        )}
        {u.driverPhone && (
          <a className="btn-ghost btn-sm" href={`tel:${u.driverPhone}`}>
            <Phone /> Call
          </a>
        )}
        {u.hasPosition && (
          <a className="btn-quiet btn-sm" href={mapsLink(u.lat, u.lng)} target="_blank" rel="noreferrer">
            <ExternalLink /> Google Maps
          </a>
        )}
      </div>
    </div>
  );
}
