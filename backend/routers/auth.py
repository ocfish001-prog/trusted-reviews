"""
Auth router — handles user signup with invite code validation.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status

from models.schemas import SignupRequest, SignupResponse, UserOut
from services.supabase_client import supabase

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/signup",
    response_model=SignupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Sign up with an invite code",
    description=(
        "Creates a new user account. Requires a valid, unused invite code. "
        "Automatically creates a friendship with the invite sender."
    ),
)
async def signup(body: SignupRequest):
    """
    Register a new user:
    1. Validate invite_code exists and is unused
    2. Create user via Supabase Auth
    3. Insert into users table
    4. Mark invite as used
    5. Auto-create friendship with invite creator
    """
    # 1. Validate invite code
    invite_result = (
        supabase.table("invites")
        .select("id, code, created_by, used_by")
        .eq("code", body.invite_code)
        .single()
        .execute()
    )

    if not invite_result.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invite code.",
        )

    invite = invite_result.data
    if invite.get("used_by") is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invite code has already been used.",
        )

    invite_creator_id: str = invite["created_by"]
    invite_id: str = invite["id"]

    # 2. Create user via Supabase Auth
    try:
        auth_response = supabase.auth.admin.create_user(
            {
                "email": body.email,
                "password": body.password,
                "email_confirm": True,
            }
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create auth user: {str(exc)}",
        )

    auth_user = auth_response.user
    if not auth_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Auth user creation returned no user.",
        )

    user_id: str = str(auth_user.id)

    # 3. Insert into users table
    user_insert = (
        supabase.table("users")
        .insert(
            {
                "id": user_id,
                "email": body.email,
                "name": body.name,
                "invite_code": body.invite_code,
            }
        )
        .execute()
    )

    if not user_insert.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to insert user profile.",
        )

    # 4. Mark invite as used
    supabase.table("invites").update(
        {
            "used_by": user_id,
            "used_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", invite_id).execute()

    # 5. Auto-create friendship between new user and invite creator
    supabase.table("friendships").insert(
        {
            "user_a": invite_creator_id,
            "user_b": user_id,
            "status": "accepted",
        }
    ).execute()

    # 6. Sign in to get a token
    try:
        sign_in = supabase.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
        token = sign_in.session.access_token
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Account created but login failed: {str(exc)}",
        )

    user_data = user_insert.data[0]
    return SignupResponse(
        user=UserOut(**user_data),
        token=token,
    )
