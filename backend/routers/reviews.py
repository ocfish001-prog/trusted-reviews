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
from services.supabase_client import supabase
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
    user_id: str = current_user["id"]
    business_id: str | None = str(body.business_id) if body.business_id else None

    # Resolve or create business
    if not business_id:
        if not body.business_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either business_id or business_name must be provided.",
            )
        biz_insert = (
            supabase.table("businesses")
            .insert(
                {
                    "name": body.business_name,
                    "category": body.category,
                    "address": body.address,
                }
            )
            .execute()
        )
        if not biz_insert.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create business.",
            )
        business_id = biz_insert.data[0]["id"]
    else:
        # Verify business exists
        biz_check = (
            supabase.table("businesses")
            .select("id")
            .eq("id", business_id)
            .single()
            .execute()
        )
        if not biz_check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Business {business_id} not found.",
            )

    # Insert review
    review_data = {
        "user_id": user_id,
        "business_id": business_id,
        "rating": body.rating,
        "body": body.body,
        "pros": body.pros or [],
        "cons": body.cons or [],
        "visibility": body.visibility or "2hop",
        "ai_polished": body.ai_polished or False,
    }

    result = supabase.table("reviews").insert(review_data).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to insert review.",
        )

    return CreateReviewResponse(review=ReviewOut(**result.data[0]))


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
    user_id: str = current_user["id"]

    # Fetch business
    biz_result = (
        supabase.table("businesses")
        .select("*")
        .eq("id", business_id)
        .single()
        .execute()
    )
    if not biz_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Business {business_id} not found.",
        )
    business = BusinessOut(**biz_result.data)

    # Get trust graph
    direct_friends, fof = get_trust_graph(user_id)
    all_trusted = list(direct_friends | set(fof.keys()) | {user_id})

    # Fetch reviews for this business from trusted users
    result = (
        supabase.table("reviews")
        .select(
            "*, users!reviews_user_id_fkey(id, name, avatar_url, location, email, bio, invite_code, created_at)"
        )
        .eq("business_id", business_id)
        .in_("user_id", all_trusted)
        .neq("visibility", "private")
        .order("created_at", desc=True)
        .execute()
    )

    reviews_out = []
    user_cache: dict = {}

    for row in result.data or []:
        author_id: str = row["user_id"]
        reviewer_data = row.get("users") or {}

        if author_id == user_id:
            trust_distance = 0
            via_friend_data = None
        elif author_id in direct_friends:
            trust_distance = 1
            via_friend_data = None
        else:
            trust_distance = 2
            if row.get("visibility") == "friends":
                continue
            via_friend_id = fof.get(author_id)
            if via_friend_id and via_friend_id not in user_cache:
                vf = supabase.table("users").select("*").eq("id", via_friend_id).single().execute()
                user_cache[via_friend_id] = vf.data
            via_raw = user_cache.get(via_friend_id) if via_friend_id else None
            via_friend_data = UserOut(**via_raw) if via_raw else None

        try:
            reviews_out.append(
                ReviewWithContext(
                    id=row["id"],
                    rating=row["rating"],
                    body=row.get("body"),
                    pros=row.get("pros"),
                    cons=row.get("cons"),
                    visibility=row["visibility"],
                    ai_polished=row.get("ai_polished", False),
                    created_at=row["created_at"],
                    trust_distance=trust_distance,
                    via_friend=via_friend_data,
                    reviewer=UserOut(**reviewer_data) if reviewer_data else None,
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
