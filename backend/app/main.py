"""Vega Lab — FastAPI entry point.

Run with:
    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import api_router
from .api.ws import router as ws_router
from .config import get_settings
from .db import init_db
from .seed import seed_initial_data
from .services.engine import tick_once

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s :: %(message)s",
)
log = logging.getLogger("vegalab")
settings = get_settings()
scheduler = AsyncIOScheduler(timezone="UTC")


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    log.info("Vega Lab starting up…")
    await init_db()
    await seed_initial_data()

    # Schedule the engine tick.
    scheduler.add_job(
        tick_once,
        IntervalTrigger(seconds=settings.engine_tick_seconds),
        id="engine-tick",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=30,
    )
    scheduler.start()
    log.info("Engine scheduler started — tick every %ss", settings.engine_tick_seconds)
    try:
        yield
    finally:
        log.info("Vega Lab shutting down…")
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="Vega Lab API",
    version="0.1.0",
    description="Crypto research, paper trading, and strategy backtesting.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "vegalab", "version": "0.1.0"}


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "Vega Lab",
        "docs": "/docs",
        "frontend": settings.frontend_origin,
    }
