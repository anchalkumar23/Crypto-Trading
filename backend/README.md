# Vega Lab — Backend

FastAPI + SQLAlchemy (async) + SQLite, with an APScheduler-driven trading engine
that pulls live Binance public data and runs registered strategies against paper
portfolios.

## Quick start (Windows)

You need **Python 3.11+** and `pip`. Verify:

```cmd
python --version
pip --version
```

If Python isn't installed, grab it from <https://python.org> and tick *Add to PATH*.

```cmd
cd "C:\Anchal\Fiverr\Claude setup for crypto\backend"

REM Create + activate a virtual environment (strongly recommended)
python -m venv .venv
.venv\Scripts\activate

pip install -r requirements.txt

REM Copy .env.example to .env and edit secrets
copy .env.example .env

REM Generate an encryption key (the .env requires SECRETS_ENCRYPTION_KEY)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
REM Paste the printed value into .env as SECRETS_ENCRYPTION_KEY=...

REM Run!
uvicorn app.main:app --reload --port 8000
```

You should see:

```
INFO     Uvicorn running on http://127.0.0.1:8000
INFO     Vega Lab starting up…
INFO     seeded strategy rsi_meanrev
INFO     seeded strategy ema_cross
INFO     seeded admin user admin@vegalab.local + 3 sample portfolios
INFO     Engine scheduler started — tick every 30s
```

Open <http://localhost:8000/docs> for the auto-generated Swagger UI.

## What the engine does

Every `ENGINE_TICK_SECONDS` (default 30):

1. Pulls active `strategy_runs` from the DB.
2. Fetches recent klines for each (symbol, timeframe) from Binance public REST.
3. Instantiates the strategy class from `services/strategies/registry.py`.
4. Calls `strategy.decide()` and applies the resulting `Decision` via the paper
   wallet — risk caps enforced server-side per CLAUDE.md §9.
5. Writes an audit-log row for every order.
6. Computes a fresh `equity_point` per portfolio and broadcasts a `tick` event
   over the WebSocket so the UI's *Engine ticking* indicator stays alive.

## Initial credentials

A first-run admin is created from `.env`:

- **Email:** `admin@vegalab.local`
- **Password:** `ChangeMeNow!`

The frontend auto-logs-in with those credentials on first load. Change them in
`.env` (or via the API) before exposing this anywhere.

## Routes

```
POST   /api/auth/login
POST   /api/auth/setup            (only valid until first user exists)
GET    /api/auth/me

GET    /api/markets/crypto
GET    /api/markets/crypto/{symbol}
GET    /api/markets/crypto/{symbol}/orderbook
GET    /api/markets/polymarket
GET    /api/markets/polymarket/{slug}

GET    /api/portfolios
POST   /api/portfolios
GET    /api/portfolios/{id}
PATCH  /api/portfolios/{id}
POST   /api/portfolios/{id}/reset
DELETE /api/portfolios/{id}

GET    /api/strategies
GET    /api/strategies/runs
POST   /api/strategies/runs
POST   /api/strategies/runs/{id}/{pause|resume|stop}

GET    /api/backtests
POST   /api/backtests             (queued; runs in BackgroundTasks)

GET    /api/trades

GET    /api/settings
PATCH  /api/settings
POST   /api/settings/api-keys
DELETE /api/settings/api-keys/{id}

POST   /api/kill                  (halts all runs, disables live trading)

WS     /ws                        (tick + trade events)
```

## Database

SQLite file `vegalab.db` lives in the working directory. Wipe it to start fresh:

```cmd
del vegalab.db
```

Tables are created automatically on startup. To upgrade to Postgres for prod,
set `DATABASE_URL=postgres+asyncpg://user:pass@host:5432/dbname` and add
`asyncpg` to `requirements.txt`.

## Safety notes (CLAUDE.md §9 implemented)

- Live trading is OFF by default at the application level (`liveTradingEnabled`
  in `app_settings`) AND at portfolio level (`portfolio.kind = 'paper'`).
- API keys are encrypted at rest with Fernet using `SECRETS_ENCRYPTION_KEY`.
- Daily loss limit + max position size + max open positions enforced in
  `services/risk.py` before every order.
- Every state-changing action writes an `audit_log` row.
- `POST /api/kill` halts every running strategy run and locks live trading.
- Polymarket trading is intentionally not implemented (read-only, per §10).
