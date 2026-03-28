"""
Invites router — generate and list invite codes.
"""
import random
import string
from fastapi import APIRouter, Depends, HTTPException, status

from models.schemas import GenerateInviteResponse, InvitesListResponse, InviteOut
from services.supabase_client import supabase
from config import settings
from .auth_deps import get_current_user

router = APIRouter(prefix="/invites", tags=["invites"])

_INVITE_LENGTH = 8
_INVITE_CHARS = string.ascii_uppercase + string.digits


def _generate_code() -> str:
    """Generate a random 8-character alphanumeric invite code."""
    return "".join(random.choices(_INVITE_CHARS, k=_INVITE_LENGTH))


@router.post(
    "/generate",
    response_model=GenerateInviteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate an invite code",
    description="Generate a unique invite code that can be shared to onboard a new user.",
)
async def generate_invite(current_user: dict = Depends(get_current_user)):
    """
    Generate a unique invite code and insert into the invites table.
    Retries up to 5 times on collision (extremely unlikely).
    """
    user_id: str = current_user["id"]

    code = None
    for _ in range(5):
        candidate = _generate_code()
        # Check for collision
        existing = (
            supabase.table("invites")
            .select("id")
            .eq("code", candidate)
            .execute()
        )
        if not existing.data:
            code = candidate
            break

    if not code:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate a unique invite code. Please try again.",
        )

    result = (
        supabase.table("invites")
        .insert({"code": code, "created_by": user_id})
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save invite code.",
        )

    # Build invite URL (frontend URL is first in CORS origins)
    frontend_url = settings.cors_origins_list[0].rstrip("/")
    invite_url = f"{frontend_url}/join?code={code}"

    return GenerateInviteResponse(code=code, invite_url=invite_url)


@router.get(
    "",
    response_model=InvitesListResponse,
    summary="List my invite codes",
    description="List all invite codes created by the authenticated user.",
)
async def list_invites(current_user: dict = Depends(get_current_user)):
    """Return all invites created by the current user."""
    user_id: str = current_user["id"]

    result = (
        supabase.table("invites")
        .select("*")
        .eq("created_by", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    invites = [InviteOut(**inv) for inv in (result.data or [])]
    return InvitesListResponse(invites=invites)
