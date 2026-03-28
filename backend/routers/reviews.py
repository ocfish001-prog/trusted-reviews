"""
Reviews router — create, polish, and fetch trust-scoped reviews.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from models.schemas import (
    CreateReviewRequest,
    CreateReviewResponse,
    ReviewOut,
    PolishRequest,
    PolishResponse,
    BusinessReviewsResponse,
    ReviewWithContext,
    UserOut,
    BusinessOut,
)
from services.database import get_pool
from services.trust_graph import get_trust_graph
from services import ai_polish
from .auth_deps import get_current_user

router = APIRouter(tags=["reviews"])


@router.post(
    "/reviews",
    response_model=CreateReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a review",
    description=(
        "Post a review for a business. Supply business_id for existing businesses, "
        "or supply business_name + optional category/address to create a new business on the fly."
    ),
)
async def create_review(
    body: CreateReviewRequest,
    current_user: dict = Depends(get_current_user),
):
    """Create a review, optionally creating the business if it doesn't exist."""
    user_id: str = str(current_user["id"])
    business_id: str | None = str(body.business_id) if body.business_id else None
    pool = get_pool()

    # Resolve or create business
    if not business_id:
        if not body.business_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either business_id or business_name must be provided.",
            )
        biz_row = await pool.fetchrow(
            """
            INSERT INTO businesses (name, category, address)
            VALUES ($1, $2, $3)
            RETURNING id, name, category, address, lat, lng, google_place_id, created_at
            """,
            body.business_name,
            body.category,
            body.address,
        )
        if not biz_row:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create business.",
            )
        business_id = str(biz_row["id"])
    else:
        # Verify business exists
        exists = await pool.fetchrow(
            "SELECT id FROM businesses WHERE id = $1", business_id
        )
        if not exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business {business_id} not found.",
            )

    # Insert review
    result = await pool.fetchrow(
        """
        INSERT INTO reviews (user_id, business_id, rating, body, pros, cons, visibility, ai_polished)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, user_id, business_id, rating, body, pros, cons, visibility, ai_polished, created_at
        """,
        user_id,
        business_id,
        body.rating,
        body.body,
        body.pros or [],
        body.cons or [],
        body.visibility or "2hop",
        body.ai_polished or False,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to insert review.",
        )

    return CreateReviewResponse(review=ReviewOut(**dict(result)))


@router.post(
    "/reviews/polish",
    response_model=PolishResponse,
    summary="AI-polish a review",
    description=(
        "Use Claude AI to polish a review draft. "
        "Actions: 'polish' (grammar fix), 'structure' (extract pros/cons/verdict), "
        "'prompt' (suggest missing detail questions)."
    ),
)
async def polish_review(
    body: PolishRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    AI polish endpoint:
    - polish: fix grammar/clarity, preserve meaning
    - structure: extract pros, cons, verdict
    - prompt: suggest 2-3 follow-up questions
    """
    try:
        if body.action == "polish":
            polished = await ai_polish.polish_text(body.text)
            return PolishResponse(polished_text=polished)

        elif body.action == "structure":
            structured = await ai_polish.structure_text(body.text)
            return PolishResponse(
                suggested_pros=structured.get("pros", []),
                suggested_cons=structured.get("cons", []),
            )

        elif body.action == "prompt":
            prompts = await ai_polish.generate_prompts(body.text)
            return PolishResponse(prompts=prompts)

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid action. Must be one of: polish, structure, prompt",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI polish failed: {str(exc)}",
        )


@router.get(
    "/business/{business_id}/reviews",
    response_model=BusinessReviewsResponse,
    summary="Get trust-scoped reviews for a business",
    description=(
        "Returns reviews for a specific business, filtered to only those "
        "within the authenticated user's 2-hop trust network."
    ),
)
async def get_business_reviews(
    business_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Fetch trust-scoped reviews for a specific business."""
    user_id: str = str(current_user["id"])
    pool = get_pool()

    # Fetch business
    biz_row = await pool.fetchrow(
        "SELECT id, name, category, address, lat, lng, google_place_id, created_at FROM businesses WHERE id = $1",
        business_id,
    )
    if not biz_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business {business_id} not found.",
        )
    business = BusinessOut(**dict(biz_row))

    # Get trust graph
    direct_friends, fof = await get_trust_graph(user_id)
    all_trusted = list(direct_friends | set(fof.keys()) | {user_id})

    # Fetch reviews with reviewer info via JOIN
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
            u.created_at    AS reviewer_created_at
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

    # Batch-fetch via_friend profiles
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
            """
            SELECT id, email, name, bio, avatar_url, location, invite_code, created_at
            FROM users WHERE id = ANY($1::uuid[])
            """,
            list(via_ids_needed),
        )
        via_profile_map = {str(r["id"]): dict(r) for r in via_rows}

    reviews_out = []
    for row in rows:
        author_id = str(row["author_id"])

        if author_id == user_id:
            trust_distance = 0
            via_friend_data = None
        elif author_id in direct_friends:
            trust_distance = 1
            via_friend_data = None
        else:
            trust_distance = 2
            if row["visibility"] == "friends":
                continue
            via_friend_id = fof.get(author_id)
            via_raw = via_profile_map.get(via_friend_id) if via_friend_id else None
            via_friend_data = UserOut(**via_raw) if via_raw else None

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
                )
            )
        except Exception:
            continue

    avg_rating = None
    if reviews_out:
        avg_rating = round(sum(r.rating for r in reviews_out) / len(reviews_out), 2)

    return BusinessReviewsResponse(
        business=business,
        reviews=reviews_out,
        network_avg_rating=avg_rating,
        network_review_count=len(reviews_out),
    )
