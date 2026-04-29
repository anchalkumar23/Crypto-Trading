"""Strategy registry + run management endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from ..deps import CurrentUser, DBSession
from ..models import (
    AuditLog,
    Portfolio,
    Strategy as StrategyModel,
    StrategyRun,
    Trade,
)
from ..schemas import StrategyRunCreate
from ..services.strategies.registry import REGISTRY

router = APIRouter(prefix="/strategies", tags=["strategies"])


def _to_ms(dt: Any) -> int:
    if dt is None:
        return 0
    return int(dt.timestamp() * 1000) if hasattr(dt, "timestamp") else int(dt)


@router.get("")
async def list_strategies(db: DBSession) -> dict[str, Any]:
    res = await db.execute(select(StrategyModel))
    rows = list(res.scalars().all())
    out: list[dict[str, Any]] = []
    for s in rows:
        # active runs count
        ar = await db.execute(
            select(func.count())
            .select_from(StrategyRun)
            .where(StrategyRun.strategy_id == s.id, StrategyRun.status == "running")
        )
        active = ar.scalar_one()

        cls = REGISTRY.get(s.name)
        params = []
        if cls and hasattr(cls, "descriptors"):
            params = [d.to_dict() for d in cls.descriptors()]  # type: ignore[attr-defined]

        out.append(
            {
                "id": s.id,
                "name": s.name,
                "displayName": s.display_name,
                "description": s.description,
                "category": s.category,
                "riskLevel": s.risk_level,
                "params": params,
                "activeRuns": active,
                # Synthetic stats — would be computed from real trade history in a fuller build.
                "ytdReturn": 0.0,
                "sharpe": 0.0,
            }
        )
    return {"data": out}


@router.get("/runs")
async def list_runs(user: CurrentUser, db: DBSession) -> dict[str, Any]:
    # Only runs against this user's portfolios.
    pf_ids_res = await db.execute(
        select(Portfolio.id).where(Portfolio.user_id == user.id)
    )
    pf_ids = [pid for (pid,) in pf_ids_res.all()]
    if not pf_ids:
        return {"data": []}

    runs_res = await db.execute(
        select(StrategyRun, StrategyModel, Portfolio)
        .join(StrategyModel, StrategyRun.strategy_id == StrategyModel.id)
        .join(Portfolio, StrategyRun.portfolio_id == Portfolio.id)
        .where(StrategyRun.portfolio_id.in_(pf_ids))
        .order_by(StrategyRun.started_at.desc())
    )
    out: list[dict[str, Any]] = []
    for run, strat, pf in runs_res.all():
        trades_res = await db.execute(
            select(Trade).where(Trade.strategy_run_id == run.id)
        )
        trades = list(trades_res.scalars().all())
        pnl = sum(t.realized_pnl for t in trades)
        out.append(
            {
                "id": run.id,
                "strategyId": run.strategy_id,
                "strategyName": strat.display_name,
                "portfolioId": run.portfolio_id,
                "portfolioName": pf.name,
                "status": run.status,
                "startedAt": _to_ms(run.started_at),
                "lastTickAt": _to_ms(run.last_tick_at) or _to_ms(run.started_at),
                "pnl": pnl,
                "trades": len(trades),
            }
        )
    return {"data": out}


@router.post("/runs", status_code=status.HTTP_201_CREATED)
async def create_run(
    data: StrategyRunCreate, user: CurrentUser, db: DBSession
) -> dict[str, Any]:
    pf = await db.get(Portfolio, data.portfolio_id)
    if pf is None or pf.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portfolio not found")
    strat = await db.get(StrategyModel, data.strategy_id)
    if strat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Strategy not found")

    cls = REGISTRY.get(strat.name)
    if cls is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Strategy class missing")
    # Validate params against the strategy's pydantic schema.
    try:
        cls.Params(**data.params)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Invalid params: {exc}"
        ) from exc

    run = StrategyRun(
        portfolio_id=data.portfolio_id,
        strategy_id=data.strategy_id,
        params_json=data.params,
        symbols_json=[s.replace("/", "") for s in data.symbols],
        timeframe=data.timeframe,
        status="running",
    )
    db.add(run)
    await db.flush()
    db.add(
        AuditLog(
            user_id=user.id,
            action="start_run",
            target_type="strategy_run",
            target_id=str(run.id),
            payload_json={"strategy": strat.name, "symbols": data.symbols},
        )
    )
    await db.commit()
    return {"id": run.id, "status": run.status}


@router.post("/runs/{rid}/pause")
async def pause_run(rid: int, user: CurrentUser, db: DBSession) -> dict[str, Any]:
    return await _set_status(rid, user, db, "paused")


@router.post("/runs/{rid}/resume")
async def resume_run(rid: int, user: CurrentUser, db: DBSession) -> dict[str, Any]:
    return await _set_status(rid, user, db, "running")


@router.post("/runs/{rid}/stop")
async def stop_run(rid: int, user: CurrentUser, db: DBSession) -> dict[str, Any]:
    return await _set_status(rid, user, db, "stopped")


async def _set_status(
    rid: int, user: CurrentUser, db: DBSession, status_value: str
) -> dict[str, Any]:
    run = await db.get(StrategyRun, rid)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    pf = await db.get(Portfolio, run.portfolio_id)
    if pf is None or pf.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    run.status = status_value
    if status_value == "stopped":
        run.stopped_at = datetime.now(tz=timezone.utc)
    db.add(
        AuditLog(
            user_id=user.id,
            action=f"{status_value}_run",
            target_type="strategy_run",
            target_id=str(rid),
            payload_json={},
        )
    )
    await db.commit()
    return {"id": rid, "status": status_value}
