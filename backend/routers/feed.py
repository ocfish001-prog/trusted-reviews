"""
Feed router — paginated, trust-scoped review feed.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from models.schemas import FeedResponse, ReviewWithContext, UserOut, BusinessOut
from services.trust_graph import get_trust_graph
from services.supabase_client import supabase
from .auth_deps import get_current_user

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get(
    "",
    response_model=FeedResponse,
    summary="Get trust-scoped review feed",
    description=(
        "Returns paginated reviews from the authenticated user's 2-hop trust network. "
        "Results are ordered newest-first. Optionally filter by business category."
    ),
)
async def get_feed(
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=20, ge=1, le=100, description="Reviews per page"),
    category: Optional[str] = Query(default=None, description="Filter by business category"),
    current_user: dict = Depends(get_current_user),
):
    """
    Feed algorithm:
    1. Get direct friends + friends-of-friends via trust_graph service
    2. Query reviews from all trusted users (respecting visibility)
    3. Enrich with reviewer/business info + trust distance
    4. Paginate and return
    """
    user_id: str = current_user["id"]

    # 1. Build trust graph
    direct_friends, fof = get_trust_graph(user_id)
    all_trusted = list(direct_friends | set(fof.keys()))

    if not all_trusted:
        return FeedResponse(reviews=[], total=0, page=page, has_more=False)

    offset = (page - 1) * limit

    # 2. Query reviews from trusted users
    # We include reviews where:
    # - author is a direct friend → can see 'friends' and '2hop' visibility
    # - author is a fof → can only see '2hop' visibility
    try:
        # Fetch reviews from direct friends (friends + 2hop visibility)
        query = (
            supabase.table("reviews")
            .select(
                "*, users!reviews_user_id_fkey(id, name, avatar_url, location, created_at), "
                "businesses!reviews_business_id_fkey(id, name, category, address, lat, lng, google_place_id, created_at)"
            )
            .in_("user_id", all_trusted)
            .neq("visibility", "private")
            .order("created_at", desc=True)
        )

        if category:
            # We need to filter on joined business category
            # Supabase doesn't support filtering on joined tables directly here,
            # so we do a two-step: get business IDs matching category first
            biz_result = (
                supabase.table("businesses")
                .select("id")
                .eq("category", category)
                .execute()
            )
            if not biz_result.data:
                return FeedResponse(reviews=[], total=0, page=page, has_more=False)
            biz_ids = [b["id"] for b in biz_result.data]
            query = query.in_("business_id", biz_ids)

        count_query = query
        result = query.range(offset, offset + limit - 1).execute()

        # Get total count (run without range)
        count_result = (
            supabase.table("reviews")
            .select("id", count="exact")
            .in_("user_id", all_trusted)
            .neq("visibility", "private")
            .execute()
        )
        total = count_result.count or 0

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch feed: {str(exc)}",
        )

    if not result.data:
        return FeedResponse(reviews=[], total=total, page=page, has_more=False)

    # 3. Enrich with trust metadata
    # Cache user lookups to avoid N+1 for via_friend
    user_cache: dict = {}
    reviews_out = []

    for row in result.data:
        author_id: str = row["user_id"]
        reviewer_data = row.get("users") or {}
        business_data = row.get("businesses") or {}

        # Determine trust distance
        if author_id in direct_friends:
            trust_distance = 1
            via_friend_data = None
        else:
            trust_distance = 2
            via_friend_id = fof.get(author_id)
            # fof visibility check: only show '2hop' reviews
            if row["visibility"] == "friends":
                continue  # skip 'friends-only' reviews from fof

            # Fetch via_friend info if not cached
            if via_friend_id and via_friend_id not in user_cache:
                vf_result = (
                    supabase.table("users")
                    .select("id, name, avatar_url, location, email, bio, invite_code, created_at")
                    .eq("id", via_friend_id)
                    .single()
                    .execute()
                )
                user_cache[via_friend_id] = vf_result.data
            via_friend_raw = user_cache.get(via_friend_id) if via_friend_id else None
            via_friend_data = UserOut(**via_friend_raw) if via_friend_raw else None

        try:
            review = ReviewWithContext(
                id=row["id"],
                rating=row["rating"],
                body=row.get("body"),
                pros=row.get("pros"),
                cons=row.get("cons"),
                visibility=row["visibility"],
                ai_polished=row.get("ai_polished", False),
                created_at=row["created_at"],
                trust_distance=trust_distance,
                via_friend=via_friend_data if trust_distance == 2 else None,
                reviewer=UserOut(**reviewer_data) if reviewer_data else None,
                business=BusinessOut(**business_data) if business_data else None,
            )
            reviews_out.append(review)
        except Exception:
            continue  # skip malformed rows

    return FeedResponse(
        reviews=reviews_out,
        total=total,
        page=page,
        has_more=(offset + limit) < total,
    )
