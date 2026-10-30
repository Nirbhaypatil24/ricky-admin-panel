import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import {
  WS_URL,
  stompConnectHeaders,
  vehicleService,
  locationService,
  deviceService,
  sosService,
  fareService,
  errorMessage,
} from '../lib/api';
import { mergeFleet } from '../lib/fleet';
import { playAlarm } from '../lib/alarm';
import { plate } from '../lib/format';

const LiveContext = createContext(null);

const OPEN = ['ACTIVE', 'ACKNOWLEDGED'];
const byKey = (list, key) => Object.fromEntries((list || []).filter((x) => x && x[key]).map((x) => [x[key], x]));

/**
 * Holds everything that changes in real time: vehicle positions, device health, open SOS alerts,
 * the tariff and the latest rides. REST gives the starting picture; the STOMP websocket keeps it current.
 * REST is polled as a fallback (faster while the websocket is down).
 */
export function LiveProvider({ children }) {
  const [vehicles, setVehicles] = useState([]);
  const [live, setLive] = useState({});
  const [devices, setDevices] = useState({});
  const [alerts, setAlerts] = useState({});
  const [fare, setFare] = useState(null);
  const [rideFeed, setRideFeed] = useState([]);
  const [drivingFeed, setDrivingFeed] = useState([]);
  const [link, setLink] = useState('connecting'); // connecting | live | down
  const [api, setApi] = useState({ ok: null, error: null, at: null });
  const [loaded, setLoaded] = useState(false);
  const [silenced, setSilenced] = useState(false);
  const [notifyPermission, setNotifyPermission] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  const [tick, setTick] = useState(() => Date.now());
  const knownAlerts = useRef(new Set());
  const loadedRef = useRef(false);

  // Coarse clock for online/offline (positions older than 2 min turn grey without a refresh)
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  const notify = useCallback((alert) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(`SOS: ${alert.sourceLabel || 'Emergency'}`, {
        body: [alert.driverName || alert.driverId, plate(alert.plateNumber), alert.areaName].filter(Boolean).join(', '),
        tag: alert.id,
        requireInteraction: true,
      });
      n.onclick = () => {
        window.focus();
        window.location.hash = `/sos?id=${encodeURIComponent(alert.id)}`;
      };
    } catch {
      /* some browsers only allow notifications from a service worker */
    }
  }, []);

  const upsertAlert = useCallback(
    (a, { isNew } = {}) => {
      if (!a?.id) return;
      setAlerts((prev) => {
        const next = { ...prev };
        if (OPEN.includes(a.status)) next[a.id] = a;
        else delete next[a.id];
        return next;
      });
      if (isNew && a.status === 'ACTIVE' && !knownAlerts.current.has(a.id)) {
        knownAlerts.current.add(a.id);
        setSilenced(false);
        notify(a);
      }
    },
    [notify]
  );

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([
      vehicleService.getAll(),
      locationService.live(),
      deviceService.getAll(),
      sosService.open(),
      fareService.get(),
    ]);
    const [v, l, d, s, f] = results;
    if (v.status === 'fulfilled') setVehicles(v.value.data || []);
    if (l.status === 'fulfilled') setLive((prev) => ({ ...prev, ...byKey(l.value.data, 'driverId') }));
    if (d.status === 'fulfilled') setDevices((prev) => ({ ...prev, ...byKey(d.value.data, 'driverId') }));
    if (s.status === 'fulfilled') {
      const open = (s.value.data || []).filter((a) => OPEN.includes(a.status));
      const fresh = open.filter((a) => a.status === 'ACTIVE' && !knownAlerts.current.has(a.id));
      // Alerts present on first load are not "new" (no notification), but they still alarm until acknowledged
      fresh.forEach((a) => {
        knownAlerts.current.add(a.id);
        if (loadedRef.current) notify(a);
      });
      if (fresh.length && loadedRef.current) setSilenced(false);
      setAlerts(byKey(open, 'id'));
    }
    if (f.status === 'fulfilled') setFare(f.value.data);

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === results.length) setApi({ ok: false, error: errorMessage(failed[0].reason), at: Date.now() });
    else setApi({ ok: true, error: null, at: Date.now() });
    loadedRef.current = true;
    setLoaded(true);
  }, [notify]);

  // Initial load + polling (every 30 s while live, 10 s while the websocket is down)
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, link === 'live' ? 30000 : 10000);
    return () => clearInterval(t);
  }, [refresh, link]);

  // Websocket
  useEffect(() => {
    if (!WS_URL) {
      setLink('down');
      return undefined;
    }
    const client = new Client({
      webSocketFactory: () => new WebSocket(WS_URL),
      connectHeaders: stompConnectHeaders,
      reconnectDelay: 5000,
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 20000,
      debug: () => {},
    });
    const json = (fn) => (m) => {
      try {
        fn(JSON.parse(m.body));
      } catch (e) {
        console.warn('[live] bad message', e);
      }
    };
    client.onConnect = () => {
      setLink('live');
      client.subscribe('/topic/sos-alerts', json((a) => upsertAlert(a, { isNew: true })));
      client.subscribe('/topic/sos-updates', json((a) => upsertAlert(a)));
      client.subscribe(
        '/topic/locations',
        json((p) => {
          if (!p.driverId) return;
          setLive((prev) => ({
            ...prev,
            [p.driverId]: { ...prev[p.driverId], ...p, lastSeen: new Date().toISOString() },
          }));
        })
      );
      client.subscribe(
        '/topic/device-status',
        json((s) => {
          if (!s.driverId) return;
          setDevices((prev) => ({ ...prev, [s.driverId]: { ...prev[s.driverId], ...s } }));
        })
      );
      client.subscribe(
        '/topic/rides',
        json((r) => setRideFeed((prev) => [r, ...prev.filter((x) => x.id !== r.id)].slice(0, 30)))
      );
      client.subscribe(
        '/topic/driving-events',
        json((e) => setDrivingFeed((prev) => [e, ...prev.filter((x) => x.id !== e.id)].slice(0, 50)))
      );
      client.subscribe('/topic/fare-rate', json((f) => setFare((prev) => ({ ...prev, ...f }))));
    };
    client.onWebSocketClose = () => setLink('down');
    client.onStompError = () => setLink('down');
    client.activate();
    return () => {
      client.deactivate();
    };
  }, [upsertAlert]);

  const openAlerts = useMemo(
    () => Object.values(alerts).sort((a, b) => new Date(b.receivedAt || b.timestamp) - new Date(a.receivedAt || a.timestamp)),
    [alerts]
  );
  const activeAlerts = useMemo(() => openAlerts.filter((a) => a.status === 'ACTIVE'), [openAlerts]);

  // Alarm repeats every 4 s while any alert is unacknowledged and not silenced
  useEffect(() => {
    if (!activeAlerts.length || silenced) return undefined;
    playAlarm();
    const t = setInterval(playAlarm, 4000);
    return () => clearInterval(t);
  }, [activeAlerts.length, silenced]);

  // Tab title shows open SOS count
  useEffect(() => {
    document.title = activeAlerts.length ? `(${activeAlerts.length}) SOS – Ricky Control Room` : 'Ricky Control Room';
  }, [activeAlerts.length]);

  const units = useMemo(() => mergeFleet(vehicles, live, devices, openAlerts, tick), [vehicles, live, devices, openAlerts, tick]);

  const acknowledge = useCallback(
    async (id) => {
      const { data } = await sosService.acknowledge(id);
      upsertAlert(data);
      return data;
    },
    [upsertAlert]
  );
  const resolve = useCallback(
    async (id, notes) => {
      const { data } = await sosService.resolve(id, notes);
      upsertAlert(data);
      return data;
    },
    [upsertAlert]
  );

  const requestNotify = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const p = await Notification.requestPermission();
    setNotifyPermission(p);
  }, []);

  const value = {
    loaded,
    link,
    api,
    units,
    vehicles,
    openAlerts,
    activeAlerts,
    fare,
    setFare,
    rideFeed,
    drivingFeed,
    refresh,
    acknowledge,
    resolve,
    upsertAlert,
    silenced,
    silence: () => setSilenced(true),
    notifyPermission,
    requestNotify,
  };
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used inside <LiveProvider>');
  return ctx;
}
