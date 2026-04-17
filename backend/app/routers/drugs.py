"""Drug autocomplete endpoint — public (medicine names are not PHI)."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.prescription import Drug
from app.schemas.prescription import DrugOut

router = APIRouter(prefix="/drugs", tags=["drugs"])


@router.get("", response_model=list[DrugOut])
async def search_drugs(
    q: str = Query("", min_length=0),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Search drugs by name or generic name (case-insensitive prefix/substring match)."""
    if not q.strip():
        return []
    term = f"%{q.strip()}%"
    result = await db.execute(
        select(Drug)
        .where(or_(Drug.name.ilike(term), Drug.generic_name.ilike(term)))
        .limit(limit)
    )
    return result.scalars().all()
