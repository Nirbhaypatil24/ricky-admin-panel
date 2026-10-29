// Fleet model: merges /vehicles, /location/live and /device/status into one record per vehicle.

export const ONLINE_WINDOW_MS = 120 * 1000; // same as the backend's ONLINE_WINDOW_SEC

// Rotary switch positions. The Pi calls Single "PRIVATE" internally.
export const MODES = {
  FOR_HIRE: { key: 'FOR_HIRE', label: 'For hire', tone: 'hire', hint: 'Empty, looking for passengers' },
  PRIVATE: { key: 'PRIVATE', label: 'Single', tone: 'single', hint: 'One hire on the meter' },
  SHARING: { key: 'SHARING', label: 'Sharing', tone: 'sharing', hint: 'Seats billed separately' },
  WAITING: { key: 'WAITING', label: 'Waiting', tone: 'single', hint: 'Older units only' },
};

export const STATE_META = {
  sos: { label: 'SOS', color: 'rgb(var(--signal))' },
  FOR_HIRE: { label: 'For hire', color: 'rgb(var(--mode-hire))' },
  PRIVATE: { label: 'Single', color: 'rgb(var(--mode-single))' },
  SHARING: { label: 'Sharing', color: 'rgb(var(--mode-sharing))' },
  WAITING: { label: 'Waiting', color: 'rgb(var(--mode-single))' },
  online: { label: 'On road, mode not reported', color: 'rgb(var(--muted))' },
  offline: { label: 'Offline', color: 'rgb(var(--mode-offline))' },
};

export function modeLabel(mode) {
  return MODES[mode]?.label || (mode ? String(mode).replace(/_/g, ' ').toLowerCase() : null);
}

export function rideTypeLabel(ride) {
  const t = ride?.rideTypeLabel || ride?.rideType;
  if (!t) return '—';
  if (t === 'PRIVATE' || t === 'SINGLE') return 'Single';
  if (t === 'SHARED' || t === 'SHARING') return 'Sharing';
  return t;
}

const latest = (...ds) =>
  ds.filter(Boolean).reduce((a, b) => (!a || new Date(b) > new Date(a) ? b : a), null);

export const isFresh = (ts, now) => !!ts && now - new Date(ts).getTime() <= ONLINE_WINDOW_MS;

/**
 * @param vehicles  GET /vehicles
 * @param live      { [driverId]: GET /location/live item or /topic/locations message }
 * @param devices   { [driverId]: GET /device/status item or /topic/device-status message }
 * @param alerts    open SOS alerts
 */
