from typing import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Decode access token and return the authenticated user."""
    # Import here to avoid circular imports (models import from db which is imported here)
    from app.models.user import User

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "access":
            raise credentials_exception
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception

    user = await db.get(User, int(sub))
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_role(*roles: str) -> Callable:
    """Returns a dependency that enforces the user has one of the given roles."""

    async def checker(current_user=Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return checker
