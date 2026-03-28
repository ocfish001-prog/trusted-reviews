-- ============================================================
-- Trusted Reviews Network — Supabase Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    name        TEXT,
    bio         TEXT,
    avatar_url  TEXT,
    location    TEXT,
    invite_code TEXT UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT now()
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

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews     ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: 2-hop trust graph function
-- Returns all user IDs within 2 hops from the given user
-- ============================================================

CREATE OR REPLACE FUNCTION get_trusted_user_ids(viewer_id UUID)
RETURNS TABLE (trusted_id UUID, hop INT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
    -- Direct friends (1 hop)
    WITH direct AS (
        SELECT
            CASE WHEN user_a = viewer_id THEN user_b ELSE user_a END AS friend_id
        FROM friendships
        WHERE status = 'accepted'
          AND (user_a = viewer_id OR user_b = viewer_id)
    ),
    -- Friends of friends (2 hops), excluding self and direct friends
    fof AS (
        SELECT
            CASE WHEN f.user_a = d.friend_id THEN f.user_b ELSE f.user_a END AS fof_id
        FROM friendships f
        JOIN direct d ON (f.user_a = d.friend_id OR f.user_b = d.friend_id)
        WHERE f.status = 'accepted'
    )
    SELECT friend_id AS trusted_id, 1 AS hop FROM direct
    UNION
    SELECT fof_id AS trusted_id, 2 AS hop
    FROM fof
    WHERE fof_id != viewer_id
      AND fof_id NOT IN (SELECT friend_id FROM direct)
$$;

-- ============================================================
-- RLS POLICIES — USERS
-- ============================================================

-- Users can always read their own profile
CREATE POLICY "users_self_read" ON users
    FOR SELECT
    USING (auth.uid() = id);

-- Users can read profiles of people within 2 hops
CREATE POLICY "users_trust_read" ON users
    FOR SELECT
    USING (
        id IN (SELECT trusted_id FROM get_trusted_user_ids(auth.uid()))
    );

-- Users can update their own profile
CREATE POLICY "users_self_update" ON users
    FOR UPDATE
    USING (auth.uid() = id);

-- Users can insert their own profile (during signup)
CREATE POLICY "users_self_insert" ON users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ============================================================
-- RLS POLICIES — BUSINESSES
-- ============================================================

-- All authenticated users can read businesses
CREATE POLICY "businesses_auth_read" ON businesses
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Authenticated users can insert businesses
CREATE POLICY "businesses_auth_insert" ON businesses
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- RLS POLICIES — REVIEWS
-- ============================================================

-- Reviews visible only to users within the author's trust graph
-- (respects visibility setting: friends=1hop, 2hop=2hops, private=only self)
CREATE POLICY "reviews_trust_read" ON reviews
    FOR SELECT
    USING (
        -- Author can always see their own reviews
        user_id = auth.uid()
        OR (
            -- For 'private', only the author sees it (caught above)
            visibility != 'private'
            AND (
                -- 'friends' visibility: only direct friends (hop=1)
                (visibility = 'friends' AND auth.uid() IN (
                    SELECT trusted_id FROM get_trusted_user_ids(user_id) WHERE hop = 1
                ))
                OR
                -- '2hop' visibility: anyone within 2 hops
                (visibility = '2hop' AND auth.uid() IN (
                    SELECT trusted_id FROM get_trusted_user_ids(user_id)
                ))
            )
        )
    );

-- Users can insert their own reviews
CREATE POLICY "reviews_self_insert" ON reviews
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "reviews_self_update" ON reviews
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "reviews_self_delete" ON reviews
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================
-- RLS POLICIES — FRIENDSHIPS
-- ============================================================

-- Users can see friendships they are part of
CREATE POLICY "friendships_self_read" ON friendships
    FOR SELECT
    USING (user_a = auth.uid() OR user_b = auth.uid());

-- Users can create friendship requests (as user_a)
CREATE POLICY "friendships_self_insert" ON friendships
    FOR INSERT
    WITH CHECK (user_a = auth.uid());

-- Users can update friendships where they are user_b (accepting requests)
CREATE POLICY "friendships_self_update" ON friendships
    FOR UPDATE
    USING (user_b = auth.uid());

-- ============================================================
-- RLS POLICIES — INVITES
-- ============================================================

-- Users can see invites they created
CREATE POLICY "invites_creator_read" ON invites
    FOR SELECT
    USING (created_by = auth.uid());

-- Authenticated users can insert invites (as themselves)
CREATE POLICY "invites_self_insert" ON invites
    FOR INSERT
    WITH CHECK (created_by = auth.uid());

-- Service role can update invites (mark as used during signup)
-- This is handled via service role key in the backend, bypassing RLS
