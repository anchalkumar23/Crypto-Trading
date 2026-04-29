"""The trading engine — fetch klines, run strategies, apply decisions.

Runs on APScheduler in-process. Each tick:
  1. Pull active strategy_runs from DB.
  2. For each run, for each symbol, fetch recent klines via Binance.
  3. Build the Strategy instance from registry, ask for a Decision.
  4. Apply Decision via wallet (paper) — risk caps enforced.
  5. Update last_tick_at, write equity_point.
  6. Broadcast a tick event over the WebSocket.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import AsyncSessionLocal
from ..models import EquityPoint, Portfolio, Position, Strategy as StrategyModel, StrategyRun
from .binance import fetch_klines, fetch_many_tickers_concurrently
from .strategies.base import Strategy
from .strategies.registry import get_strategy_class
from .wallet import execute_buy, execute_sell
from .ws_manager import manager

log = logging.getLogger("engine")


async def tick_once() -> dict[str, Any]:
    """Single engine tick. Safe to call from scheduler or manually."""
    summary: dict[str, Any] = {
        "ran_at": datetime.now(tz=timezone.utc).isoformat(),
        "runs_processed": 0,
        "decisions": [],
        "errors": [],
    }

    async with AsyncSessionLocal() as db:
        runs = await _active_runs(db)
        # Cache prices once per tick across all runs.
        all_symbols = sorted({s for r in runs for s in (r.symbols_json or [])})
        tickers = (
            await fetch_many_tickers_concurrently(all_symbols) if all_symbols else {}
        )

        for run in runs:
            try:
                processed = await _process_run(db, run, tickers, summary)
                summary["decisions"].extend(processed)
            except Exception as exc:  # pragma: no cover  - keep tick alive
                log.exception("run %s failed: %s", run.id, exc)
                summary["errors"].append({"run_id": run.id, "error": str(exc)})
                run.status = "errored"
                await db.commit()
            summary["runs_processed"] += 1

        # Equity points for each portfolio that has activity
        await _write_equity_points(db, tickers)

    # Broadcast tick event so the UI can show "engine ticking".
    await manager.broadcast(
        {
            "type": "tick",
            "data": {
                "ran_at": summary["ran_at"],
                "runs_processed": summary["runs_processed"],
                "errors": len(summary["errors"]),
            },
        }
    )
    return summary


async def _active_runs(db: AsyncSession) -> list[StrategyRun]:
    res = await db.execute(select(StrategyRun).where(StrategyRun.status == "running"))
    return list(res.scalars().all())


async def _process_run(
    db: AsyncSession,
    run: StrategyRun,
    tickers: dict[str, dict[str, Any]],
    summary: dict[str, Any],
) -> list[dict[str, Any]]:
    decisions_log: list[dict[str, Any]] = []
    strat_row = await db.get(StrategyModel, run.strategy_id)
    if strat_row is None:
        return decisions_log
    cls = get_strategy_class(strat_row.name)
    if cls is None:
        return decisions_log
    strat: Strategy = cls(run.params_json or {})

    portfolio = await db.get(Portfolio, run.portfolio_id)
    if portfolio is None or portfolio.archived_at is not None:
        return decisions_log

    for symbol in run.symbols_json or []:
        klines = await fetch_klines(symbol, run.timeframe, limit=300)
        if not klines:
            continue
        prices = [k["v"] for k in klines]
        last_price = prices[-1]

        pos_qty = await _position_qty(db, portfolio.id, symbol)
        decision = strat.decide(symbol, prices, pos_qty)

        log.info(
            "run=%s symbol=%s rsi-meanrev decision=%s reason=%s",
            run.id, symbol, decision.action, decision.reason,
        )

        if decision.action == "buy":
            cash_to_use = portfolio.cash * decision.qty_pct
            qty = (cash_to_use / last_price) if last_price > 0 else 0
            if qty > 0:
                try:
                    await execute_buy(
                        db, portfolio, symbol, qty, last_price,
                        strategy_run_id=run.id, note=decision.reason,
                    )
                    decisions_log.append(
                        {"run": run.id, "symbol": symbol, "side": "buy", "qty": qty}
                    )
                    await manager.broadcast(
                        {
                            "type": "trade",
                            "data": {
                                "portfolio_id": portfolio.id,
                                "symbol": symbol,
                                "side": "buy",
                                "qty": qty,
                                "price": last_price,
                            },
                        }
                    )
                except Exception as exc:  # noqa: BLE001
                    summary["errors"].append({"run_id": run.id, "symbol": symbol, "error": str(exc)})

        elif decision.action == "sell":
            qty = pos_qty * decision.qty_pct
            if qty > 0:
                try:
                    await execute_sell(
                        db, portfolio, symbol, qty, last_price,
                        strategy_run_id=run.id, note=decision.reason,
                    )
                    decisions_log.append(
                        {"run": run.id, "symbol": symbol, "side": "sell", "qty": qty}
                    )
                    await manager.broadcast(
                        {
                            "type": "trade",
                            "data": {
                                "portfolio_id": portfolio.id,
                                "symbol": symbol,
                                "side": "sell",
                                "qty": qty,
                                "price": last_price,
                            },
                        }
                    )
                except Exception as exc:  # noqa: BLE001
                    summary["errors"].append({"run_id": run.id, "symbol": symbol, "error": str(exc)})

    run.last_tick_at = datetime.now(tz=timezone.utc)
    await db.commit()
    return decisions_log


async def _position_qty(db: AsyncSession, portfolio_id: int, symbol: str) -> float:
    res = await db.execute(
        select(Position).where(
            Position.portfolio_id == portfolio_id, Position.symbol == symbol
        )
    )
    p = res.scalar_one_or_none()
    return p.qty if p else 0.0


async def _write_equity_points(
    db: AsyncSession, tickers: dict[str, dict[str, Any]]
) -> None:
    res = await db.execute(select(Portfolio).where(Portfolio.archived_at.is_(None)))
    for pf in res.scalars().all():
        positions_value = 0.0
        pos_res = await db.execute(
            select(Position).where(Position.portfolio_id == pf.id)
        )
        for pos in pos_res.scalars().all():
            tick = tickers.get(pos.symbol, {})
            price = float(tick.get("lastPrice", pos.avg_price)) if tick else pos.avg_price
            positions_value += pos.qty * price
        equity = pf.cash + positions_value
        db.add(EquityPoint(portfolio_id=pf.id, equity=equity))
    await db.commit()
