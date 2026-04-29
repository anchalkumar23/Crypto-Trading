# Vega Lab

Self-hosted crypto research & paper-trading web app.

- **Frontend** — Vite + React + TypeScript + Tailwind, dark-themed, fully
  responsive. Talks to the backend over REST + WebSocket.
- **Backend** — FastAPI + SQLAlchemy (async) + SQLite, with an APScheduler
  engine that runs registered strategies on live Binance public data.

See per-folder READMEs for details:

- [`frontend/README.md`](frontend/README.md) — UI, design system, routing
- [`backend/README.md`](backend/README.md) — API, engine, safety rules

## What you need installed

- **Python 3.11+** — for the backend (<https://python.org>)
- **Node.js 20+** — for the frontend (<https://nodejs.org>)

Both must be on `PATH`. Verify in a fresh terminal:

```cmd
python --version
node --version
```

## Run both servers

Open **two terminals**.

### Terminal 1 — backend

```cmd
cd "C:\Anchal\Fiverr\Claude setup for crypto\backend"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env

REM Generate an encryption key and paste into .env as SECRETS_ENCRYPTION_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

uvicorn app.main:app --reload --port 8000
```

The backend creates `vegalab.db` (SQLite), seeds an admin user + sample
portfolios + the strategy registry, and starts the engine. Swagger UI at
<http://localhost:8000/docs>.

### Terminal 2 — frontend

```cmd
cd "C:\Anchal\Fiverr\Claude setup for crypto\frontend"
npm install
npm run dev
```

Open <http://localhost:5173>. The frontend auto-logs-in as the seeded admin and
talks to the backend at `http://localhost:8000`.

## Without a backend

The frontend keeps working — it falls back to seeded sample data on every page
that the backend would otherwise drive, with a small banner so you know.

## Default credentials (change in `.env`)

- **Email:** `admin@vegalab.local`
- **Password:** `ChangeMeNow!`

## Project layout

```
.
├── frontend/                 React UI
│   ├── src/
│   │   ├── lib/api.ts        Typed API client (TanStack Query)
│   │   ├── routes/           One folder per page
│   │   ├── components/       UI primitives + charts + layout
│   │   └── lib/mock-data.ts  Fallback data when backend is offline
│   └── package.json
├── backend/                  FastAPI app
│   ├── app/
│   │   ├── main.py           App entry + lifespan + scheduler
│   │   ├── api/              Route modules
│   │   ├── services/         Engine, strategies, indicators, exchange clients
│   │   ├── models.py         SQLAlchemy ORM
│   │   └── schemas.py        Pydantic v2 DTOs
│   └── requirements.txt
└── CLAUDE.md                 Project spec (source of truth)
```

## Safety

Per [CLAUDE.md §9](./CLAUDE.md), this is a financial system — defaults protect
the user. Live trading is OFF at the application AND portfolio level. API keys
are encrypted at rest. The kill switch (`POST /api/kill` or the danger button
in the top bar) halts every running strategy and locks live trading. Polymarket
trading is intentionally read-only in v1.

**This software is for personal research and education. None of this is financial advice.**
