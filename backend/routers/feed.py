"""
Feed router — paginated, trust-scoped review feed.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse

from models.schemas import FeedResponse, ReviewWithContext, UserOut, BusinessOut
from services.trust_graph import get_trust_graph
from services.database import get_pool
from .auth_deps import get_current_user

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get(
    "",
    summary="Get trust-scoped review feed",
    description=(
        "Returns paginated reviews from the authenticated user's 2-hop trust network. "
        "Results are ordered newest-first. Optionally filter by business category. "
        "Supports both cursor-based (cursor=<opaque string>) and page-based (page=N) pagination. "
        "Response includes next_cursor for cursor-based clients and has_more for page-based clients."
    ),
)
async def get_feed(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(default=20, ge=1, le=100, description="Reviews per page"),
    category: Optional[str] = Query(default=None, description="Filter by business category"),
    cursor: Optional[str] = Query(default=None, description="Cursor for pagination (opaque, page-encoded)"),
    current_user: dict = Depends(get_current_user),
):
    """
    Feed algorithm:
    1. Get direct friends + friends-of-friends via trust_graph service
    2. Query reviews from all trusted users (respecting visibility)
    3. Enrich with reviewer/business info + trust distance via SQL JOIN
    4. Paginate and return
    """
    user_id: str = str(current_user["id"])

    # 1. Build trust graph
    direct_friends, fof = await get_trust_graph(user_id)
    all_trusted = list(direct_friends | set(fof.keys()))

    if not all_trusted:
        return {"reviews": [], "total": 0, "page": page, "has_more": False, "next_cursor": None}

    # Resolve page from cursor if provided (cursor is just base64-encoded page number)
    if cursor:
        try:
            import base64
            page = int(base64.b64decode(cursor).decode())
        except Exception:
            page = 1

    offset = (page - 1) * limit
    pool = get_pool()

    try:
        # 2. Single JOIN query — no N+1
        # For fof authors, only '2hop' visibility is visible (enforced in Python below).
        # We fetch all non-private from trusted users and apply fof visibility filter after.
        if category:
            rows = await pool.fetch(
                """
                SELECT
                    r.id,
                    r.rating,
                    r.body,
                    r.pros,
                    r.cons,
                    r.visibility,
                    r.ai_polished,
                    r.created_at,
                    r.user_id       AS author_id,
                    u.email         AS reviewer_email,
                    u.name          AS reviewer_name,
                    u.bio           AS reviewer_bio,
                    u.avatar_url    AS reviewer_avatar_url,
                    u.location      AS reviewer_location,
                    u.invite_code   AS reviewer_invite_code,
                    u.created_at    AS reviewer_created_at,
                    b.id            AS business_id,
                    b.name          AS business_name,
                    b.category      AS business_category,
                    b.address       AS business_address,
                    b.lat           AS business_lat,
                    b.lng           AS business_lng,
                    b.google_place_id AS business_google_place_id,
                    b.created_at    AS business_created_at
                FROM reviews r
                JOIN users u ON u.id = r.user_id
                JOIN businesses b ON b.id = r.business_id
                WHERE r.user_id = ANY($1::uuid[])
                  AND r.visibility != 'private'
                  AND b.category = $2
                ORDER BY r.created_at DESC
                """,
                all_trusted,
                category,
            )
        else:
            rows = await pool.fetch(
                """
                SELECT
                    r.id,
                    r.rating,
                    r.body,
                    r.pros,
                    r.cons,
                    r.visibility,
                    r.ai_polished,
                    r.created_at,
                    r.user_id       AS author_id,
                    u.email         AS reviewer_email,
                    u.name          AS reviewer_name,
                    u.bio           AS reviewer_bio,
                    u.avatar_url    AS reviewer_avatar_url,
                    u.location      AS reviewer_location,
                    u.invite_code   AS reviewer_invite_code,
                    u.created_at    AS reviewer_created_at,
                    b.id            AS business_id,
                    b.name          AS business_name,
                    b.category      AS business_category,
                    b.address       AS business_address,
                    b.lat           AS business_lat,
                    b.lng           AS business_lng,
                    b.google_place_id AS business_google_place_id,
                    b.created_at    AS business_created_at
                FROM reviews r
                JOIN users u ON u.id = r.user_id
                JOIN businesses b ON b.id = r.business_id
                WHERE r.user_id = ANY($1::uuid[])
                  AND r.visibility != 'private'
                ORDER BY r.created_at DESC
                """,
                all_trusted,
            )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch feed: {str(exc)}",
        )

    # 3. Enrich with trust metadata; collect via_friend IDs to batch-fetch
    via_ids_needed: set = set()
    pre_enriched = []

    for row in rows:
        author_id = str(row["author_id"])
        if author_id in direct_friends:
            trust_distance = 1
            via_friend_id = None
        else:
            # fof — only '2hop' visibility allowed
            if row["visibility"] == "friends":
                continue
            trust_distance = 2
            via_friend_id = fof.get(author_id)
            if via_friend_id:
                via_ids_needed.add(via_friend_id)
        pre_enriched.append((row, trust_distance, via_friend_id))

    # Batch-fetch all via_friend profiles in one query
    via_profile_map: dict = {}
    if via_ids_needed:
        via_rows = await pool.fetch(
            """
            SELECT id, email, name, bio, avatar_url, location, invite_code, created_at
            FROM users WHERE id = ANY($1::uuid[])
            """,
            list(via_ids_needed),
        )
        via_profile_map = {str(r["id"]): dict(r) for r in via_rows}

    # Total before pagination (count of pre_enriched)
    total = len(pre_enriched)

    # Apply pagination
    paginated = pre_enriched[offset: offset + limit]

    reviews_out = []
    for row, trust_distance, via_friend_id in paginated:
        via_friend_data = None
        if via_friend_id and via_friend_id in via_profile_map:
            via_friend_data = UserOut(**via_profile_map[via_friend_id])

        try:
            review = ReviewWithContext(
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
                business=BusinessOut(
                    id=row["business_id"],
                    name=row["business_name"],
                    category=row["business_category"],
                    address=row["business_address"],
                    lat=row["business_lat"],
                    lng=row["business_lng"],
                    google_place_id=row["business_google_place_id"],
                    created_at=row["business_created_at"],
                ),
            )
            reviews_out.append(review)
        except Exception:
            continue

    has_more = (offset + limit) < total

    # Build next_cursor for cursor-based pagination clients
    next_cursor = None
    if has_more:
        import base64
        next_cursor = base64.b64encode(str(page + 1).encode()).decode()

    return {
        "reviews": [r.model_dump(mode="json") for r in reviews_out],
        "total": total,
        "page": page,
        "has_more": has_more,
        "next_cursor": next_cursor,
    }
