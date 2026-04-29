"""Server-enforced risk caps. Per CLAUDE.md §9, these MUST be applied before
any order is sent — never trust the client.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Portfolio, Position, Trade


class RiskViolation(Exception):
    """Raised when an order would violate a portfolio's risk caps."""


async def check_can_buy(
    db: AsyncSession,
    portfolio: Portfolio,
    symbol: str,
    notional: float,
) -> None:
    # 1. Cash sanity
    if notional > portfolio.cash + 1e-6:
        raise RiskViolation(
            f"Insufficient cash: need {notional:.2f}, have {portfolio.cash:.2f}"
        )

    # 2. Max position size
    cap = portfolio.cash + await _positions_value(db, portfolio.id)
    if notional > cap * (portfolio.max_position_pct / 100.0):
        raise RiskViolation(
            f"Position size {notional:.2f} exceeds max "
            f"{portfolio.max_position_pct:.1f}% of equity"
        )

    # 3. Max open positions
    open_count = await _open_positions_count(db, portfolio.id)
    has_position = await _has_position(db, portfolio.id, symbol)
    if not has_position and open_count >= portfolio.max_open_positions:
        raise RiskViolation(
            f"Max open positions reached ({portfolio.max_open_positions})"
        )

    # 4. Daily loss limit
    realized_today = await _today_realized_pnl(db, portfolio.id)
    if realized_today < -portfolio.daily_loss_limit_usd:
        raise RiskViolation(
            f"Daily loss limit hit ({realized_today:.2f} <= -{portfolio.daily_loss_limit_usd:.2f})"
        )


async def _positions_value(db: AsyncSession, portfolio_id: int) -> float:
    res = await db.execute(select(Position).where(Position.portfolio_id == portfolio_id))
    # We don't have current prices here; conservative estimate uses avg_price.
    return sum(p.qty * p.avg_price for p in res.scalars().all())


async def _open_positions_count(db: AsyncSession, portfolio_id: int) -> int:
    res = await db.execute(
        select(Position).where(Position.portfolio_id == portfolio_id, Position.qty > 0)
    )
    return len(res.scalars().all())


async def _has_position(db: AsyncSession, portfolio_id: int, symbol: str) -> bool:
    res = await db.execute(
        select(Position).where(
            Position.portfolio_id == portfolio_id,
            Position.symbol == symbol,
            Position.qty > 0,
        )
    )
    return res.scalar_one_or_none() is not None


async def _today_realized_pnl(db: AsyncSession, portfolio_id: int) -> float:
    since = datetime.now(tz=timezone.utc) - timedelta(hours=24)
    res = await db.execute(
        select(Trade).where(Trade.portfolio_id == portfolio_id, Trade.ts >= since)
    )
    return sum(t.realized_pnl for t in res.scalars().all())
