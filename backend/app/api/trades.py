"""Trade log endpoint."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query
from sqlalchemy import select

from ..deps import CurrentUser, DBSession
from ..models import Portfolio, Strategy, StrategyRun, Trade
from ..services.binance import display_symbol

router = APIRouter(prefix="/trades", tags=["trades"])


def _to_ms(dt: Any) -> int:
    if dt is None:
        return 0
    return int(dt.timestamp() * 1000) if hasattr(dt, "timestamp") else int(dt)


@router.get("")
async def list_trades(
    user: CurrentUser,
    db: DBSession,
    portfolio_id: int | None = Query(default=None),
    symbol: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
) -> dict[str, Any]:
    pf_res = await db.execute(
        select(Portfolio.id).where(Portfolio.user_id == user.id)
    )
    pf_ids = [pid for (pid,) in pf_res.all()]
    if not pf_ids:
        return {"data": []}

    stmt = (
        select(Trade, StrategyRun, Strategy)
        .join(StrategyRun, Trade.strategy_run_id == StrategyRun.id, isouter=True)
        .join(Strategy, StrategyRun.strategy_id == Strategy.id, isouter=True)
        .where(Trade.portfolio_id.in_(pf_ids))
        .order_by(Trade.ts.desc())
        .limit(limit)
    )
    if portfolio_id is not None:
        stmt = stmt.where(Trade.portfolio_id == portfolio_id)
    if symbol is not None:
        stmt = stmt.where(Trade.symbol == symbol.replace("/", "").upper())

    res = await db.execute(stmt)
    rows = res.all()
    out: list[dict[str, Any]] = []
    for trade, _run, strat in rows:
        out.append(
            {
                "id": trade.id,
                "portfolioId": trade.portfolio_id,
                "strategyName": strat.display_name if strat else "—",
                "symbol": display_symbol(trade.symbol),
                "side": trade.side,
                "qty": trade.qty,
                "price": trade.price,
                "fee": trade.fee,
                "realizedPnl": trade.realized_pnl,
                "ts": _to_ms(trade.ts),
                "note": trade.note,
            }
        )
    return {"data": out}
