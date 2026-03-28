"""
Shared auth dependency for FastAPI routers.
Validates the Bearer JWT token via Supabase and returns the current user.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from services.supabase_client import supabase

_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """
    Validate Bearer token via Supabase Auth and return the user's profile
    from the users table.
    """
    token = credentials.credentials

    try:
        user_response = supabase.auth.get_user(token)
        auth_user = user_response.user
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not auth_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch full user profile from users table
    profile_result = (
        supabase.table("users")
        .select("*")
        .eq("id", str(auth_user.id))
        .single()
        .execute()
    )

    if not profile_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found.",
        )

    return profile_result.data
