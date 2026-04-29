"""Binance public-data client. No API key needed for read-only endpoints.

Uses httpx directly rather than ccxt for lighter install footprint on Windows.
The interface is small enough that swapping in ccxt later is trivial.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import httpx

PUBLIC_BASE = "https://api.binance.com"

# Mapping of symbol -> friendly name (used to enrich market list).
NAMES: dict[str, str] = {
    "BTCUSDT": "Bitcoin",
    "ETHUSDT": "Ethereum",
    "SOLUSDT": "Solana",
    "BNBUSDT": "BNB",
    "XRPUSDT": "XRP",
    "DOGEUSDT": "Dogecoin",
    "AVAXUSDT": "Avalanche",
    "LINKUSDT": "Chainlink",
    "MATICUSDT": "Polygon",
    "ARBUSDT": "Arbitrum",
    "OPUSDT": "Optimism",
    "APTUSDT": "Aptos",
    "ADAUSDT": "Cardano",
    "TONUSDT": "Toncoin",
}


def _http() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=PUBLIC_BASE,
        timeout=httpx.Timeout(10.0, connect=5.0),
        headers={"User-Agent": "vega-lab/0.1"},
    )


def display_symbol(symbol: str) -> str:
    """Convert 'BTCUSDT' -> 'BTC/USDT' for the UI."""
    if symbol.endswith("USDT"):
        return f"{symbol[:-4]}/USDT"
    if symbol.endswith("USDC"):
        return f"{symbol[:-4]}/USDC"
    if symbol.endswith("BUSD"):
        return f"{symbol[:-4]}/BUSD"
    return symbol


def base_quote(symbol: str) -> tuple[str, str]:
    if symbol.endswith("USDT"):
        return symbol[:-4], "USDT"
    if symbol.endswith("USDC"):
        return symbol[:-4], "USDC"
    return symbol, ""


async def fetch_ticker_24h(symbols: list[str]) -> list[dict[str, Any]]:
    """Returns Binance 24h ticker for the given symbols.

    On any failure, returns an empty list — callers must tolerate that.
    """
    if not symbols:
        return []
    # Binance accepts JSON-array string for `symbols` query param.
    import json

    params = {"symbols": json.dumps(symbols, separators=(",", ":"))}
    try:
        async with _http() as client:
            r = await client.get("/api/v3/ticker/24hr", params=params)
            r.raise_for_status()
            return r.json()
    except (httpx.HTTPError, ValueError):
        return []


async def fetch_klines(
    symbol: str, interval: str = "1h", limit: int = 168
) -> list[dict[str, Any]]:
    """Returns recent kline/candlestick data, normalized to {t, v} (close price)."""
    try:
        async with _http() as client:
            r = await client.get(
                "/api/v3/klines",
                params={"symbol": symbol, "interval": interval, "limit": limit},
            )
            r.raise_for_status()
            data: list[list[Any]] = r.json()
    except (httpx.HTTPError, ValueError):
        return []
    return [{"t": int(row[0]), "v": float(row[4])} for row in data]


async def fetch_orderbook(symbol: str, limit: int = 20) -> dict[str, list[list[float]]]:
    try:
        async with _http() as client:
            r = await client.get(
                "/api/v3/depth", params={"symbol": symbol, "limit": limit}
            )
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError):
        return {"bids": [], "asks": []}
    return {
        "bids": [[float(p), float(q)] for p, q in data.get("bids", [])],
        "asks": [[float(p), float(q)] for p, q in data.get("asks", [])],
    }


async def fetch_many_tickers_concurrently(symbols: list[str]) -> dict[str, dict[str, Any]]:
    """Fetch ticker24h in one batched call, then return as a dict keyed by symbol."""
    rows = await fetch_ticker_24h(symbols)
    return {row["symbol"]: row for row in rows}


# ---- Test fixture ----


async def _smoke() -> None:  # pragma: no cover
    rows = await fetch_ticker_24h(["BTCUSDT", "ETHUSDT"])
    print(rows)


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(_smoke())


def parse_ts(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
