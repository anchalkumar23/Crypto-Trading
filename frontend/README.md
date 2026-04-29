# Vega Lab — Frontend

Vite + React 18 + TypeScript + Tailwind 3 + TanStack Query. Dark-themed,
responsive, designed to feel at home next to TradingView.

## Run

```cmd
cd "C:\Anchal\Fiverr\Claude setup for crypto\frontend"
npm install
npm run dev
```

Open <http://localhost:5173>.

The frontend auto-logs-in to the backend at `http://localhost:8000` using the
seeded admin credentials. If the backend is offline, the UI falls back to
seeded sample data on every page.

To point at a different backend, set `VITE_API_BASE` in a `.env.local` file:

```
VITE_API_BASE=http://192.168.0.42:8000
```

## Pages

- `/` — Dashboard
- `/markets` and `/markets/:symbol` — Crypto markets (live Binance data)
- `/polymarket` and `/polymarket/:slug` — Prediction markets (Polymarket Gamma)
- `/portfolios` and `/portfolios/:id` — Paper portfolios
- `/strategies` — Strategy registry + run controls
- `/backtests` — Run history + side-by-side comparison
- `/settings` — Watched pairs, API keys, live-trading kill switch

## Design system (`tailwind.config.js`)

| Token       | Value                                |
| ----------- | ------------------------------------ |
| `bg`        | `#0a0d16` — deep navy app background |
| `bg-card`   | `#131828` — card surface             |
| `border`    | `#222a3f` — default hairline         |
| `ink`       | `#e6eaf2` — primary text             |
| `ink-muted` | `#8b94ad` — secondary text           |
| `brand`    | `#7c5cff` — purple accent            |
| `bull`     | `#22c55e` — gains                    |
| `bear`     | `#ef4444` — losses                   |

## Build

```cmd
npm run build
npm run preview
```
