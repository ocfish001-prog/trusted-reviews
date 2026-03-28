"""
Shared auth dependency for FastAPI routers.
Validates the Bearer JWT token via python-jose and returns the current user.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError

from config import settings
from services.database import get_pool

_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """
    Validate Bearer JWT token and return the user's profile from the users table.

    Raises HTTP 401 if the token is missing, invalid, or expired.
    Raises HTTP 404 if the user no longer exists in the database.
    """
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject.",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    pool = get_pool()
    row = await pool.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return dict(row)
