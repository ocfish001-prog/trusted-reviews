"""
Trust graph service.

Computes the 2-hop trust graph for a given user using a direct SQL CTE
against the friendships table via asyncpg. Results are cached in-memory
with a 5-minute TTL to avoid hammering the database on every feed request.
"""
import time
from typing import Dict, Set, Tuple

from services.database import get_pool

# Simple in-memory cache: user_id -> (timestamp, direct_friends, fof_map)
# fof_map: { fof_user_id: via_friend_id }
_CACHE: Dict[str, Tuple[float, Set[str], Dict[str, str]]] = {}
_TTL_SECONDS = 300  # 5 minutes


async def get_trust_graph(user_id: str) -> Tuple[Set[str], Dict[str, str]]:
    """
    Return the 2-hop trust graph for a user.

    Returns:
        direct_friends: set of user IDs who are direct (accepted) friends
        fof:            dict mapping friend-of-friend user ID -> via_friend_id
    """
    now = time.time()

    # Check cache
    cached = _CACHE.get(user_id)
    if cached and (now - cached[0]) < _TTL_SECONDS:
        _, direct_friends, fof = cached
        return direct_friends, fof

    pool = get_pool()

    rows = await pool.fetch(
        """
        WITH direct AS (
            SELECT CASE WHEN user_a = $1 THEN user_b ELSE user_a END AS friend_id
            FROM friendships
            WHERE status = 'accepted'
              AND (user_a = $1 OR user_b = $1)
        ),
        fof AS (
            SELECT
                CASE WHEN f.user_a = d.friend_id THEN f.user_b ELSE f.user_a END AS fof_id,
                d.friend_id AS via_friend_id
            FROM friendships f
            JOIN direct d ON (f.user_a = d.friend_id OR f.user_b = d.friend_id)
            WHERE f.status = 'accepted'
        )
        SELECT friend_id AS user_id, 1 AS hop, NULL::uuid AS via_friend FROM direct
        UNION ALL
        SELECT DISTINCT ON (fof_id) fof_id, 2, via_friend_id
        FROM fof
        WHERE fof_id != $1
          AND fof_id NOT IN (SELECT friend_id FROM direct)
        """,
        user_id,
    )

    direct_friends: Set[str] = set()
    fof: Dict[str, str] = {}

    for row in rows:
        if row["hop"] == 1:
            direct_friends.add(str(row["user_id"]))
        else:
            fof[str(row["user_id"])] = str(row["via_friend"])

    # Store in cache
    _CACHE[user_id] = (now, direct_friends, fof)
    return direct_friends, fof


def invalidate_cache(user_id: str) -> None:
    """Invalidate the trust graph cache for a user (call after friendship changes)."""
    _CACHE.pop(user_id, None)


async def get_all_trusted_ids(user_id: str) -> Set[str]:
    """Convenience: return union of direct friends + fof (plus self)."""
    direct, fof = await get_trust_graph(user_id)
    return {user_id} | direct | set(fof.keys())
