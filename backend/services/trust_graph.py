"""
Trust graph service.

Computes the 2-hop trust graph for a given user using a recursive CTE
against the Supabase friendships table. Results are cached in-memory
with a 5-minute TTL to avoid hammering the database on every feed request.
"""
import time
from typing import Dict, Set, Tuple
from uuid import UUID

from services.supabase_client import supabase

# Simple in-memory cache: user_id -> (timestamp, direct_friends, fof_map)
# fof_map: { fof_user_id: via_friend_id }
_CACHE: Dict[str, Tuple[float, Set[str], Dict[str, str]]] = {}
_TTL_SECONDS = 300  # 5 minutes


def get_trust_graph(user_id: str) -> Tuple[Set[str], Dict[str, str]]:
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

    # Query using the DB helper function (defined in schema.sql)
    result = supabase.rpc(
        "get_trusted_user_ids",
        {"viewer_id": user_id}
    ).execute()

    direct_friends: Set[str] = set()
    # We need via_friend info for fof, so we do a slightly richer query directly
    # against friendships to build that mapping.
    fof: Dict[str, str] = {}

    if result.data:
        hop1_ids = {row["trusted_id"] for row in result.data if row["hop"] == 1}
        hop2_ids = {row["trusted_id"] for row in result.data if row["hop"] == 2}
        direct_friends = hop1_ids

        if hop2_ids:
            # Build via_friend mapping: for each fof, find which direct friend connects them
            fof_result = supabase.rpc(
                "get_fof_with_via",
                {"viewer_id": user_id}
            ).execute()

            if fof_result.data:
                for row in fof_result.data:
                    fof[row["fof_id"]] = row["via_friend_id"]
            else:
                # Fallback: assign arbitrary via_friend from direct friends
                # This handles cases where the helper RPC isn't available
                for fof_id in hop2_ids:
                    fof[fof_id] = _find_via_friend(fof_id, direct_friends)

    # Store in cache
    _CACHE[user_id] = (now, direct_friends, fof)
    return direct_friends, fof


def _find_via_friend(fof_id: str, direct_friends: Set[str]) -> str:
    """
    Find which direct friend connects a fof user (fallback for when
    the get_fof_with_via RPC isn't available).
    """
    result = supabase.table("friendships").select("user_a, user_b").eq("status", "accepted").or_(
        f"user_a.eq.{fof_id},user_b.eq.{fof_id}"
    ).execute()

    if result.data:
        for row in result.data:
            peer = row["user_b"] if row["user_a"] == fof_id else row["user_a"]
            if peer in direct_friends:
                return peer

    return next(iter(direct_friends), "")


def invalidate_cache(user_id: str) -> None:
    """Invalidate the trust graph cache for a user (call after friendship changes)."""
    _CACHE.pop(user_id, None)


def get_all_trusted_ids(user_id: str) -> Set[str]:
    """Convenience: return union of direct friends + fof (plus self)."""
    direct, fof = get_trust_graph(user_id)
    return {user_id} | direct | set(fof.keys())
