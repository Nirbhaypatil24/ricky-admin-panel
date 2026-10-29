// Where the panel talks to. Priority: saved in this browser (Connection settings) → build env → default.
//
//   VITE_API_BASE_URL   e.g. https://api.yourdomain.in/api
//   VITE_WS_URL         e.g. wss://api.yourdomain.in/ws-ricky   (derived from the API URL when unset)
//   VITE_ADMIN_API_KEY  only when ADMIN_API_KEY is set on the backend

const DEFAULT_API = 'https://ec2-3-109-49-80.ap-south-1.compute.amazonaws.com/api';
const STORE_KEY = 'ricky.connection';

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function wsFromApi(apiUrl) {
  try {
    const u = new URL(apiUrl, window.location.href);
    u.protocol = u.protocol === 'http:' ? 'ws:' : 'wss:';
    u.pathname = u.pathname.replace(/\/api\/?$/, '') + '/ws-ricky';
    u.search = '';
    return u.toString().replace(/\/\/ws-ricky$/, '/ws-ricky');
  } catch {
    return '';
  }
}

export function getDefaults() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || DEFAULT_API;
  return {
    apiBaseUrl,
    wsUrl: import.meta.env.VITE_WS_URL || wsFromApi(apiBaseUrl),
    adminKey: import.meta.env.VITE_ADMIN_API_KEY || '',
  };
}

export function getConnection() {
  const d = getDefaults();
  const s = readSaved();
  const apiBaseUrl = (s.apiBaseUrl || d.apiBaseUrl).replace(/\/+$/, '');
  return {
    apiBaseUrl,
    wsUrl: s.wsUrl || (s.apiBaseUrl ? wsFromApi(apiBaseUrl) : d.wsUrl),
    adminKey: s.adminKey ?? d.adminKey,
    custom: Boolean(s.apiBaseUrl || s.wsUrl || s.adminKey),
  };
}

export function saveConnection(next) {
  try {
    if (!next) localStorage.removeItem(STORE_KEY);
    else localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* private mode: settings only last for this tab */
  }
}
