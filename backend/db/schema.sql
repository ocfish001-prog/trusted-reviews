-- ============================================================
-- Trusted Reviews Network — PostgreSQL Schema
-- Compatible with Railway Postgres (Postgres 13+)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    name          TEXT,
    bio           TEXT,
    avatar_url    TEXT,
    location      TEXT,
    invite_code   TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS businesses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    category        TEXT,
    address         TEXT,
    lat             FLOAT,
    lng             FLOAT,
    google_place_id TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    rating       INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    body         TEXT,
    pros         TEXT[],
    cons         TEXT[],
    visibility   TEXT NOT NULL DEFAULT '2hop' CHECK (visibility IN ('friends', '2hop', 'private')),
    ai_polished  BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS friendships (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS invites (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code       TEXT UNIQUE NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    used_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    used_at    TIMESTAMPTZ
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Friendships: fast lookup by either user + status
CREATE INDEX IF NOT EXISTS idx_friendships_user_a_status ON friendships (user_a, status);
CREATE INDEX IF NOT EXISTS idx_friendships_user_b_status ON friendships (user_b, status);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_user_id     ON reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_business_id ON reviews (business_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at  ON reviews (created_at DESC);

-- Businesses: trigram index for full-text search on name
CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm ON businesses USING GIN (name gin_trgm_ops);

-- Invites: fast lookup by code
CREATE INDEX IF NOT EXISTS idx_invites_code ON invites (code);

-- Sprint 2: Google Places integration
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_google_place_id 
ON businesses (google_place_id) WHERE google_place_id IS NOT NULL;
