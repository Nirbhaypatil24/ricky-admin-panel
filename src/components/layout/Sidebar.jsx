import { Settings2 } from 'lucide-react';
import { NAV } from '../../lib/nav';
import { useLive } from '../../live/LiveProvider';
import { useNow } from '../../lib/hooks';
import { time } from '../../lib/format';

export function Brand({ compact = false }) {
  return (
    <a href="#/overview" className="flex items-center gap-2.5 rounded-ctl">
      <img src="/ricky.svg" alt="" className="h-9 w-9 rounded-[9px] ring-1 ring-white/15" />
      <span className="leading-none">
        <span className="block font-display text-2xl font-bold tracking-tight text-white">Ricky</span>
        {!compact && <span className="mt-0.5 block text-xs font-medium text-white/60">Control room</span>}
      </span>
    </a>
  );
}

export function LinkStatus({ onClick }) {
  const { link, api } = useLive();
  const now = useNow();
  const state = api.ok === false ? 'down' : link;
  const label = state === 'live' ? 'Live' : state === 'connecting' ? 'Connecting' : api.ok === false ? 'Server unreachable' : 'Polling every 10 s';
  const dot = state === 'live' ? 'bg-[#5BE39A]' : state === 'connecting' ? 'bg-canopy' : 'bg-[#FF8A7A]';
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-ctl px-3 py-2.5 text-left text-white/85 transition-colors hover:bg-white/10">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot} ${state === 'live' ? '' : 'beacon'}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="block text-xs text-white/60">{time(now)} IST</span>
      </span>
      <Settings2 className="h-4 w-4 text-white/60" aria-label="Connection and alerts" />
    </button>
  );
}

export function NavList({ active, onNavigate }) {
  const { activeAlerts, openAlerts } = useLive();
  return (
    <nav aria-label="Main" className="space-y-0.5">
      {NAV.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        const badge = item.id === 'sos' && openAlerts.length ? openAlerts.length : null;
        return (
          <a
            key={item.id}
            href={`#/${item.id}`}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={`group relative flex items-center gap-3 rounded-ctl px-3 py-2.5 text-[0.95rem] font-semibold transition-colors ${
              isActive ? 'bg-white/[0.12] text-white' : 'text-white/70 hover:bg-white/[0.07] hover:text-white'
            }`}
          >
            {isActive && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-canopy" aria-hidden />}
            <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-canopy' : ''}`} />
            <span className="flex-1">{item.label}</span>
            {badge && (
              <span className={`min-w-[22px] rounded-full px-1.5 text-center text-xs font-bold leading-[22px] ${activeAlerts.length ? 'beacon bg-signal text-white' : 'bg-canopy text-canopy-ink'}`}>
                {badge}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
}
