"""
Businesses router — search for businesses using trigram similarity.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status

from models.schemas import BusinessSearchResponse, BusinessOut
from services.database import get_pool
from .auth_deps import get_current_user

router = APIRouter(prefix="/businesses", tags=["businesses"])


@router.get(
    "/search",
    response_model=BusinessSearchResponse,
    summary="Search businesses by name",
    description=(
        "Search for businesses using PostgreSQL trigram similarity on the business name. "
        "Requires at least 2 characters."
    ),
)
async def search_businesses(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(default=10, ge=1, le=50, description="Max results"),
    current_user: dict = Depends(get_current_user),
):
    """
    Trigram-based business name search.
    Uses the pg_trgm GIN index on businesses.name for fast fuzzy matching.
    """
    pool = get_pool()
    try:
        rows = await pool.fetch(
            """
            SELECT id, name, category, address, lat, lng, google_place_id, created_at
            FROM businesses
            WHERE name ILIKE $1
            ORDER BY name
            LIMIT $2
            """,
            f"%{q}%",
            limit,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(exc)}",
        )

    businesses = [BusinessOut(**dict(b)) for b in rows]
    return BusinessSearchResponse(businesses=businesses)
