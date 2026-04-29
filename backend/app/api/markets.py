"""Market data endpoints — crypto via Binance, prediction via Polymarket."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status

from ..config import get_settings
from ..services import polymarket
from ..services.binance import (
    NAMES,
    base_quote,
    display_symbol,
    fetch_klines,
    fetch_many_tickers_concurrently,
    fetch_orderbook,
)
from ..services.indicators import ema_trend_bias, rsi as rsi_calc

router = APIRouter(prefix="/markets", tags=["markets"])


def _bias_label(rsi_val: float | None) -> str:
    if rsi_val is None:
        return "neutral"
    if rsi_val > 60:
        return "long"
    if rsi_val < 40:
        return "short"
    return "neutral"


@router.get("/crypto")
async def list_crypto() -> dict[str, Any]:
    """Return enriched ticker rows for all configured pairs."""
    settings = get_settings()
    symbols = settings.default_pairs
    tickers = await fetch_many_tickers_concurrently(symbols)
    out: list[dict[str, Any]] = []

    for sym in symbols:
        t = tickers.get(sym)
        # Pull a thin sparkline (24 hourly closes).
        klines = await fetch_klines(sym, interval="1h", limit=40)
        spark = [k["v"] for k in klines]
        if not t:
            # Endpoint failed — still emit a placeholder so the UI isn't blank.
            base, quote = base_quote(sym)
            out.append(
                {
                    "symbol": display_symbol(sym),
                    "base": base,
                    "quote": quote,
                    "name": NAMES.get(sym, base),
                    "price": spark[-1] if spark else 0.0,
                    "change24h": 0.0,
                    "volume24h": 0.0,
                    "marketCap": None,
                    "rsi": 50.0,
                    "emaTrend": "neutral",
                    "sparkline": spark,
                }
            )
            continue
        base, quote = base_quote(sym)
        rsi_series = rsi_calc(spark, 14) if len(spark) > 15 else []
        last_rsi = rsi_series[-1] if rsi_series else None
        out.append(
            {
                "symbol": display_symbol(sym),
                "base": base,
                "quote": quote,
                "name": NAMES.get(sym, base),
                "price": float(t.get("lastPrice", 0)),
                "change24h": float(t.get("priceChangePercent", 0)),
                "volume24h": float(t.get("quoteVolume", 0)),
                "marketCap": None,  # Binance doesn't provide it
                "rsi": float(last_rsi) if last_rsi is not None else 50.0,
                "emaTrend": ema_trend_bias(spark) if len(spark) >= 50 else _bias_label(last_rsi),
                "sparkline": spark,
            }
        )
    return {"data": out}


@router.get("/crypto/{symbol}")
async def crypto_detail(symbol: str) -> dict[str, Any]:
    """`symbol` may be 'BTC/USDT' or 'BTCUSDT' — both accepted."""
    sym = symbol.replace("/", "").upper()
    tickers = await fetch_many_tickers_concurrently([sym])
    t = tickers.get(sym)
    series = await fetch_klines(sym, interval="1h", limit=168)
    if not series:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Market {sym} not found"
        )
    closes = [k["v"] for k in series]
    last_rsi = (rsi_calc(closes, 14) or [None])[-1]
    base, quote = base_quote(sym)
    return {
        "symbol": display_symbol(sym),
        "base": base,
        "quote": quote,
        "name": NAMES.get(sym, base),
        "price": float(t.get("lastPrice", closes[-1])) if t else closes[-1],
        "change24h": float(t.get("priceChangePercent", 0)) if t else 0.0,
        "volume24h": float(t.get("quoteVolume", 0)) if t else 0.0,
        "marketCap": None,
        "rsi": float(last_rsi) if last_rsi is not None else 50.0,
        "emaTrend": ema_trend_bias(closes),
        "sparkline": closes[-40:],
        "indicators": {"rsi": last_rsi, "ema_bias": ema_trend_bias(closes)},
        "series": series,
    }


@router.get("/crypto/{symbol}/orderbook")
async def crypto_orderbook(symbol: str) -> dict[str, Any]:
    sym = symbol.replace("/", "").upper()
    return await fetch_orderbook(sym)


@router.get("/polymarket")
async def list_polymarket(limit: int = 30) -> dict[str, Any]:
    rows = await polymarket.fetch_active_markets(limit=limit)
    return {"data": rows}


@router.get("/polymarket/{slug}")
async def polymarket_detail(slug: str) -> dict[str, Any]:
    m = await polymarket.fetch_market(slug)
    if m is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Polymarket '{slug}' not found"
        )
    return m
