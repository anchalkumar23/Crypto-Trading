"""Router aggregator."""

from fastapi import APIRouter

from . import (
    auth,
    backtests,
    kill,
    markets,
    portfolios,
    settings,
    strategies,
    trades,
    ws,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(markets.router)
api_router.include_router(portfolios.router)
api_router.include_router(strategies.router)
api_router.include_router(backtests.router)
api_router.include_router(trades.router)
api_router.include_router(settings.router)
api_router.include_router(kill.router)

# WebSocket router is mounted directly on the app (no /api prefix), see main.py.
