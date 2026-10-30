import axios from 'axios';
import { getConnection } from './config';

const conn = getConnection();

export const API_BASE_URL = conn.apiBaseUrl;
export const WS_URL = conn.wsUrl;
export const stompConnectHeaders = conn.adminKey ? { 'x-admin-key': conn.adminKey } : {};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    ...(conn.adminKey ? { 'X-Admin-Key': conn.adminKey } : {}),
  },
  timeout: 20000,
});

/** Turn an axios error into one sentence an operator can act on. */
export function errorMessage(err, fallback = 'Request failed') {
  if (!err) return fallback;
  const r = err.response;
  if (r) {
    const d = r.data || {};
    if (d.details && typeof d.details === 'object') {
      const first = Object.values(d.details).find((v) => typeof v === 'string');
      if (first) return first;
    }
    if (d.message) return d.message;
    if (r.status === 401) return 'The server needs an admin key. Add it in Connection settings.';
    if (r.status === 404) return 'Not found on the server.';
    return `${fallback} (HTTP ${r.status})`;
  }
  if (err.code === 'ECONNABORTED') return 'The server took too long to answer.';
  return "Can't reach the server. Check the connection and try again.";
}

// ---------- Drivers ----------
export const driverService = {
  getAll: () => api.get('/drivers'),
  get: (id) => api.get(`/drivers/${encodeURIComponent(id)}`),
  create: (driver) => api.post('/drivers', driver),
  update: (id, driver) => api.put(`/drivers/${encodeURIComponent(id)}`, driver),
  remove: (id) => api.delete(`/drivers/${encodeURIComponent(id)}`),
  validatePhone: (phone, excludeDriverId) =>
    api.get('/drivers/validate/phone', { params: { phone, ...(excludeDriverId ? { excludeDriverId } : {}) } }),
};

// ---------- Vehicles ----------
export const vehicleService = {
  getAll: () => api.get('/vehicles'),
  assign: (driverId, vehicle) => api.post(`/vehicles/assign/${encodeURIComponent(driverId)}`, vehicle),
  remove: (id) => api.delete(`/vehicles/${encodeURIComponent(id)}`),
};

// ---------- Tariff ----------
export const fareService = {
  get: () => api.get('/fare/get'),
  // Body must be a JSON object: axios sends `null` as the text "null", which the server
  // rejected as "Malformed JSON body" (29 Oct).
  change: ({ newRate, waitingRate, minimumFare }) =>
    api.post('/fare/change', {}, { params: { newRate, waitingRate, minimumFare, updatedBy: 'ADMIN_PANEL' } }),
  history: (limit = 30) => api.get('/fare/history', { params: { limit } }),
};

// ---------- Rides ----------
export const rideService = {
  recent: (hours = 24, limit = 500) => api.get('/fares/autometer/recent', { params: { hours, limit } }),
  query: ({ from, to, driverId, rideType, limit = 500, offset = 0 } = {}) =>
    api.get('/fares/autometer', { params: { from, to, driverId: driverId || undefined, rideType: rideType || undefined, limit, offset } }),
  submitTest: (ride) => api.post('/fares/autometer', ride),
};

// ---------- SOS ----------
export const drivingService = {
  events: ({ driverId, type, severity, from, to, excludeBumps, limit = 200, offset = 0 } = {}) =>
    api.get('/driving/events', {
      params: { driverId: driverId || undefined, type: type || undefined, severity: severity || undefined, from, to, excludeBumps: excludeBumps ? 1 : undefined, limit, offset },
    }),
  event: (id) => api.get(`/driving/events/${id}`),
  summary: (days = 7) => api.get('/driving/summary', { params: { days } }),
};

export const sosService = {
  open: () => api.get('/sos/alerts/active', { params: { includeAcknowledged: true } }),
  list: ({ status, driverId, limit = 200 } = {}) => api.get('/sos/alerts', { params: { status, driverId, limit } }),
  get: (id) => api.get(`/sos/alerts/${encodeURIComponent(id)}`),
  acknowledge: (id, by = 'ADMIN') => api.put(`/sos/alerts/${encodeURIComponent(id)}/acknowledge`, { by }),
  resolve: (id, notes, by = 'ADMIN') => api.put(`/sos/alerts/${encodeURIComponent(id)}/resolve`, { by, notes: notes || undefined }),
  // cabin-microphone recording of an SOS (WAV)
  audio: (id) => api.get(`/sos/alerts/${encodeURIComponent(id)}/audio`, { responseType: 'blob', timeout: 120000 }),
  sendTest: (alert) => api.post('/sos/alert', alert),
};

// ---------- Live data ----------
export const locationService = {
  live: () => api.get('/location/live'),
  history: (driverId, from, to) => api.get(`/location/history/${encodeURIComponent(driverId)}`, { params: { from, to } }),
};

export const deviceService = {
  getAll: () => api.get('/device/status'),
  history: (driverId, hours = 24) => api.get(`/device/status/${encodeURIComponent(driverId)}/history`, { params: { hours } }),
};

export const statsService = {
  dashboard: () => api.get('/stats/dashboard'),
  health: () => api.get('/health'),
};

export default api;
