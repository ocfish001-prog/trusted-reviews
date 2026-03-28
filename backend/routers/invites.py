"""
Invites router — generate and list invite codes.
"""
import random
import string
from fastapi import APIRouter, Depends, HTTPException, status

from models.schemas import GenerateInviteResponse, InvitesListResponse, InviteOut
from services.database import get_pool
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
    user_id: str = str(current_user["id"])
    pool = get_pool()

    code = None
    for _ in range(5):
        candidate = _generate_code()
        existing = await pool.fetchrow(
            "SELECT id FROM invites WHERE code = $1", candidate
        )
        if not existing:
            code = candidate
            break

    if not code:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate a unique invite code. Please try again.",
        )

    result = await pool.fetchrow(
        """
        INSERT INTO invites (code, created_by)
        VALUES ($1, $2)
        RETURNING id, code, created_by, used_by, created_at, used_at
        """,
        code,
        user_id,
    )

    if not result:
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
    user_id: str = str(current_user["id"])
    pool = get_pool()

    rows = await pool.fetch(
        """
        SELECT id, code, created_by, used_by, created_at, used_at
        FROM invites
        WHERE created_by = $1
        ORDER BY created_at DESC
        """,
        user_id,
    )

    invites = [InviteOut(**dict(inv)) for inv in rows]
    return InvitesListResponse(invites=invites)
