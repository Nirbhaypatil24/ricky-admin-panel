import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { STATE_META, alertPosition } from '../../lib/fleet';
import { plate } from '../../lib/format';
import { useThemeContext } from '../../lib/theme';

const DEFAULT_CENTER = [19.076, 72.8777]; // Mumbai, where the test units run
const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const iconCache = new Map();
function unitIcon(u, selected) {
  const showHeading = u.online && u.heading !== null && u.heading !== undefined && (u.speed ?? 0) > 2;
  const color = STATE_META[u.state === 'sos' ? (u.online ? u.mode || 'online' : 'offline') : u.state]?.color || STATE_META.online.color;
  const label = u.state === 'SHARING' && u.passengers ? u.passengers : '';
  const key = [color, showHeading ? Math.round(u.heading / 10) : '-', selected, u.online, label].join('|');
  if (!iconCache.has(key)) {
    iconCache.set(
      key,
      L.divIcon({
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        tooltipAnchor: [0, -14],
        html: `<div class="unit-pin ${u.online ? '' : 'is-offline'} ${selected ? 'is-selected' : ''}">${
          showHeading ? `<div class="heading" style="transform:rotate(${Math.round(u.heading / 10) * 10}deg)"></div>` : ''
        }<div class="disc" style="background:${color}">${label}</div></div>`,
      })
    );
  }
  return iconCache.get(key);
}

function sosIcon(alert, estimate) {
  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    tooltipAnchor: [0, -18],
    html: `<div class="sos-pin ${alert.status === 'ACKNOWLEDGED' ? 'is-ack' : ''} ${estimate ? 'is-estimate' : ''}"><div class="ring"></div><div class="core">SOS</div></div>`,
  });
}

function Controller({ points, fitKey, focus }) {
  const map = useMap();
  const fitted = useRef(null);

  useEffect(() => {
    // Leaflet measures its container once; re-measure after layout changes (sidebar, panels)
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);

  useEffect(() => {
    if (!points.length) return;
    const key = fitKey ?? 'auto';
    if (fitted.current === key) return;
    fitted.current = key;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
  }, [points, fitKey, map]);

  useEffect(() => {
    if (focus?.lat !== undefined && focus?.lat !== null) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), focus.zoom || 15), { duration: 0.6 });
    }
  }, [focus?.lat, focus?.lng, focus?.zoom, focus?.nonce, map]);
  return null;
}

/**
 * Fleet map. Vehicles are discs coloured by meter mode; SOS alerts pulse in red
 * (amber once acknowledged; dashed when the device had no GPS fix and we show its last known position).
 */
export default function FleetMap({
  units = [],
  alerts = [],
  selectedKey,
  onSelectUnit,
  selectedAlertId,
  onSelectAlert,
  trail,
  fitKey,
  focus,
  className = '',
  showOffline = true,
}) {
  const { resolved } = useThemeContext();
  const visible = useMemo(() => units.filter((u) => u.hasPosition && (showOffline || u.online)), [units, showOffline]);
  const sos = useMemo(
    () =>
      alerts
        .map((a) => ({ alert: a, pos: alertPosition(a) }))
        .filter((x) => x.pos),
    [alerts]
  );
  const points = useMemo(() => [...visible.map((u) => [u.lat, u.lng]), ...sos.map((s) => [s.pos.lat, s.pos.lng])], [visible, sos]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <MapContainer center={DEFAULT_CENTER} zoom={11} className="h-full w-full" zoomControl scrollWheelZoom>
        <TileLayer key={resolved} url={TILES[resolved] || TILES.light} attribution={ATTRIBUTION} subdomains="abcd" maxZoom={20} />
        <Controller points={points} fitKey={fitKey} focus={focus} />

        {trail && trail.length > 1 && (
          <>
            <Polyline positions={trail} pathOptions={{ color: resolved === 'dark' ? '#000' : '#fff', weight: 7, opacity: 0.6 }} />
            <Polyline positions={trail} pathOptions={{ color: resolved === 'dark' ? '#F7C82E' : '#0F4D3A', weight: 4, opacity: 0.95 }} />
          </>
        )}

        {visible.map((u) => (
          <Marker
            key={u.key}
            position={[u.lat, u.lng]}
            icon={unitIcon(u, selectedKey === u.key)}
            zIndexOffset={selectedKey === u.key ? 800 : u.online ? 200 : 0}
            eventHandlers={{ click: () => onSelectUnit?.(u.key) }}
            keyboard
            title={plate(u.plateNumber) || u.driverId}
          >
            <Tooltip direction="top" opacity={1}>
              {plate(u.plateNumber) || u.driverId}
              {u.online ? '' : ', offline'}
            </Tooltip>
          </Marker>
        ))}

        {sos.map(({ alert, pos }) => (
          <Marker
            key={alert.id}
            position={[pos.lat, pos.lng]}
            icon={sosIcon(alert, pos.estimate)}
            zIndexOffset={1000}
            eventHandlers={{ click: () => onSelectAlert?.(alert.id) }}
            title={`SOS ${alert.driverName || alert.driverId}`}
          >
            <Tooltip direction="top" opacity={1}>
              SOS: {plate(alert.plateNumber) || alert.driverId}
              {pos.estimate ? ' (last known)' : ''}
            </Tooltip>
          </Marker>
        ))}
        {sos
          .filter((s) => s.alert.id === selectedAlertId && s.pos.estimate)
          .map(({ alert, pos }) => (
            <Circle key={`c-${alert.id}`} center={[pos.lat, pos.lng]} radius={250} pathOptions={{ color: 'rgb(210,40,28)', weight: 2, dashArray: '6 6', fillOpacity: 0.06 }} />
          ))}
      </MapContainer>
    </div>
  );
}
