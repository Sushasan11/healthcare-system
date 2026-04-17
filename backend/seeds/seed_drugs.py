"""Seed the Drug table from nepal_dda_drugs.csv.

Usage: cd backend && python -m seeds.seed_drugs
"""
import asyncio
import csv
import os
import sys
from pathlib import Path

# Add backend to path for app imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from app.db import AsyncSessionLocal, engine
from app.models.prescription import Drug
from app.db import Base

CSV_PATH = Path(__file__).parent / "nepal_dda_drugs.csv"


async def seed_drugs():
    async with AsyncSessionLocal() as session:
        # Check if already seeded
        result = await session.execute(select(Drug).limit(1))
        if result.scalar_one_or_none():
            print("Drug table already seeded. Skipping.")
            return

        with open(CSV_PATH, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                drug = Drug(
                    name=row["name"].strip(),
                    generic_name=row.get("generic_name", "").strip() or None,
                    form=row.get("form", "").strip() or None,
                )
                session.add(drug)
                count += 1
        await session.commit()
        print(f"Seeded {count} drugs.")


if __name__ == "__main__":
    asyncio.run(seed_drugs())
