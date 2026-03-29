"""
Users router — profile lookup, profile update, and user reviews.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from models.schemas import UserOut, ReviewWithContext, BusinessOut
from services.database import get_pool
from services.trust_graph import get_trust_graph
from .auth_deps import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/me",
    response_model=UserOut,
    summary="Get the authenticated user's profile",
)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return UserOut(**{
        k: current_user[k]
        for k in ("id", "email", "name", "bio", "avatar_url", "location", "invite_code", "created_at")
    })


@router.patch(
    "/me",
    response_model=UserOut,
    summary="Update the authenticated user's profile",
)
async def update_me(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Update mutable profile fields: name, bio, avatar_url, location, zip_code."""
    allowed_fields = {"name", "bio", "avatar_url", "location", "zip_code"}
    updates = {k: v for k, v in body.items() if k in allowed_fields}

    # If zip_code provided, geocode it to lat/lng
    if "zip_code" in updates and updates["zip_code"]:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"q": updates["zip_code"], "format": "json", "limit": 1, "countrycodes": "us"},
                    headers={"User-Agent": "TrustedReviews/1.0 (contact@trusted-reviews.app)"},
                    timeout=5.0,
                )
                geo = resp.json()
                if geo:
                    updates["home_lat"] = float(geo[0]["lat"])
                    updates["home_lng"] = float(geo[0]["lon"])
        except Exception:
            pass  # geocoding failure is non-fatal

    if not updates:
        return UserOut(**{
            k: current_user.get(k)
            for k in ("id", "email", "name", "bio", "avatar_url", "location", "invite_code", "created_at")
        })

    pool = get_pool()
    set_clause = ", ".join(f"{col} = ${i + 2}" for i, col in enumerate(updates))
    values = list(updates.values())

    row = await pool.fetchrow(
        f"""
        UPDATE users SET {set_clause}
        WHERE id = $1
        RETURNING id, email, name, bio, avatar_url, location, zip_code, home_lat, home_lng, invite_code, created_at
        """,
        str(current_user["id"]),
        *values,
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    d = dict(row)
    return UserOut(**{k: d.get(k) for k in ("id", "email", "name", "bio", "avatar_url", "location", "invite_code", "created_at")})


@router.get(
    "/{username}",
    response_model=UserOut,
    summary="Get a user profile by username slug",
    description=(
        "Looks up a user by their username slug (lowercased name with spaces removed). "
        "Also accepts a raw UUID for direct ID lookups."
    ),
)
async def get_user_profile(
    username: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Resolve a username slug to a user profile.
    Tries exact UUID match first, then falls back to name-based slug matching.
    """
    pool = get_pool()

    # 1. Try UUID lookup first
    try:
        from uuid import UUID
        UUID(username)  # validates format
        row = await pool.fetchrow(
            "SELECT id, email, name, bio, avatar_url, location, invite_code, created_at FROM users WHERE id = $1",
            username,
        )
        if row:
            return UserOut(**dict(row))
    except ValueError:
        pass  # not a UUID — fall through to slug lookup

    # 2. Slug lookup: match users whose lowercased name with spaces removed equals the slug
    # We pull all users and match in Python to avoid complex SQL regex
    rows = await pool.fetch(
        "SELECT id, email, name, bio, avatar_url, location, invite_code, created_at FROM users"
    )

    for row in rows:
        if row["name"]:
            slug = row["name"].lower().replace(" ", "")
            if slug == username.lower():
                return UserOut(**dict(row))

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"User '{username}' not found.",
    )


@router.get(
    "/{user_id}/reviews",
    response_model=list,
    summary="Get reviews by a specific user",
)
async def get_user_reviews(
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Fetch all public/2hop reviews written by the specified user."""
    pool = get_pool()
    requester_id = str(current_user["id"])

    # Get trust graph to determine visibility
    direct_friends, fof = await get_trust_graph(requester_id)
    is_self = user_id == requester_id
    is_friend = user_id in direct_friends
    is_fof = user_id in fof

    # Determine visibility filter
    if is_self:
        visibility_filter = ["friends", "2hop"]  # own reviews (exclude private from public view)
    elif is_friend:
        visibility_filter = ["friends", "2hop"]
    elif is_fof:
        visibility_filter = ["2hop"]
    else:
        visibility_filter = ["2hop"]  # public-ish fallback

    rows = await pool.fetch(
        """
        SELECT
            r.id, r.rating, r.body, r.pros, r.cons, r.visibility,
            r.ai_polished, r.created_at, r.user_id, r.business_id,
            b.id AS biz_id, b.name AS biz_name, b.category AS biz_category,
            b.address AS biz_address, b.lat AS biz_lat, b.lng AS biz_lng,
            b.google_place_id AS biz_google_place_id, b.created_at AS biz_created_at,
            u.email AS reviewer_email, u.name AS reviewer_name,
            u.bio AS reviewer_bio, u.avatar_url AS reviewer_avatar_url,
            u.location AS reviewer_location, u.invite_code AS reviewer_invite_code,
            u.created_at AS reviewer_created_at
        FROM reviews r
        JOIN businesses b ON b.id = r.business_id
        JOIN users u ON u.id = r.user_id
        WHERE r.user_id = $1
          AND r.visibility = ANY($2::text[])
        ORDER BY r.created_at DESC
        """,
        user_id,
        visibility_filter,
    )

    results = []
    for row in rows:
        try:
            trust_distance = 0 if is_self else (1 if is_friend else 2)
            results.append(
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
                    via_friend=None,
                    reviewer=UserOut(
                        id=row["user_id"],
                        email=row["reviewer_email"],
                        name=row["reviewer_name"],
                        bio=row["reviewer_bio"],
                        avatar_url=row["reviewer_avatar_url"],
                        location=row["reviewer_location"],
                        invite_code=row["reviewer_invite_code"],
                        created_at=row["reviewer_created_at"],
                    ),
                    business=BusinessOut(
                        id=row["biz_id"],
                        name=row["biz_name"],
                        category=row["biz_category"],
                        address=row["biz_address"],
                        lat=row["biz_lat"],
                        lng=row["biz_lng"],
                        google_place_id=row["biz_google_place_id"],
                        created_at=row["biz_created_at"],
                    ),
                ).model_dump(mode="json")
            )
        except Exception:
            continue

    return results
