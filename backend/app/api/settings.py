"""User settings + API key management."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select

from ..deps import CurrentUser, DBSession
from ..models import ApiKey, AppSetting, AuditLog
from ..schemas import ApiKeyIn, ApiKeyOut, SettingsOut, SettingsUpdate
from ..security import encrypt_secret, verify_password

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULT_PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "LINK/USDT"]
DEFAULT_TF = "1h"


def _to_ms(dt: Any) -> int:
    if dt is None:
        return 0
    return int(dt.timestamp() * 1000) if hasattr(dt, "timestamp") else int(dt)


async def _get(db, user_id: int, key: str, default: Any = None) -> Any:
    res = await db.execute(
        select(AppSetting).where(AppSetting.user_id == user_id, AppSetting.key == key)
    )
    row = res.scalar_one_or_none()
    return row.value_json if row is not None else default


async def _set(db, user_id: int, key: str, value: Any) -> None:
    res = await db.execute(
        select(AppSetting).where(AppSetting.user_id == user_id, AppSetting.key == key)
    )
    row = res.scalar_one_or_none()
    if row is None:
        db.add(AppSetting(user_id=user_id, key=key, value_json=value))
    else:
        row.value_json = value


@router.get("", response_model=SettingsOut)
async def get_settings(user: CurrentUser, db: DBSession) -> SettingsOut:
    watched = await _get(db, user.id, "watchedPairs", DEFAULT_PAIRS)
    tf = await _get(db, user.id, "defaultTimeframe", DEFAULT_TF)
    live = await _get(db, user.id, "liveTradingEnabled", False)
    email = await _get(db, user.id, "notificationsEmail", "")
    tg = await _get(db, user.id, "notificationsTelegram", "")

    keys_res = await db.execute(select(ApiKey).where(ApiKey.user_id == user.id))
    keys = [
        ApiKeyOut(
            id=k.id,
            exchange=k.exchange,
            scope=k.scope,
            last_four=k.last_four,
            created_at=_to_ms(k.created_at),
        )
        for k in keys_res.scalars().all()
    ]
    return SettingsOut(
        watchedPairs=watched,
        defaultTimeframe=tf,
        liveTradingEnabled=bool(live),
        notificationsEmail=email,
        notificationsTelegram=tg,
        apiKeys=keys,
    )


@router.patch("", response_model=SettingsOut)
async def update_settings(
    data: SettingsUpdate, user: CurrentUser, db: DBSession
) -> SettingsOut:
    payload = data.model_dump(exclude_unset=True)

    # Live-trading flag flip requires password re-confirmation per CLAUDE.md §9.
    if "live_trading_enabled" in payload and payload["live_trading_enabled"] is True:
        pw = payload.get("password_confirmation") or ""
        if not verify_password(pw, user.password_hash):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Password confirmation required"
            )

    for key, value in payload.items():
        if key == "password_confirmation":
            continue
        if value is None:
            continue
        # Map snake_case to the camelCase keys we store in app_settings.
        store_key = {
            "watched_pairs": "watchedPairs",
            "default_timeframe": "defaultTimeframe",
            "live_trading_enabled": "liveTradingEnabled",
            "notifications_email": "notificationsEmail",
            "notifications_telegram": "notificationsTelegram",
        }.get(key, key)
        await _set(db, user.id, store_key, value)

    db.add(
        AuditLog(
            user_id=user.id,
            action="update_settings",
            target_type="settings",
            target_id=str(user.id),
            payload_json={k: v for k, v in payload.items() if k != "password_confirmation"},
        )
    )
    await db.commit()
    return await get_settings(user, db)


@router.post("/api-keys", response_model=ApiKeyOut, status_code=status.HTTP_201_CREATED)
async def add_api_key(data: ApiKeyIn, user: CurrentUser, db: DBSession) -> ApiKeyOut:
    """Encrypts and stores an exchange API key. Refuses keys with withdraw scope.

    NOTE: A production implementation should call the exchange to confirm the key
    really has only read/trade permissions and no withdraw. Here we trust the user-
    declared scope but log it.
    """
    if data.scope not in {"read", "trade"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid scope")
    last_four = data.api_key[-4:].lower()
    key = ApiKey(
        user_id=user.id,
        exchange=data.exchange,
        encrypted_key=encrypt_secret(data.api_key),
        encrypted_secret=encrypt_secret(data.api_secret),
        last_four=last_four,
        scope=data.scope,
    )
    db.add(key)
    await db.flush()
    db.add(
        AuditLog(
            user_id=user.id,
            action="add_api_key",
            target_type="api_key",
            target_id=str(key.id),
            payload_json={"exchange": data.exchange, "scope": data.scope, "last_four": last_four},
        )
    )
    await db.commit()
    return ApiKeyOut(
        id=key.id,
        exchange=key.exchange,
        scope=key.scope,
        last_four=key.last_four,
        created_at=_to_ms(key.created_at),
    )


@router.delete("/api-keys/{kid}")
async def remove_api_key(kid: int, user: CurrentUser, db: DBSession) -> dict[str, bool]:
    res = await db.execute(
        select(ApiKey).where(ApiKey.id == kid, ApiKey.user_id == user.id)
    )
    key = res.scalar_one_or_none()
    if key is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "API key not found")
    await db.execute(delete(ApiKey).where(ApiKey.id == kid))
    db.add(
        AuditLog(
            user_id=user.id,
            action="remove_api_key",
            target_type="api_key",
            target_id=str(kid),
            payload_json={},
        )
    )
    await db.commit()
    return {"ok": True}
