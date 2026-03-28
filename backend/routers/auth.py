"""
Auth router — handles user signup and login.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import APIRouter, HTTPException, status
from jose import jwt
from passlib.context import CryptContext

from config import settings
from models.schemas import SignupRequest, SignupResponse, LoginRequest, LoginResponse, UserOut
from services.database import get_pool

router = APIRouter(prefix="/auth", tags=["auth"])

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return _pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return _pwd_context.verify(plain, hashed)


def _create_token(user_id: str) -> str:
    """Create a signed JWT for the given user ID."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


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
    2. Hash password with bcrypt
    3. INSERT into users table
    4. Mark invite as used
    5. Auto-create friendship with invite creator
    6. Return JWT
    """
    pool = get_pool()

    # 1. Validate invite code
    invite = await pool.fetchrow(
        "SELECT id, code, created_by, used_by FROM invites WHERE code = $1",
        body.invite_code,
    )
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid invite code.",
        )
    if invite["used_by"] is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This invite code has already been used.",
        )

    # Keep UUID objects as-is — asyncpg requires native UUID, not str
    invite_creator_id: UUID = invite["created_by"]
    invite_id: UUID = invite["id"]

    # Check email not already registered
    existing = await pool.fetchrow("SELECT id FROM users WHERE email = $1", body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    # 2. Hash password
    password_hash = _hash_password(body.password)

    # 3. Insert user — store NULL for invite_code column (user's own code, not the one they used)
    user_row = await pool.fetchrow(
        """
        INSERT INTO users (email, name, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, email, name, bio, avatar_url, location, invite_code, created_at
        """,
        body.email,
        body.name,
        password_hash,
    )
    if not user_row:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user profile.",
        )

    user_id: UUID = user_row["id"]

    # 4. Mark invite as used
    await pool.execute(
        "UPDATE invites SET used_by = $1, used_at = $2 WHERE id = $3",
        user_id,
        datetime.now(timezone.utc),
        invite_id,
    )

    # 5. Auto-create friendship between new user and invite creator
    await pool.execute(
        """
        INSERT INTO friendships (user_a, user_b, status)
        VALUES ($1, $2, 'accepted')
        ON CONFLICT (user_a, user_b) DO NOTHING
        """,
        invite_creator_id,
        user_id,
    )

    # 6. Generate JWT
    token = _create_token(str(user_id))

    return SignupResponse(
        user=UserOut(**dict(user_row)),
        token=token,
    )


@router.post(
    "/login",
    summary="Log in with email and password",
    description="Authenticate an existing user and return a JWT token. Accepts JSON body with email/password.",
)
async def login(body: LoginRequest):
    """
    Authenticate a user:
    1. Look up user by email
    2. Verify password against bcrypt hash
    3. Return JWT in both `token` and `access_token` formats for compatibility
    """
    pool = get_pool()

    # 1. Fetch user (including password_hash, but exclude from response)
    row = await pool.fetchrow(
        """
        SELECT id, email, name, bio, avatar_url, location, invite_code, created_at, password_hash
        FROM users WHERE email = $1
        """,
        body.email,
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Verify password
    if not _verify_password(body.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str = str(row["id"])
    token = _create_token(user_id)

    user_data = {k: v for k, v in dict(row).items() if k != "password_hash"}
    user_out = UserOut(**user_data)

    # Return both formats: `token` for internal and `access_token`/`token_type` for OAuth2 compat
    return {
        "user": user_out.model_dump(mode="json"),
        "token": token,
        "access_token": token,
        "token_type": "bearer",
    }
