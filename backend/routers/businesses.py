"""
Businesses router — search for businesses using trigram similarity.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional

from models.schemas import (
    BusinessSearchResponse,
    BusinessOut,
    GooglePlaceUpsertRequest,
    CombinedSearchResponse,
    ReviewSearchResult,
)
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


@router.post(
    "/google-place",
    response_model=BusinessOut,
    summary="Upsert a business from Google Place data",
    description=(
        "Create or update a business record using data from a Google Places selection. "
        "Matches on google_place_id if present, otherwise name + address. "
        "Returns the existing or newly created business."
    ),
    status_code=status.HTTP_200_OK,
)
async def upsert_google_place(
    payload: GooglePlaceUpsertRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Upsert a business from Google Place data.
    Uses ON CONFLICT on google_place_id to either insert or update.
    """
    pool = get_pool()
    try:
        row = await pool.fetchrow(
            """
            INSERT INTO businesses (name, address, category, lat, lng, google_place_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (google_place_id)
            DO UPDATE SET
                name     = EXCLUDED.name,
                address  = EXCLUDED.address,
                category = EXCLUDED.category,
                lat      = EXCLUDED.lat,
                lng      = EXCLUDED.lng
            RETURNING id, name, category, address, lat, lng, google_place_id, created_at
            """,
            payload.name,
            payload.address,
            payload.category,
            payload.lat,
            payload.lng,
            payload.google_place_id,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upsert failed: {str(exc)}",
        )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Upsert returned no row",
        )

    return BusinessOut(**dict(row))


@router.get(
    "/combined-search",
    response_model=CombinedSearchResponse,
    summary="Search businesses AND reviews",
    description=(
        "Combined search that returns matching businesses (by name) "
        "and reviews (by body/pros/cons text) containing the search term. "
        "Supports optional category filtering."
    ),
)
async def combined_search(
    q: str = Query(..., min_length=2, description="Search query"),
    category: Optional[str] = Query(default=None, description="Filter by category"),
    limit: int = Query(default=10, ge=1, le=50, description="Max results per type"),
    current_user: dict = Depends(get_current_user),
):
    """
    Combined search across businesses and reviews.
    Reviews are filtered to only show public (2hop) visibility.
    """
    pool = get_pool()
    try:
        # Search businesses
        biz_query = """
            SELECT id, name, category, address, lat, lng, google_place_id, created_at
            FROM businesses
            WHERE name ILIKE $1
        """
        biz_params: list = [f"%{q}%"]

        if category:
            biz_query += " AND category ILIKE $2"
            biz_params.append(f"%{category}%")

        biz_query += f" ORDER BY name LIMIT ${len(biz_params) + 1}"
        biz_params.append(limit)

        biz_rows = await pool.fetch(biz_query, *biz_params)

        # Search reviews (body, pros, cons) with business info joined
        rev_query = """
            SELECT
                r.id, r.rating, r.body, r.pros, r.cons,
                r.visibility, r.ai_polished, r.created_at,
                b.id      AS b_id,
                b.name    AS b_name,
                b.category AS b_category,
                b.address AS b_address,
                b.lat     AS b_lat,
                b.lng     AS b_lng,
                b.google_place_id AS b_google_place_id,
                b.created_at AS b_created_at,
                u.name    AS reviewer_name
            FROM reviews r
            JOIN businesses b ON b.id = r.business_id
            JOIN users     u ON u.id = r.user_id
            WHERE r.visibility IN ('2hop', 'friends')
              AND (
                  r.body ILIKE $1
                  OR EXISTS (
                      SELECT 1 FROM unnest(r.pros) p WHERE p ILIKE $1
                  )
                  OR EXISTS (
                      SELECT 1 FROM unnest(r.cons) c WHERE c ILIKE $1
                  )
              )
        """
        rev_params: list = [f"%{q}%"]

        if category:
            rev_query += " AND b.category ILIKE $2"
            rev_params.append(f"%{category}%")

        rev_query += f" ORDER BY r.created_at DESC LIMIT ${len(rev_params) + 1}"
        rev_params.append(limit)

        rev_rows = await pool.fetch(rev_query, *rev_params)

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Combined search failed: {str(exc)}",
        )

    businesses = [BusinessOut(**dict(b)) for b in biz_rows]

    reviews: list[ReviewSearchResult] = []
    for r in rev_rows:
        rd = dict(r)
        business = BusinessOut(
            id=rd["b_id"],
            name=rd["b_name"],
            category=rd.get("b_category"),
            address=rd.get("b_address"),
            lat=rd.get("b_lat"),
            lng=rd.get("b_lng"),
            google_place_id=rd.get("b_google_place_id"),
            created_at=rd["b_created_at"],
        )
        reviews.append(
            ReviewSearchResult(
                id=rd["id"],
                rating=rd["rating"],
                body=rd.get("body"),
                pros=rd.get("pros"),
                cons=rd.get("cons"),
                visibility=rd["visibility"],
                ai_polished=rd["ai_polished"],
                created_at=rd["created_at"],
                business=business,
                reviewer_name=rd.get("reviewer_name"),
            )
        )

    return CombinedSearchResponse(businesses=businesses, reviews=reviews)
