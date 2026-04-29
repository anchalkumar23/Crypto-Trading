"""Paper-wallet bookkeeping. Applies a Decision to the DB transactionally.

Real orders go through this same path but with kind='live' and an actual exchange
adapter — disabled in v1 per CLAUDE.md §9.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AuditLog, Portfolio, Position, Trade
from .risk import RiskViolation, check_can_buy


async def _get_position(
    db: AsyncSession, portfolio_id: int, symbol: str
) -> Position | None:
    res = await db.execute(
        select(Position).where(
            Position.portfolio_id == portfolio_id, Position.symbol == symbol
        )
    )
    return res.scalar_one_or_none()


async def execute_buy(
    db: AsyncSession,
    portfolio: Portfolio,
    symbol: str,
    qty: float,
    price: float,
    *,
    strategy_run_id: int | None = None,
    note: str | None = None,
) -> Trade:
    notional = qty * price
    fee = notional * portfolio.fee_rate
    slippage = price * portfolio.slippage_bps / 10_000.0
    fill_price = price + slippage

    await check_can_buy(db, portfolio, symbol, notional + fee)

    # Update or create position
    pos = await _get_position(db, portfolio.id, symbol)
    if pos is None:
        pos = Position(
            portfolio_id=portfolio.id,
            symbol=symbol,
            qty=qty,
            avg_price=fill_price,
            opened_at=datetime.now(tz=timezone.utc),
        )
        db.add(pos)
    else:
        new_qty = pos.qty + qty
        if new_qty > 0:
            pos.avg_price = (pos.qty * pos.avg_price + qty * fill_price) / new_qty
        pos.qty = new_qty

    portfolio.cash -= notional + fee

    trade = Trade(
        portfolio_id=portfolio.id,
        strategy_run_id=strategy_run_id,
        symbol=symbol,
        side="buy",
        qty=qty,
        price=fill_price,
        fee=fee,
        realized_pnl=0.0,
        note=note,
    )
    db.add(trade)
    db.add(
        AuditLog(
            user_id=portfolio.user_id,
            action="buy",
            target_type="portfolio",
            target_id=str(portfolio.id),
            payload_json={
                "symbol": symbol,
                "qty": qty,
                "price": fill_price,
                "fee": fee,
                "strategy_run_id": strategy_run_id,
                "note": note,
            },
        )
    )
    await db.commit()
    return trade


async def execute_sell(
    db: AsyncSession,
    portfolio: Portfolio,
    symbol: str,
    qty: float,
    price: float,
    *,
    strategy_run_id: int | None = None,
    note: str | None = None,
) -> Trade:
    pos = await _get_position(db, portfolio.id, symbol)
    if pos is None or pos.qty < qty - 1e-9:
        raise RiskViolation(
            f"No / insufficient position to sell: have {pos.qty if pos else 0}, want {qty}"
        )
    fee = qty * price * portfolio.fee_rate
    slippage = price * portfolio.slippage_bps / 10_000.0
    fill_price = price - slippage

    realized = (fill_price - pos.avg_price) * qty - fee
    pos.qty -= qty
    portfolio.cash += qty * fill_price - fee
    portfolio.realized_pnl += realized

    trade = Trade(
        portfolio_id=portfolio.id,
        strategy_run_id=strategy_run_id,
        symbol=symbol,
        side="sell",
        qty=qty,
        price=fill_price,
        fee=fee,
        realized_pnl=realized,
        note=note,
    )
    db.add(trade)
    db.add(
        AuditLog(
            user_id=portfolio.user_id,
            action="sell",
            target_type="portfolio",
            target_id=str(portfolio.id),
            payload_json={
                "symbol": symbol,
                "qty": qty,
                "price": fill_price,
                "fee": fee,
                "realized_pnl": realized,
                "strategy_run_id": strategy_run_id,
                "note": note,
            },
        )
    )
    await db.commit()
    return trade


def position_value(pos: Position, current_price: float) -> dict[str, Any]:
    market = pos.qty * current_price
    cost = pos.qty * pos.avg_price
    return {
        "market_value": market,
        "cost_basis": cost,
        "unrealized_pnl": market - cost,
        "unrealized_pct": (market - cost) / cost * 100 if cost else 0.0,
    }
