"""The kill switch — halts every running strategy_run, locks live trading."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import select

from ..deps import CurrentUser, DBSession
from ..models import AppSetting, AuditLog, Portfolio, StrategyRun

router = APIRouter(prefix="/kill", tags=["kill"])


@router.post("")
async def kill_all(user: CurrentUser, db: DBSession) -> dict[str, int]:
    """Stops all of this user's strategy_runs and disables live trading."""
    pf_res = await db.execute(
        select(Portfolio.id).where(Portfolio.user_id == user.id)
    )
    pf_ids = [pid for (pid,) in pf_res.all()]
    if not pf_ids:
        return {"stopped": 0}

    runs_res = await db.execute(
        select(StrategyRun).where(
            StrategyRun.portfolio_id.in_(pf_ids), StrategyRun.status == "running"
        )
    )
    n = 0
    for r in runs_res.scalars().all():
        r.status = "stopped"
        r.stopped_at = datetime.now(tz=timezone.utc)
        n += 1

    # Force live-trading off
    found = await db.execute(
        select(AppSetting).where(
            AppSetting.user_id == user.id, AppSetting.key == "liveTradingEnabled"
        )
    )
    row = found.scalar_one_or_none()
    if row is None:
        db.add(
            AppSetting(user_id=user.id, key="liveTradingEnabled", value_json=False)
        )
    else:
        row.value_json = False

    db.add(
        AuditLog(
            user_id=user.id,
            action="KILL_SWITCH",
            target_type="user",
            target_id=str(user.id),
            payload_json={"runs_stopped": n},
        )
    )
    await db.commit()
    return {"stopped": n}
