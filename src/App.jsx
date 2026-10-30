import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { LiveProvider, useLive } from './live/LiveProvider';
import { ToastProvider } from './components/ui/Toast';
import { ThemeProvider } from './lib/theme';
import { useRoute } from './lib/hooks';
import { Brand, LinkStatus, NavList } from './components/layout/Sidebar';
import { NAV } from './lib/nav';
import SosStrip from './components/layout/SosStrip';
import ConnectionDialog from './components/layout/ConnectionDialog';
import { Loading } from './components/ui/bits';

const pages = {
  overview: lazy(() => import('./pages/Overview')),
  map: lazy(() => import('./pages/LiveMap')),
  sos: lazy(() => import('./pages/Sos')),
  rides: lazy(() => import('./pages/Rides')),
  safety: lazy(() => import('./pages/Safety')),
  fleet: lazy(() => import('./pages/Fleet')),
  drivers: lazy(() => import('./pages/Drivers')),
  tariff: lazy(() => import('./pages/Tariff')),
};

function Shell() {
  const { path } = useRoute();
  const { openAlerts, activeAlerts } = useLive();
  const [drawer, setDrawer] = useState(false);
  const [connOpen, setConnOpen] = useState(false);
  const Page = pages[path] || pages.overview;
  const active = pages[path] ? path : 'overview';
  const fullBleed = active === 'map';

  const mainRef = useRef(null);
  useEffect(() => {
    setDrawer(false);
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [path]);

  const openConnection = () => {
    setDrawer(false);
    setConnOpen(true);
  };

  return (
    <div className="flex h-[100dvh] flex-col lg:pl-[236px]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[3000] focus:rounded-ctl focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-[950] hidden w-[236px] flex-col bg-cng px-3 pb-3 pt-5 lg:flex">
        <div className="px-2 pb-6">
          <Brand />
        </div>
        <NavList active={active} />
        <div className="mt-auto border-t border-white/10 pt-3">
          <LinkStatus onClick={openConnection} />
        </div>
      </aside>

      {/* Mobile bar */}
      <header className="z-[950] flex h-14 flex-none items-center gap-3 bg-cng px-4 lg:hidden">
        <button className="icon-btn -ml-2 text-white hover:bg-white/10 hover:text-white" onClick={() => setDrawer(true)} aria-label="Open menu">
          <Menu />
        </button>
        <Brand compact />
        <span className="ml-auto text-sm font-semibold text-white/80">{NAV.find((n) => n.id === active)?.label}</span>
        {openAlerts.length > 0 && (
          <a href="#/sos" className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${activeAlerts.length ? 'beacon bg-signal text-white' : 'bg-canopy text-canopy-ink'}`}>
            SOS {openAlerts.length}
          </a>
        )}
      </header>

      {drawer && (
        <div className="fixed inset-0 z-[1200] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <div className="toast-in absolute inset-y-0 left-0 flex w-[272px] max-w-[85vw] flex-col bg-cng px-3 pb-3 pt-4">
            <div className="flex items-center justify-between px-2 pb-5">
              <Brand />
              <button className="icon-btn text-white hover:bg-white/10 hover:text-white" onClick={() => setDrawer(false)} aria-label="Close menu">
                <X />
              </button>
            </div>
            <NavList active={active} onNavigate={() => setDrawer(false)} />
            <div className="mt-auto border-t border-white/10 pt-3">
              <LinkStatus onClick={openConnection} />
            </div>
          </div>
        </div>
      )}

      <SosStrip />

      <main id="main" ref={mainRef} tabIndex={-1} className="scroll-thin min-h-0 flex-1 overflow-y-auto outline-none">
        <div className={fullBleed ? 'h-full' : 'mx-auto w-full max-w-[1400px] px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8'}>
          <Suspense fallback={<Loading />}>
            <Page />
          </Suspense>
        </div>
      </main>

      <ConnectionDialog open={connOpen} onClose={() => setConnOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <LiveProvider>
          <Shell />
        </LiveProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
