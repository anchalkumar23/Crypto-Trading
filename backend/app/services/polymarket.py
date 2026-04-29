"""Polymarket Gamma public client. Read-only — no auth required.

Per CLAUDE.md §10, Polymarket trading is intentionally read-only in v1/v2.
v3 may add it but only with a dedicated burner wallet behind a confirmation gate.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

GAMMA_BASE = "https://gamma-api.polymarket.com"


def _http() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=GAMMA_BASE,
        timeout=httpx.Timeout(10.0, connect=5.0),
        headers={"User-Agent": "vega-lab/0.1"},
    )


def _parse_dt(s: str | None) -> int:
    if not s:
        return 0
    try:
        return int(datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp() * 1000)
    except ValueError:
        return 0


def _categorize(tags: list[str] | None, slug: str) -> str:
    """Heuristic mapping of Polymarket tags -> our 6 categories."""
    text = " ".join((tags or [])) + " " + slug
    text = text.lower()
    if any(k in text for k in ("election", "president", "senate", "trump", "biden", "politic")):
        return "Politics"
    if any(k in text for k in ("btc", "bitcoin", "eth", "crypto", "solana", "sol")):
        return "Crypto"
    if any(k in text for k in ("nfl", "nba", "soccer", "fifa", "champion", "league")):
        return "Sports"
    if any(k in text for k in ("oscar", "grammy", "movie", "film", "music", "celeb")):
        return "Culture"
    if any(k in text for k in ("fed", "rate", "recession", "gdp", "inflation", "economy")):
        return "Economics"
    if any(k in text for k in ("ai", "openai", "spacex", "tesla", "tech")):
        return "Tech"
    return "Politics"


async def fetch_active_markets(limit: int = 30) -> list[dict[str, Any]]:
    """Pull active Polymarket markets, normalized for the UI.

    Returns [] on failure — the caller should fall back to seeded examples.
    """
    try:
        async with _http() as client:
            r = await client.get(
                "/markets",
                params={
                    "active": "true",
                    "closed": "false",
                    "archived": "false",
                    "order": "volume24hr",
                    "ascending": "false",
                    "limit": str(limit),
                },
            )
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError):
        return []

    out: list[dict[str, Any]] = []
    for m in data:
        try:
            outcome_prices = m.get("outcomePrices") or []
            outcomes = m.get("outcomes") or []
            if isinstance(outcome_prices, str):
                # Sometimes Gamma returns a JSON-encoded string here.
                import json

                outcome_prices = json.loads(outcome_prices)
            if isinstance(outcomes, str):
                import json

                outcomes = json.loads(outcomes)
            yes_price = float(outcome_prices[0]) if outcome_prices else 0.5
            no_price = (
                float(outcome_prices[1])
                if len(outcome_prices) > 1
                else max(0.0, 1.0 - yes_price)
            )
            slug = m.get("slug", "")
            out.append(
                {
                    "id": str(m.get("id", slug)),
                    "slug": slug,
                    "question": m.get("question", ""),
                    "category": _categorize(m.get("tags") or [], slug),
                    "yes": yes_price,
                    "no": no_price,
                    "volume24h": float(m.get("volume24hr") or 0),
                    "liquidity": float(m.get("liquidity") or 0),
                    "endDate": _parse_dt(m.get("endDate")),
                    "outcomes": [
                        {
                            "label": str(outcomes[0]) if outcomes else "Yes",
                            "price": yes_price,
                            "sharesTraded24h": float(m.get("volume24hr") or 0) * 0.6,
                        },
                        {
                            "label": str(outcomes[1]) if len(outcomes) > 1 else "No",
                            "price": no_price,
                            "sharesTraded24h": float(m.get("volume24hr") or 0) * 0.4,
                        },
                    ],
                }
            )
        except (KeyError, ValueError, TypeError):
            continue
    return out


async def fetch_market(slug: str) -> dict[str, Any] | None:
    try:
        async with _http() as client:
            r = await client.get("/markets", params={"slug": slug})
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError):
        return None
    if not data:
        return None
    markets = await fetch_active_markets(limit=1)  # reuse normalizer
    # Re-normalize the single result; the active fetch is keyed differently so we do it manually:
    m = data[0]
    try:
        import json as _json

        outcome_prices = m.get("outcomePrices") or []
        outcomes = m.get("outcomes") or []
        if isinstance(outcome_prices, str):
            outcome_prices = _json.loads(outcome_prices)
        if isinstance(outcomes, str):
            outcomes = _json.loads(outcomes)
        yes_price = float(outcome_prices[0]) if outcome_prices else 0.5
        no_price = float(outcome_prices[1]) if len(outcome_prices) > 1 else 1 - yes_price
        return {
            "id": str(m.get("id", slug)),
            "slug": slug,
            "question": m.get("question", ""),
            "category": _categorize(m.get("tags") or [], slug),
            "yes": yes_price,
            "no": no_price,
            "volume24h": float(m.get("volume24hr") or 0),
            "liquidity": float(m.get("liquidity") or 0),
            "endDate": _parse_dt(m.get("endDate")),
            "outcomes": [
                {
                    "label": str(outcomes[0]) if outcomes else "Yes",
                    "price": yes_price,
                    "sharesTraded24h": float(m.get("volume24hr") or 0) * 0.6,
                },
                {
                    "label": str(outcomes[1]) if len(outcomes) > 1 else "No",
                    "price": no_price,
                    "sharesTraded24h": float(m.get("volume24hr") or 0) * 0.4,
                },
            ],
        }
    except (KeyError, ValueError, TypeError):
        return None


def _now_ms() -> int:
    return int(datetime.now(tz=timezone.utc).timestamp() * 1000)
