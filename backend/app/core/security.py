from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.config import settings

pwd_context = PasswordHash((Argon2Hasher(),))


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# Timing-safe comparison for nonexistent users — prevents user enumeration via timing
DUMMY_HASH = pwd_context.hash("dummy")


def create_access_token(sub: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode(
        {"sub": sub, "role": role, "exp": expire, "type": "access"},
        settings.SECRET_KEY,
        algorithm="HS256",
    )


def create_refresh_token(sub: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        hours=settings.REFRESH_TOKEN_EXPIRE_HOURS
    )
    return jwt.encode(
        {"sub": sub, "exp": expire, "type": "refresh"},
        settings.SECRET_KEY,
        algorithm="HS256",
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
