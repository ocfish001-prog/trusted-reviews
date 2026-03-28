"""
Graph router — friend and 2-hop connection graph for the current user.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from models.schemas import GraphResponse, FriendOut, FriendOfFriendOut, UserOut
from services.database import get_pool
from services.trust_graph import get_trust_graph
from .auth_deps import get_current_user

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get(
    "/connections",
    response_model=GraphResponse,
    summary="Get trust graph connections",
    description=(
        "Return the authenticated user's direct friends and 2-hop friends-of-friends, "
        "including metadata like friendship date and via-friend info."
    ),
)
async def get_connections(current_user: dict = Depends(get_current_user)):
    """
    Build and return the full trust graph for the current user:
    - friends: direct accepted friends with friendship_since date
    - friends_of_friends: 2-hop connections with via_friend metadata
    """
    user_id: str = str(current_user["id"])
    pool = get_pool()

    direct_friends, fof = await get_trust_graph(user_id)

    # Fetch direct friend profiles + friendship dates in one query each
    friends_out = []
    if direct_friends:
        profiles_rows = await pool.fetch(
            """
            SELECT id, email, name, bio, avatar_url, location, invite_code, created_at
            FROM users WHERE id = ANY($1::uuid[])
            """,
            list(direct_friends),
        )
        profile_map = {str(r["id"]): dict(r) for r in profiles_rows}

        # Fetch friendship creation dates
        friendship_rows = await pool.fetch(
            """
            SELECT user_a, user_b, created_at
            FROM friendships
            WHERE status = 'accepted'
              AND (user_a = $1 OR user_b = $1)
            """,
            user_id,
        )
        friendship_date_map: dict = {}
        for fs in friendship_rows:
            peer = str(fs["user_b"]) if str(fs["user_a"]) == user_id else str(fs["user_a"])
            friendship_date_map[peer] = fs["created_at"]

        for friend_id in direct_friends:
            profile = profile_map.get(friend_id)
            if not profile:
                continue
            friends_out.append(
                FriendOut(
                    id=profile["id"],
                    name=profile.get("name"),
                    avatar_url=profile.get("avatar_url"),
                    location=profile.get("location"),
                    friendship_since=friendship_date_map.get(friend_id, profile["created_at"]),
                )
            )

    # Fetch fof profiles + via_friend profiles in one batch query
    fof_out = []
    if fof:
        all_fof_ids = list(fof.keys())
        all_via_ids = list(set(fof.values()))
        all_ids_to_fetch = list(set(all_fof_ids + all_via_ids))

        profiles_rows = await pool.fetch(
            """
            SELECT id, email, name, bio, avatar_url, location, invite_code, created_at
            FROM users WHERE id = ANY($1::uuid[])
            """,
            all_ids_to_fetch,
        )
        profile_map = {str(r["id"]): dict(r) for r in profiles_rows}

        for fof_id, via_id in fof.items():
            fof_profile = profile_map.get(fof_id)
            via_profile = profile_map.get(via_id)
            if not fof_profile:
                continue

            via_friend = UserOut(**via_profile) if via_profile else None

            fof_out.append(
                FriendOfFriendOut(
                    id=fof_profile["id"],
                    name=fof_profile.get("name"),
                    avatar_url=fof_profile.get("avatar_url"),
                    location=fof_profile.get("location"),
                    via_friend=via_friend,
                )
            )

    return GraphResponse(
        friends=friends_out,
        friends_of_friends=fof_out,
        total_connections=len(friends_out) + len(fof_out),
    )
