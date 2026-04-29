"""FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .models import User
from .security import decode_token

DBSession = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(
    db: DBSession,
    authorization: str | None = Header(default=None),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
    user_id = int(payload.get("sub", 0))
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def optional_user(
    db: DBSession,
    authorization: str | None = Header(default=None),
) -> User | None:
    """Returns user if authenticated, None otherwise. Used for public-but-personalized endpoints."""
    if not authorization:
        return None
    try:
        return await get_current_user(db=db, authorization=authorization)
    except HTTPException:
        return None


OptionalUser = Annotated[User | None, Depends(optional_user)]
