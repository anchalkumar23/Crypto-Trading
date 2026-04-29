"""First-run seed: create admin user, sample portfolios, and strategy registry rows."""

from __future__ import annotations

import logging

from sqlalchemy import func, select

from .config import get_settings
from .db import AsyncSessionLocal
from .models import (
    AppSetting,
    EquityPoint,
    Portfolio,
    Strategy,
    User,
)
from .security import hash_password
from .services.strategies.registry import REGISTRY, list_strategies

log = logging.getLogger("seed")


async def seed_initial_data() -> None:
    settings = get_settings()
    async with AsyncSessionLocal() as db:
        # Strategies (always sync the registry rows on startup)
        for entry in list_strategies():
            res = await db.execute(select(Strategy).where(Strategy.name == entry["name"]))
            s = res.scalar_one_or_none()
            if s is None:
                s = Strategy(
                    name=entry["name"],
                    display_name=entry["display_name"],
                    description=entry["description"],
                    category=entry["category"],
                    risk_level=entry["risk_level"],
                    params_schema_json=entry.get("params_schema") or {},
                    code_ref=entry["code_ref"],
                )
                db.add(s)
                log.info("seeded strategy %s", entry["name"])

        # Admin user (only if no users exist)
        users_count = (await db.execute(select(func.count()).select_from(User))).scalar_one()
        if users_count == 0:
            admin = User(
                email=settings.initial_admin_email,
                password_hash=hash_password(settings.initial_admin_password),
                is_admin=True,
            )
            db.add(admin)
            await db.flush()

            # Sample portfolios
            for name, cash in [
                ("RSI Lab — BTC/ETH", 10_000.0),
                ("EMA Cross — Top10", 25_000.0),
                ("BB Breakout Sandbox", 5_000.0),
            ]:
                pf = Portfolio(
                    user_id=admin.id,
                    name=name,
                    kind="paper",
                    starting_cash=cash,
                    cash=cash,
                )
                db.add(pf)
                await db.flush()
                db.add(EquityPoint(portfolio_id=pf.id, equity=cash))

            # Default app settings
            db.add(
                AppSetting(
                    user_id=admin.id,
                    key="watchedPairs",
                    value_json=["BTC/USDT", "ETH/USDT", "SOL/USDT", "LINK/USDT"],
                )
            )
            db.add(
                AppSetting(user_id=admin.id, key="defaultTimeframe", value_json="1h")
            )
            db.add(
                AppSetting(user_id=admin.id, key="liveTradingEnabled", value_json=False)
            )
            log.info("seeded admin user %s + 3 sample portfolios", admin.email)

        await db.commit()


# Re-export for convenience
__all__ = ["seed_initial_data", "REGISTRY"]
