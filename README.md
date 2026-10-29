# Ricky control room (admin panel)

Web console for the Ricky VLTD + fare meter fleet: live map, SOS desk, rides, fleet health, drivers and tariff.
React 19 + Vite + Tailwind 3 + Leaflet, talking to `ricky-backend-mysql` over REST and the STOMP websocket.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm run lint
```

## Where it connects

Set these at build time (Vercel → Project → Settings → Environment Variables), or change them for one browser
in the panel under **Connection and alerts** (bottom of the sidebar):

| Variable | Default |
|---|---|
| `VITE_API_BASE_URL` | `https://ec2-3-109-49-80.ap-south-1.compute.amazonaws.com/api` |
| `VITE_WS_URL` | derived from the API address: `wss://<host>/ws-ricky` |
| `VITE_ADMIN_API_KEY` | empty; only needed when `ADMIN_API_KEY` is set on the backend |

The backend must allow the panel's origin in `CORS_ORIGINS`. Browsers refuse a self-signed certificate, so the
API needs a real certificate (see the backend's `deploy/AWS_DEPLOYMENT.md`).

## Pages

| Page | What it does | Backend |
|---|---|---|
| Overview | vehicles on the road by meter mode, today's fares, map, problems that need attention, fares by hour | `/stats/dashboard`, `/fares/autometer/recent` |
| Live map | every vehicle coloured by mode, search and filters, vehicle details, today's route | `/location/live`, `/location/history/{id}`, `/topic/locations` |
| SOS desk | open alerts with live timers, acknowledge, resolve with notes, call driver, history with response times | `/sos/alerts/*`, `/topic/sos-alerts`, `/topic/sos-updates` |
| Rides | today / 7 / 30 days, by driver and type, fare breakdown, CSV export | `/fares/autometer` |
| Fleet health | battery, ESP link, GPS source, meter mode per vehicle; add, edit, remove vehicles | `/vehicles`, `/device/status`, `/topic/device-status` |
| Drivers | add, edit, deactivate, remove; live phone-number check | `/drivers` |
| Tariff | per-km, waiting and minimum fare, fare-chart preview, history | `/fare/get`, `/fare/change`, `/fare/history` |

An open SOS shows a red bar on every page, sounds an alarm (after the first click on the page, as browsers
require) and can raise desktop notifications. The page title shows the number of open SOS alerts.

## Code layout

```
src/lib/          api client, connection settings, formatting (IST, ₹), fleet model, hooks, theme
src/live/         LiveProvider: REST snapshot + STOMP updates, alarm, notifications
src/components/   layout (sidebar, SOS bar, connection dialog), map, chart, forms, ui primitives
src/pages/        one file per page
```

The previous UI is in `_backup_before_admin_redesign_2026-10-29/`.