export function mergeFleet(vehicles = [], live = {}, devices = {}, alerts = [], now = Date.now()) {
  const units = new Map();

  for (const v of vehicles) {
    const key = v.driverId || v.vehicleId;
    const d = v.device || {};
    units.set(key, {
      key,
      driverId: v.driverId || null,
      driverName: v.driver?.driverName || null,
      driverPhone: v.driver?.driverPhone || null,
      vehicleId: v.vehicleId,
      plateNumber: v.plateNumber,
      registered: true,
      lat: v.lat,
      lng: v.lng,
      speed: v.speed,
      heading: null,
      areaName: null,
      gpsSource: d.gpsSource || null,
      simulated: false,
      lastLocationAt: null,
      lastSeen: v.lastSeen,
      mode: d.meterMode || null,
      passengers: d.passengersOnboard ?? null,
      batteryPct: d.batteryPct ?? null,
      batteryVoltage: d.batteryVoltage ?? null,
      charging: d.charging ?? null,
      lowBattery: !!d.lowBattery,
      espConnected: d.espConnected ?? null,
      gpsFix: null,
      internetOk: null,
      lastHeartbeat: d.lastHeartbeat || null,
    });
  }

  const ensure = (driverId, extra) => {
    if (!units.has(driverId)) {
      units.set(driverId, {
        key: driverId,
        driverId,
        driverName: extra?.driverName || null,
        driverPhone: null,
        vehicleId: extra?.vehicleId || null,
        plateNumber: extra?.plateNumber || null,
        registered: false,
        lat: null,
        lng: null,
        speed: null,
        heading: null,
        areaName: null,
        gpsSource: null,
        simulated: false,
        lastLocationAt: null,
        lastSeen: null,
        mode: null,
        passengers: null,
        batteryPct: null,
        batteryVoltage: null,
        charging: null,
        lowBattery: false,
        espConnected: null,
        gpsFix: null,
        internetOk: null,
        lastHeartbeat: null,
      });
    }
    return units.get(driverId);
  };

  for (const [driverId, p] of Object.entries(live)) {
    const u = ensure(driverId, p);
    u.lat = p.latitude ?? u.lat;
    u.lng = p.longitude ?? u.lng;
    u.speed = p.speed ?? u.speed;
    u.heading = p.heading ?? u.heading;
    u.areaName = p.areaName || u.areaName;
    u.gpsSource = p.source || u.gpsSource;
    u.simulated = !!p.simulated;
    u.lastLocationAt = p.lastSeen || p.timestamp || u.lastLocationAt;
    u.driverName = u.driverName || p.driverName || null;
    u.plateNumber = u.plateNumber || p.plateNumber || null;
    u.lastSeen = latest(u.lastSeen, u.lastLocationAt);
  }

  for (const [driverId, s] of Object.entries(devices)) {
    const u = ensure(driverId, s);
    u.mode = s.meterMode ?? u.mode;
    u.passengers = s.passengersOnboard ?? u.passengers;
    u.batteryPct = s.batteryPct ?? u.batteryPct;
    u.batteryVoltage = s.batteryVoltage ?? u.batteryVoltage;
    u.charging = s.charging ?? u.charging;
    u.lowBattery = s.lowBattery ?? u.lowBattery;
    u.espConnected = s.espConnected ?? u.espConnected;
    u.gpsFix = s.gpsFix ?? u.gpsFix;
    u.gpsSource = s.gpsSource || u.gpsSource;
    u.internetOk = s.internetOk ?? u.internetOk;
    u.lastHeartbeat = latest(u.lastHeartbeat, s.lastSeen);
    u.driverName = u.driverName || s.driverName || null;
    u.plateNumber = u.plateNumber || s.plateNumber || null;
    u.lastSeen = latest(u.lastSeen, s.lastSeen);
  }

  const sosBy = new Map();
  for (const a of alerts) {
    if (a.status === 'ACTIVE' || a.status === 'ACKNOWLEDGED') sosBy.set(a.driverId, a);
  }

  return [...units.values()]
    .map((u) => {
      const online = isFresh(u.lastSeen, now);
      const sos = sosBy.get(u.driverId) || null;
      let state = 'offline';
      if (sos) state = 'sos';
      else if (online) state = MODES[u.mode] ? u.mode : 'online';
      return { ...u, online, sos, state, hasPosition: u.lat !== null && u.lat !== undefined && u.lng !== null && u.lng !== undefined };
    })
    .sort((a, b) => rank(a) - rank(b) || String(a.plateNumber || a.key).localeCompare(String(b.plateNumber || b.key)));
}

const ORDER = ['sos', 'FOR_HIRE', 'PRIVATE', 'SHARING', 'WAITING', 'online', 'offline'];
const rank = (u) => ORDER.indexOf(u.state);

/** Problems worth an operator's attention, most urgent first */
export function attentionItems(units, alerts) {
  const items = [];
  for (const a of alerts) {
    items.push({ id: `sos-${a.id}`, level: a.status === 'ACTIVE' ? 'sos' : 'ack', alert: a, unit: units.find((u) => u.driverId === a.driverId) });
  }
  for (const u of units) {
    if (!u.online) continue;
    if (u.lowBattery) items.push({ id: `bat-${u.key}`, level: 'warn', kind: 'battery', unit: u });
    if (u.espConnected === false) items.push({ id: `esp-${u.key}`, level: 'warn', kind: 'esp', unit: u });
    if (u.gpsFix === false) items.push({ id: `gps-${u.key}`, level: 'warn', kind: 'gps', unit: u });
    if (u.simulated) items.push({ id: `sim-${u.key}`, level: 'info', kind: 'sim', unit: u });
  }
  return items;
}

export function alertPosition(a) {
  if (!a) return null;
  if (a.locationValid && a.latitude !== null && a.latitude !== undefined) return { lat: a.latitude, lng: a.longitude, estimate: false };
  if (a.lastKnownLocation) return { lat: a.lastKnownLocation.latitude, lng: a.lastKnownLocation.longitude, estimate: true, at: a.lastKnownLocation.at };
  return null;
}
