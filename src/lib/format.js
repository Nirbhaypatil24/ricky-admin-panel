// Formatting helpers. Everything is shown in Indian Standard Time and Indian number grouping.
export const TZ = 'Asia/Kolkata';

const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('en-IN');

export function rupees(n, { exact = false } = {}) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  if (exact || !Number.isInteger(v)) return inr2.format(v);
  return inr0.format(v);
}

export function rupeesRounded(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return inr0.format(Math.round(Number(n)));
}

export function count(n) {
  if (n === null || n === undefined) return '—';
  return num.format(n);
}

export function km(n, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toFixed(digits)} km`;
}

export function minutes(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const v = Math.round(Number(n));
  if (v < 60) return `${v} min`;
  return `${Math.floor(v / 60)} h ${v % 60} min`;
}

const timeFmt = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: TZ,
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});
const dayFmt = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short' });
const fullFmt = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'medium' });

const valid = (d) => d && !Number.isNaN(new Date(d).getTime());

export const time = (d) => (valid(d) ? timeFmt.format(new Date(d)) : '—');
export const dateTime = (d) => (valid(d) ? dateTimeFmt.format(new Date(d)) : '—');
export const day = (d) => (valid(d) ? dayFmt.format(new Date(d)) : '—');
export const fullDate = (d) => (valid(d) ? fullFmt.format(new Date(d)) : '—');

/** "just now", "4 min ago", "2 h ago", "3 days ago" */
export function ago(d, now = Date.now()) {
  if (!valid(d)) return 'never';
  const s = Math.max(0, Math.round((now - new Date(d).getTime()) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** Elapsed clock for live SOS timers: 0:42, 12:05, 1:03:20 */
export function elapsed(d, now = Date.now()) {
  if (!valid(d)) return '—';
  const s = Math.max(0, Math.floor((now - new Date(d).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Response time between two instants, e.g. "1 min 12 s" */
export function span(from, to) {
  if (!valid(from) || !valid(to)) return null;
  const s = Math.max(0, Math.round((new Date(to) - new Date(from)) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60} s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Start of today in IST, as a Date */
export function startOfTodayIST(now = new Date()) {
  const offset = 330 * 60000;
  const local = new Date(now.getTime() + offset);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset);
}

/** Hour of day (0–23) in IST */
export function hourIST(d) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date(d))) % 24;
}

/** YYYY-MM-DD in IST */
export function dateKeyIST(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d));
}

/** "MH20XX2020" -> "MH 20 XX 2020" (same rule as the passenger screen) */
export function plate(p) {
  if (!p) return null;
  const s = String(p).toUpperCase().replace(/[\s-]/g, '');
  const m = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/.exec(s);
  return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join(' ') : s;
}

export const coords = (lat, lng, digits = 5) =>
  lat === null || lat === undefined || lng === null || lng === undefined ? '—' : `${Number(lat).toFixed(digits)}, ${Number(lng).toFixed(digits)}`;

export const mapsLink = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
