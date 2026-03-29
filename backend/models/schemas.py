"""
Pydantic models for all API request/response types.
"""
from __future__ import annotations
from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field


# ============================================================
# AUTH
# ============================================================

class SignupRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=1, max_length=100)
    invite_code: str = Field(..., min_length=6, max_length=20)


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: UUID
    email: str
    name: Optional[str]
    bio: Optional[str]
    avatar_url: Optional[str]
    location: Optional[str]
    invite_code: Optional[str]
    created_at: datetime


class SignupResponse(BaseModel):
    user: UserOut
    token: str


class LoginResponse(BaseModel):
    user: UserOut
    token: str


# ============================================================
# BUSINESSES
# ============================================================

class BusinessOut(BaseModel):
    id: UUID
    name: str
    category: Optional[str]
    address: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    google_place_id: Optional[str]
    osm_id: Optional[str] = None
    created_at: datetime


class BusinessSearchResponse(BaseModel):
    businesses: List[BusinessOut]


class GooglePlaceUpsertRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    address: Optional[str] = None
    category: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    google_place_id: str = Field(..., min_length=1, max_length=255)


class OsmPlaceUpsertRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    address: Optional[str] = None
    category: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    osm_id: str = Field(..., min_length=1, max_length=255)


class ReviewSearchResult(BaseModel):
    """Review result for combined search — includes business info."""
    id: UUID
    rating: int
    body: Optional[str]
    pros: Optional[List[str]]
    cons: Optional[List[str]]
    visibility: str
    ai_polished: bool
    created_at: datetime
    business: BusinessOut
    reviewer_name: Optional[str]


class CombinedSearchResponse(BaseModel):
    businesses: List[BusinessOut]
    reviews: List[ReviewSearchResult]


# ============================================================
# REVIEWS
# ============================================================

class CreateReviewRequest(BaseModel):
    # Existing business
    business_id: Optional[UUID] = None
    # Or create on the fly
    business_name: Optional[str] = None
    category: Optional[str] = None
    address: Optional[str] = None

    rating: int = Field(..., ge=1, le=5)
    body: Optional[str] = None
    pros: Optional[List[str]] = None
    cons: Optional[List[str]] = None
    visibility: Optional[str] = Field(default="2hop", pattern="^(friends|2hop|private)$")
    ai_polished: Optional[bool] = False


class ReviewOut(BaseModel):
    id: UUID
    user_id: UUID
    business_id: UUID
    rating: int
    body: Optional[str]
    pros: Optional[List[str]]
    cons: Optional[List[str]]
    visibility: str
    ai_polished: bool
    created_at: datetime


class ReviewWithContext(BaseModel):
    """Review enriched with reviewer info, business info, and trust metadata."""
    id: UUID
    rating: int
    body: Optional[str]
    pros: Optional[List[str]]
    cons: Optional[List[str]]
    visibility: str
    ai_polished: bool
    created_at: datetime
    trust_distance: int  # 0 (self), 1 (direct friend), or 2 (fof)
    via_friend: Optional[UserOut]  # populated for 2-hop reviews
    reviewer: UserOut
    business: BusinessOut


class CreateReviewResponse(BaseModel):
    review: ReviewOut


class PolishRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    action: str = Field(..., pattern="^(polish|structure|prompt)$")


class PolishResponse(BaseModel):
    polished_text: Optional[str] = None
    suggested_pros: Optional[List[str]] = None
    suggested_cons: Optional[List[str]] = None
    prompts: Optional[List[str]] = None


class BusinessReviewsResponse(BaseModel):
    business: BusinessOut
    reviews: List[ReviewWithContext]
    network_avg_rating: Optional[float]
    network_review_count: int


# ============================================================
# FEED
# ============================================================

class FeedResponse(BaseModel):
    reviews: List[ReviewWithContext]
    total: int
    page: int
    has_more: bool


# ============================================================
# INVITES
# ============================================================

class InviteOut(BaseModel):
    id: UUID
    code: str
    created_by: UUID
    used_by: Optional[UUID]
    created_at: datetime
    used_at: Optional[datetime]


class GenerateInviteResponse(BaseModel):
    code: str
    invite_url: str


class InvitesListResponse(BaseModel):
    invites: List[InviteOut]


# ============================================================
# GRAPH
# ============================================================

class FriendOut(BaseModel):
    id: UUID
    name: Optional[str]
    avatar_url: Optional[str]
    location: Optional[str]
    friendship_since: datetime


class FriendOfFriendOut(BaseModel):
    id: UUID
    name: Optional[str]
    avatar_url: Optional[str]
    location: Optional[str]
    via_friend: UserOut


class GraphResponse(BaseModel):
    friends: List[FriendOut]
    friends_of_friends: List[FriendOfFriendOut]
    total_connections: int
