"""Backtest endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from sqlalchemy import select

from ..deps import CurrentUser, DBSession
from ..models import AuditLog, Backtest, Strategy as StrategyModel
from ..schemas import BacktestCreate
from ..services.binance import fetch_klines
from ..services.strategies.registry import REGISTRY
from ..services.wallet import position_value  # noqa: F401  (unused but keeps import clean)

router = APIRouter(prefix="/backtests", tags=["backtests"])


def _to_ms(dt: Any) -> int:
    if dt is None:
        return 0
    return int(dt.timestamp() * 1000) if hasattr(dt, "timestamp") else int(dt)


@router.get("")
async def list_backtests(user: CurrentUser, db: DBSession) -> dict[str, Any]:
    res = await db.execute(
        select(Backtest)
        .where(Backtest.user_id == user.id)
        .order_by(Backtest.created_at.desc())
    )
    rows = list(res.scalars().all())
    return {
        "data": [
            {
                "id": b.id,
                "strategyName": b.strategy_name,
                "symbols": b.symbols_json,
                "timeframe": b.timeframe,
                "startDate": _to_ms(b.start_date),
                "endDate": _to_ms(b.end_date),
                "status": b.status,
                "totalReturn": b.total_return,
                "sharpe": b.sharpe,
                "maxDrawdown": b.max_drawdown,
                "trades": b.trades_count,
                "winRate": b.win_rate,
                "equityCurve": b.equity_curve_json,
                "createdAt": _to_ms(b.created_at),
            }
            for b in rows
        ]
    }


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_backtest(
    data: BacktestCreate,
    user: CurrentUser,
    db: DBSession,
    bg: BackgroundTasks,
) -> dict[str, Any]:
    strat = await db.get(StrategyModel, data.strategy_id)
    if strat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Strategy not found")
    cls = REGISTRY.get(strat.name)
    if cls is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Strategy class missing")
    try:
        cls.Params(**data.params)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Invalid params: {exc}"
        ) from exc

    bt = Backtest(
        user_id=user.id,
        strategy_id=data.strategy_id,
        strategy_name=strat.display_name,
        params_json=data.params,
        symbols_json=[s.replace("/", "") for s in data.symbols],
        timeframe=data.timeframe,
        start_date=data.start_date,
        end_date=data.end_date,
        status="queued",
    )
    db.add(bt)
    await db.flush()
    db.add(
        AuditLog(
            user_id=user.id,
            action="enqueue_backtest",
            target_type="backtest",
            target_id=str(bt.id),
            payload_json={"strategy": strat.name, "symbols": data.symbols},
        )
    )
    await db.commit()

    bg.add_task(_run_backtest_in_bg, bt.id)
    return {"id": bt.id, "status": "queued"}


async def _run_backtest_in_bg(backtest_id: int) -> None:
    """Tiny synchronous-style backtest. Single-symbol best-effort."""
    from ..db import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        bt = await db.get(Backtest, backtest_id)
        if bt is None:
            return
        bt.status = "running"
        await db.commit()

        try:
            strat_row = await db.get(StrategyModel, bt.strategy_id)
            if strat_row is None or strat_row.name not in REGISTRY:
                raise RuntimeError("strategy missing")
            cls = REGISTRY[strat_row.name]
            strat = cls(bt.params_json or {})

            symbol = bt.symbols_json[0] if bt.symbols_json else "BTCUSDT"
            klines = await fetch_klines(symbol, bt.timeframe, limit=500)
            closes = [k["v"] for k in klines]
            timestamps = [k["t"] for k in klines]
            if len(closes) < 50:
                raise RuntimeError("not enough history")

            cash = 10_000.0
            qty = 0.0
            avg = 0.0
            equity_curve: list[dict[str, Any]] = []
            wins = 0
            losses = 0
            n_trades = 0
            peak = cash
            max_dd = 0.0

            for i in range(50, len(closes)):
                window = closes[: i + 1]
                price = closes[i]
                pos_qty = qty
                decision = strat.decide(symbol, window, pos_qty)
                if decision.action == "buy" and qty == 0:
                    use = cash * decision.qty_pct
                    q = use / price
                    qty += q
                    avg = price
                    cash -= q * price
                    n_trades += 1
                elif decision.action == "sell" and qty > 0:
                    cash += qty * price
                    realized = (price - avg) * qty
                    if realized > 0:
                        wins += 1
                    else:
                        losses += 1
                    qty = 0
                    avg = 0
                    n_trades += 1
                eq = cash + qty * price
                if eq > peak:
                    peak = eq
                if peak > 0:
                    dd = (eq - peak) / peak * 100
                    if dd < max_dd:
                        max_dd = dd
                equity_curve.append({"t": timestamps[i], "v": eq})

            final_equity = cash + qty * (closes[-1] if closes else avg)
            total_return = (final_equity - 10_000.0) / 10_000.0 * 100
            win_rate = wins / max(1, wins + losses) * 100

            # Sharpe-ish: mean / std of period returns
            returns: list[float] = []
            for j in range(1, len(equity_curve)):
                prev = equity_curve[j - 1]["v"]
                cur = equity_curve[j]["v"]
                returns.append((cur - prev) / prev if prev else 0)
            if returns:
                m = sum(returns) / len(returns)
                var = sum((r - m) ** 2 for r in returns) / len(returns)
                std = var**0.5
                sharpe = (m / std) * (252**0.5) if std > 0 else 0.0
            else:
                sharpe = 0.0

            bt.equity_curve_json = equity_curve
            bt.total_return = total_return
            bt.sharpe = sharpe
            bt.max_drawdown = max_dd
            bt.trades_count = n_trades
            bt.win_rate = win_rate
            bt.summary_json = {"final_equity": final_equity, "wins": wins, "losses": losses}
            bt.status = "complete"
        except Exception as exc:  # noqa: BLE001
            bt.status = "failed"
            bt.summary_json = {"error": str(exc)}

        await db.commit()


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _bound_default(end: datetime, days: int) -> datetime:
    return end - timedelta(days=days)
