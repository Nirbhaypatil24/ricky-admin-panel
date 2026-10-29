import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

// ---------- clock ----------
// One shared ticker so every "2 min ago" and SOS timer on screen updates together.
const clockListeners = new Set();
let clockNow = Date.now();
let clockTimer = null;
function subscribeClock(cb) {
  clockListeners.add(cb);
  if (!clockTimer) {
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      clockListeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    clockListeners.delete(cb);
    if (!clockListeners.size) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}
export function useNow() {
  return useSyncExternalStore(subscribeClock, () => clockNow);
}

// ---------- hash router ----------
function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { path: path || 'overview', params: Object.fromEntries(new URLSearchParams(query)) };
}
let routeSnapshot = parseHash();
let routeKey = window.location.hash;
function subscribeRoute(cb) {
  const handler = () => {
    routeSnapshot = parseHash();
    routeKey = window.location.hash;
    cb();
  };
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}
function getRoute() {
  if (routeKey !== window.location.hash) {
    routeSnapshot = parseHash();
    routeKey = window.location.hash;
  }
  return routeSnapshot;
}
export function useRoute() {
  return useSyncExternalStore(subscribeRoute, getRoute);
}
export function navigate(path, params) {
  const q = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString() : '';
  window.location.hash = `/${path}${q ? `?${q}` : ''}`;
}

// ---------- data loading ----------
/**
 * Load data with loading/error state. `deps` re-run the loader; `reload()` re-runs on demand
 * without blanking what's already on screen.
 */
export function useLoad(loader, deps = [], { interval } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const seq = useRef(0);

  const run = useCallback(async (quiet) => {
    const id = ++seq.current;
    if (!quiet) setState((s) => ({ ...s, loading: true }));
    try {
      const data = await loaderRef.current();
      if (id === seq.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === seq.current) setState((s) => ({ ...s, error, loading: false }));
    }
  }, []);

  useEffect(() => {
    run(false);
    if (!interval) return undefined;
    const t = setInterval(() => run(true), interval);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, interval, ...deps]);

  return { ...state, reload: () => run(true), setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) };
}

// ---------- theme ----------
const THEME_KEY = 'ricky.theme';
export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || 'system';
    } catch {
      return 'system';
    }
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const h = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  return { theme, resolved, setTheme: setThemeState };
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const h = (e) => setMatches(e.matches);
    mq.addEventListener('change', h);
    setMatches(mq.matches);
    return () => mq.removeEventListener('change', h);
  }, [query]);
  return matches;
}
