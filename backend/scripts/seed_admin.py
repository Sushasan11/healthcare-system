"""Admin user seed script.

Creates the initial admin account using FIRST_ADMIN_EMAIL and
FIRST_ADMIN_PASSWORD from the environment (or .env file).

Usage (from backend/ directory):
    python -m scripts.seed_admin

Prerequisites:
    - Database must be migrated: alembic upgrade head
    - DATABASE_URL env var must point to the target database
    - FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD env vars must be set
"""

import asyncio
import os
import sys

# Add backend/ to sys.path so app imports resolve when run as a script
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import AccountStatus, User, UserRole


async def seed_admin() -> None:
    email = settings.FIRST_ADMIN_EMAIL
    password = settings.FIRST_ADMIN_PASSWORD

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with async_session() as session:
        # Check if admin already exists
        result = await session.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()

        if existing is not None:
            print(f"Admin user already exists: {email}")
            return

        admin = User(
            email=email,
            hashed_password=hash_password(password),
            full_name="Admin",
            role=UserRole.admin,
            account_status=AccountStatus.active,
            is_active=True,
            email_verified=True,
        )
        session.add(admin)
        await session.commit()
        print(f"Admin user created: {email}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_admin())
