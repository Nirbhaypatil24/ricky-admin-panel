import { useEffect, useState } from 'react';
import axios from 'axios';
import { Bell, CheckCircle2, Monitor, Moon, Sun, TriangleAlert } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Field, Segmented } from '../ui/bits';
import { getConnection, getDefaults, saveConnection, wsFromApi } from '../../lib/config';
import { useLive } from '../../live/LiveProvider';
import { useThemeContext } from '../../lib/theme';
import { ago } from '../../lib/format';
import { soundAvailable } from '../../lib/alarm';

/** Server status, where the panel connects, theme and alert settings */
export default function ConnectionDialog({ open, onClose }) {
  const { link, api, notifyPermission, requestNotify } = useLive();
  const { theme, setTheme } = useThemeContext();
  const current = getConnection();
  const [form, setForm] = useState({ apiBaseUrl: current.apiBaseUrl, wsUrl: current.wsUrl, adminKey: current.adminKey });
  const [health, setHealth] = useState({ state: 'idle' });

  const check = async (base) => {
    setHealth({ state: 'checking' });
    try {
      const root = base.replace(/\/api\/?$/, '');
      const { data } = await axios.get(`${root}/health`, { timeout: 8000 });
      setHealth({ state: 'ok', data });
    } catch (e) {
      setHealth({ state: 'error', message: e.response ? `Server answered HTTP ${e.response.status}` : "Can't reach this address from your browser." });
    }
  };

  useEffect(() => {
    if (open) {
      const c = getConnection();
      setForm({ apiBaseUrl: c.apiBaseUrl, wsUrl: c.wsUrl, adminKey: c.adminKey });
      check(c.apiBaseUrl);
    }
  }, [open]);

  const save = () => {
    const d = getDefaults();
    const next = {
      apiBaseUrl: form.apiBaseUrl.trim() !== d.apiBaseUrl ? form.apiBaseUrl.trim() : undefined,
      wsUrl: form.wsUrl.trim() && form.wsUrl.trim() !== wsFromApi(form.apiBaseUrl.trim()) ? form.wsUrl.trim() : undefined,
      adminKey: form.adminKey.trim() !== d.adminKey ? form.adminKey.trim() : undefined,
    };
    saveConnection(Object.values(next).some((v) => v !== undefined) ? next : null);
    window.location.reload();
  };

  const reset = () => {
    saveConnection(null);
    window.location.reload();
  };

  const changed = form.apiBaseUrl !== current.apiBaseUrl || form.wsUrl !== current.wsUrl || form.adminKey !== current.adminKey;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connection and alerts"
      description="Where this panel gets its data, and how it tells you about an SOS."
      width="max-w-xl"
      footer={
        <>
          {current.custom && (
            <button className="btn-quiet mr-auto" onClick={reset}>
              Use default server
            </button>
          )}
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn-dark" onClick={save} disabled={!changed}>
            Save and reload
          </button>
        </>
      }
    >
      <div className="space-y-6 pb-2">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatusTile label="Server" ok={health.state === 'ok' && health.data?.db === 'UP'} warn={health.state === 'ok' && health.data?.db !== 'UP'}>
            {health.state === 'checking' && 'Checking…'}
            {health.state === 'ok' && (health.data?.db === 'UP' ? `Up, version ${health.data.version || 'unknown'}` : 'Database down')}
            {health.state === 'error' && 'Unreachable'}
          </StatusTile>
          <StatusTile label="Live updates" ok={link === 'live'} warn={link === 'connecting'}>
            {link === 'live' ? 'Connected' : link === 'connecting' ? 'Connecting…' : 'Reconnecting'}
          </StatusTile>
          <StatusTile label="Last refresh" ok={api.ok} warn={api.ok === null}>
            {api.at ? ago(api.at) : 'Not yet'}
          </StatusTile>
        </section>
        {health.state === 'error' && <p className="-mt-3 text-sm text-signal">{health.message}</p>}
        {api.error && <p className="-mt-3 text-sm text-signal">{api.error}</p>}

        <section className="space-y-4">
          <Field label="API address" hint="Ends in /api. Changes apply to this browser only." htmlFor="c-api">
            <input id="c-api" className="field" value={form.apiBaseUrl} onChange={(e) => setForm((f) => ({ ...f, apiBaseUrl: e.target.value, wsUrl: wsFromApi(e.target.value) }))} spellCheck={false} />
          </Field>
          <Field label="Live updates address" hint="The backend's STOMP websocket, usually …/ws-ricky." htmlFor="c-ws">
            <input id="c-ws" className="field" value={form.wsUrl} onChange={(e) => setForm((f) => ({ ...f, wsUrl: e.target.value }))} spellCheck={false} />
          </Field>
          <Field label="Admin key" hint="Only needed when ADMIN_API_KEY is set on the server." htmlFor="c-key">
            <input id="c-key" className="field" type="password" autoComplete="off" value={form.adminKey} onChange={(e) => setForm((f) => ({ ...f, adminKey: e.target.value }))} />
          </Field>
          <button className="btn-ghost btn-sm" onClick={() => check(form.apiBaseUrl)}>
            Test this address
          </button>
        </section>

        <section className="space-y-3 border-t border-line pt-5">
          <h3 className="font-display text-lg font-semibold">SOS alerts</h3>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Desktop notifications</p>
              <p className="text-sm text-muted">
                {notifyPermission === 'granted' && 'On. An SOS shows a notification even when this tab is in the background.'}
                {notifyPermission === 'default' && 'Get a notification for every new SOS, even when this tab is in the background.'}
                {notifyPermission === 'denied' && 'Blocked in this browser. Allow notifications for this site in the browser settings.'}
                {notifyPermission === 'unsupported' && 'This browser does not support notifications.'}
              </p>
            </div>
            {notifyPermission === 'default' && (
              <button className="btn-ghost btn-sm" onClick={requestNotify}>
                <Bell /> Turn on
              </button>
            )}
          </div>
          <div>
            <p className="font-semibold">Alarm sound</p>
            <p className="text-sm text-muted">
              {soundAvailable()
                ? 'Ready. The alarm repeats until someone acknowledges the SOS.'
                : 'Browsers allow sound only after you click once on the page. Click anywhere in the panel to arm it.'}
            </p>
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <h3 className="font-display text-lg font-semibold">Theme</h3>
          <Segmented
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: <span className="inline-flex items-center gap-1.5"><Sun className="h-3.5 w-3.5" />Light</span> },
              { value: 'dark', label: <span className="inline-flex items-center gap-1.5"><Moon className="h-3.5 w-3.5" />Dark</span> },
              { value: 'system', label: <span className="inline-flex items-center gap-1.5"><Monitor className="h-3.5 w-3.5" />System</span> },
            ]}
          />
        </section>
      </div>
    </Modal>
  );
}

function StatusTile({ label, ok, warn, children }) {
  const Icon = ok ? CheckCircle2 : TriangleAlert;
  const color = ok ? 'text-ok' : warn ? 'text-caution' : 'text-signal';
  return (
    <div className="rounded-ctl border border-line px-3 py-2.5">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 font-semibold">
        <Icon className={`h-4 w-4 ${color}`} />
        {children}
      </p>
    </div>
  );
}
