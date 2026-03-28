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
    ReviewWithContext,
    UserOut,
)
from services.database import get_pool
from services.trust_graph import get_trust_graph
from .auth_deps import get_current_user

router = APIRouter(prefix="/businesses", tags=["businesses"])


# ────────────────────────────────────────────────────────────────────────────
# IMPORTANT: Static routes (/search, /combined-search, /google-place) MUST be
# defined BEFORE the /{business_id} path-parameter route.  FastAPI evaluates
# routes in definition order — a /{business_id} catch-all placed first will
# swallow "search", "combined-search", etc. as path parameter values.
# ────────────────────────────────────────────────────────────────────────────

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


# ────────────────────────────────────────────────────────────────────────────
# Path-parameter routes MUST come AFTER all static routes above.
# ────────────────────────────────────────────────────────────────────────────

@router.get(
    "/{business_id}",
    response_model=BusinessOut,
    summary="Get a business by ID",
)
async def get_business(
    business_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Fetch a single business by its UUID."""
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT id, name, category, address, lat, lng, google_place_id, created_at FROM businesses WHERE id = $1",
        business_id,
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business {business_id} not found.",
        )
    return BusinessOut(**dict(row))


@router.get(
    "/{business_id}/reviews",
    summary="Get trust-scoped reviews for a business (plural route)",
    description=(
        "Returns reviews for a business filtered to the user's 2-hop trust network. "
        "Response shape: {reviews, network_stats: {friend_count, hop2_count, avg_rating}}."
    ),
)
async def get_business_reviews(
    business_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Trust-scoped business reviews with network_stats."""
    user_id: str = str(current_user["id"])
    pool = get_pool()

    biz_row = await pool.fetchrow(
        "SELECT id, name, category, address, lat, lng, google_place_id, created_at FROM businesses WHERE id = $1",
        business_id,
    )
    if not biz_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Business {business_id} not found.")
    business = BusinessOut(**dict(biz_row))

    direct_friends, fof = await get_trust_graph(user_id)
    all_trusted = list(direct_friends | set(fof.keys()) | {user_id})

    rows = await pool.fetch(
        """
        SELECT
            r.id, r.rating, r.body, r.pros, r.cons, r.visibility, r.ai_polished, r.created_at,
            r.user_id AS author_id,
            u.email AS reviewer_email, u.name AS reviewer_name, u.bio AS reviewer_bio,
            u.avatar_url AS reviewer_avatar_url, u.location AS reviewer_location,
            u.invite_code AS reviewer_invite_code, u.created_at AS reviewer_created_at
        FROM reviews r
        JOIN users u ON u.id = r.user_id
        WHERE r.business_id = $1
          AND r.user_id = ANY($2::uuid[])
          AND r.visibility != 'private'
        ORDER BY r.created_at DESC
        """,
        business_id,
        all_trusted,
    )

    # Batch via_friend profiles
    via_ids_needed: set = set()
    for row in rows:
        author_id = str(row["author_id"])
        if author_id != user_id and author_id not in direct_friends:
            via_id = fof.get(author_id)
            if via_id:
                via_ids_needed.add(via_id)

    via_profile_map: dict = {}
    if via_ids_needed:
        via_rows = await pool.fetch(
            "SELECT id, email, name, bio, avatar_url, location, invite_code, created_at FROM users WHERE id = ANY($1::uuid[])",
            list(via_ids_needed),
        )
        via_profile_map = {str(r["id"]): dict(r) for r in via_rows}

    reviews_out = []
    friend_count = 0
    hop2_count = 0

    for row in rows:
        author_id = str(row["author_id"])
        if author_id == user_id:
            trust_distance = 0
            via_friend_data = None
        elif author_id in direct_friends:
            trust_distance = 1
            via_friend_data = None
            friend_count += 1
        else:
            trust_distance = 2
            if row["visibility"] == "friends":
                continue
            via_id = fof.get(author_id)
            via_raw = via_profile_map.get(via_id) if via_id else None
            via_friend_data = UserOut(**via_raw) if via_raw else None
            hop2_count += 1

        try:
            reviews_out.append(
                ReviewWithContext(
                    id=row["id"],
                    rating=row["rating"],
                    body=row["body"],
                    pros=row["pros"],
                    cons=row["cons"],
                    visibility=row["visibility"],
                    ai_polished=row["ai_polished"],
                    created_at=row["created_at"],
                    trust_distance=trust_distance,
                    via_friend=via_friend_data,
                    reviewer=UserOut(
                        id=row["author_id"],
                        email=row["reviewer_email"],
                        name=row["reviewer_name"],
                        bio=row["reviewer_bio"],
                        avatar_url=row["reviewer_avatar_url"],
                        location=row["reviewer_location"],
                        invite_code=row["reviewer_invite_code"],
                        created_at=row["reviewer_created_at"],
                    ),
                    business=business,
                ).model_dump(mode="json")
            )
        except Exception:
            continue

    avg_rating = round(sum(r["rating"] for r in reviews_out) / len(reviews_out), 2) if reviews_out else 0.0

    return {
        "reviews": reviews_out,
        "network_stats": {
            "friend_count": friend_count,
            "hop2_count": hop2_count,
            "avg_rating": avg_rating,
        },
    }
