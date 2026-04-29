"""Auth endpoints — login, /me, first-run setup."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from ..deps import CurrentUser, DBSession
from ..models import AuditLog, User
from ..schemas import LoginIn, SetupIn, TokenOut, UserOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
async def login(data: LoginIn, db: DBSession) -> TokenOut:
    res = await db.execute(select(User).where(User.email == data.email))
    user = res.scalar_one_or_none()
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    user.last_login = datetime.now(tz=timezone.utc)
    db.add(AuditLog(user_id=user.id, action="login", target_type="user", target_id=str(user.id)))
    await db.commit()
    token = create_access_token(user.id)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/setup", response_model=TokenOut)
async def setup(data: SetupIn, db: DBSession) -> TokenOut:
    """First-run admin creation. Disabled once any user exists."""
    res = await db.execute(select(func.count()).select_from(User))
    count = res.scalar_one()
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Setup already completed"
        )
    user = User(email=data.email, password_hash=hash_password(data.password), is_admin=True)
    db.add(user)
    await db.flush()
    db.add(AuditLog(user_id=user.id, action="setup", target_type="user", target_id=str(user.id)))
    await db.commit()
    token = create_access_token(user.id)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)
