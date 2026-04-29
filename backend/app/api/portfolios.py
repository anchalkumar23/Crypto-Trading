"""Portfolio CRUD + detail."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from ..deps import CurrentUser, DBSession
from ..models import (
    AuditLog,
    EquityPoint,
    Portfolio,
    Position,
    StrategyRun,
    Trade,
)
from ..schemas import (
    EquityCurvePoint,
    PortfolioCreate,
    PortfolioOut,
    PortfolioUpdate,
    PositionOut,
)
from ..services.binance import display_symbol, fetch_many_tickers_concurrently

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


def _to_ms(dt: Any) -> int:
    if dt is None:
        return 0
    return int(dt.timestamp() * 1000) if hasattr(dt, "timestamp") else int(dt)


async def _serialize(db, pf: Portfolio) -> PortfolioOut:
    pos_res = await db.execute(select(Position).where(Position.portfolio_id == pf.id))
    positions = list(pos_res.scalars().all())
    raw_symbols = sorted({p.symbol for p in positions})
    tickers = (
        await fetch_many_tickers_concurrently(raw_symbols) if raw_symbols else {}
    )

    pos_out: list[PositionOut] = []
    positions_value = 0.0
    unrealized = 0.0
    for p in positions:
        tick = tickers.get(p.symbol, {})
        cur = float(tick.get("lastPrice", p.avg_price)) if tick else p.avg_price
        market_value = p.qty * cur
        positions_value += market_value
        upnl = (cur - p.avg_price) * p.qty
        unrealized += upnl
        pos_out.append(
            PositionOut(
                symbol=display_symbol(p.symbol),
                qty=p.qty,
                avgPrice=p.avg_price,
                currentPrice=cur,
                unrealizedPnl=upnl,
                unrealizedPct=(cur - p.avg_price) / p.avg_price * 100 if p.avg_price else 0.0,
                openedAt=_to_ms(p.opened_at),
            )
        )

    eq_res = await db.execute(
        select(EquityPoint)
        .where(EquityPoint.portfolio_id == pf.id)
        .order_by(EquityPoint.ts.asc())
    )
    eq_points = list(eq_res.scalars().all())
    equity_curve: list[EquityCurvePoint] = [
        EquityCurvePoint(t=_to_ms(e.ts), v=e.equity) for e in eq_points
    ]

    trades_res = await db.execute(select(Trade).where(Trade.portfolio_id == pf.id))
    trades = list(trades_res.scalars().all())
    n_trades = len(trades)
    winners = sum(1 for t in trades if t.realized_pnl > 0)
    win_rate = (winners / max(1, sum(1 for t in trades if t.side == "sell"))) * 100

    runs_res = await db.execute(
        select(StrategyRun).where(StrategyRun.portfolio_id == pf.id)
    )
    runs = list(runs_res.scalars().all())

    current_equity = pf.cash + positions_value
    total_return = ((current_equity - pf.starting_cash) / pf.starting_cash) * 100 if pf.starting_cash else 0.0

    return PortfolioOut(
        id=str(pf.id),
        name=pf.name,
        kind=pf.kind,  # type: ignore[arg-type]
        startingCash=pf.starting_cash,
        currentEquity=current_equity,
        cash=pf.cash,
        positionsValue=positions_value,
        realizedPnl=pf.realized_pnl,
        unrealizedPnl=unrealized,
        totalReturn=total_return,
        winRate=win_rate,
        trades=n_trades,
        maxPositionPct=pf.max_position_pct,
        maxOpenPositions=pf.max_open_positions,
        dailyLossLimit=pf.daily_loss_limit_usd,
        feeRate=pf.fee_rate,
        slippageBps=pf.slippage_bps,
        createdAt=_to_ms(pf.created_at),
        positions=pos_out,
        equityCurve=equity_curve,
        strategyRunIds=[str(r.id) for r in runs],
    )


@router.get("", response_model=dict)
async def list_portfolios(user: CurrentUser, db: DBSession) -> dict[str, Any]:
    res = await db.execute(
        select(Portfolio)
        .where(Portfolio.user_id == user.id, Portfolio.archived_at.is_(None))
        .order_by(Portfolio.created_at.desc())
    )
    pfs = list(res.scalars().all())
    out = [await _serialize(db, pf) for pf in pfs]
    return {"data": [p.model_dump() for p in out]}


@router.get("/{pid}", response_model=PortfolioOut)
async def get_portfolio(pid: int, user: CurrentUser, db: DBSession) -> PortfolioOut:
    pf = await db.get(Portfolio, pid)
    if pf is None or pf.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portfolio not found")
    return await _serialize(db, pf)


@router.post("", response_model=PortfolioOut, status_code=status.HTTP_201_CREATED)
async def create_portfolio(
    data: PortfolioCreate, user: CurrentUser, db: DBSession
) -> PortfolioOut:
    pf = Portfolio(
        user_id=user.id,
        name=data.name,
        kind="paper",
        starting_cash=data.starting_cash,
        cash=data.starting_cash,
        fee_rate=data.fee_rate,
        slippage_bps=data.slippage_bps,
        max_position_pct=data.max_position_pct,
        max_open_positions=data.max_open_positions,
        daily_loss_limit_usd=data.daily_loss_limit_usd,
    )
    db.add(pf)
    await db.flush()
    db.add(EquityPoint(portfolio_id=pf.id, equity=data.starting_cash))
    db.add(
        AuditLog(
            user_id=user.id,
            action="create_portfolio",
            target_type="portfolio",
            target_id=str(pf.id),
            payload_json={"name": data.name, "starting_cash": data.starting_cash},
        )
    )
    await db.commit()
    return await _serialize(db, pf)


@router.patch("/{pid}", response_model=PortfolioOut)
async def update_portfolio(
    pid: int, data: PortfolioUpdate, user: CurrentUser, db: DBSession
) -> PortfolioOut:
    pf = await db.get(Portfolio, pid)
    if pf is None or pf.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portfolio not found")
    payload: dict[str, Any] = {}
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is None:
            continue
        setattr(pf, field, value)
        payload[field] = value
    db.add(
        AuditLog(
            user_id=user.id,
            action="update_portfolio",
            target_type="portfolio",
            target_id=str(pid),
            payload_json=payload,
        )
    )
    await db.commit()
    return await _serialize(db, pf)


@router.post("/{pid}/reset")
async def reset_portfolio(pid: int, user: CurrentUser, db: DBSession) -> dict[str, Any]:
    pf = await db.get(Portfolio, pid)
    if pf is None or pf.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portfolio not found")
    pos_res = await db.execute(select(Position).where(Position.portfolio_id == pid))
    for p in pos_res.scalars().all():
        await db.delete(p)
    pf.cash = pf.starting_cash
    pf.realized_pnl = 0.0
    db.add(
        AuditLog(
            user_id=user.id,
            action="reset_portfolio",
            target_type="portfolio",
            target_id=str(pid),
            payload_json={},
        )
    )
    await db.commit()
    return {"ok": True}


@router.delete("/{pid}")
async def archive_portfolio(pid: int, user: CurrentUser, db: DBSession) -> dict[str, bool]:
    pf = await db.get(Portfolio, pid)
    if pf is None or pf.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portfolio not found")
    from datetime import datetime, timezone

    pf.archived_at = datetime.now(tz=timezone.utc)
    db.add(
        AuditLog(
            user_id=user.id,
            action="archive_portfolio",
            target_type="portfolio",
            target_id=str(pid),
            payload_json={},
        )
    )
    await db.commit()
    return {"ok": True}
