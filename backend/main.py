"""
Trusted Reviews Network — FastAPI Application

Entry point. Configures CORS, mounts all routers, and provides health check.
"""
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from services.database import init_pool, close_pool
from routers import auth, feed, reviews, businesses, invites, graph, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown lifecycle for the asyncpg pool."""
    await init_pool(settings.database_url)
    # Run migrations (idempotent)
    from services.database import get_pool as _get_pool
    _pool = _get_pool()
    await _pool.execute("ALTER TABLE businesses ADD COLUMN IF NOT EXISTS osm_id text")
    await _pool.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS zip_code text")
    await _pool.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS home_lat float")
    await _pool.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS home_lng float")
    await _pool.execute("ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_place_id text")
    # Ensure UNIQUE constraints exist for ON CONFLICT
    await _pool.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'businesses_google_place_id_key'
            ) THEN
                BEGIN
                    ALTER TABLE businesses ADD CONSTRAINT businesses_google_place_id_key UNIQUE (google_place_id);
                EXCEPTION WHEN duplicate_table THEN NULL;
                END;
            END IF;
        END $$;
    """)
    await _pool.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'businesses_osm_id_key'
            ) THEN
                BEGIN
                    ALTER TABLE businesses ADD CONSTRAINT businesses_osm_id_key UNIQUE (osm_id);
                EXCEPTION WHEN duplicate_table THEN NULL;
                END;
            END IF;
        END $$;
    """)
    # Create reactions table
    await _pool.execute("""
        CREATE TABLE IF NOT EXISTS reactions (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            review_id   UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
            user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type        TEXT NOT NULL CHECK (type IN ('helpful', 'agree', 'thanks')),
            created_at  TIMESTAMPTZ DEFAULT now(),
            UNIQUE (review_id, user_id, type)
        )
    """)
    await _pool.execute("""
        CREATE INDEX IF NOT EXISTS idx_reactions_review_id ON reactions (review_id)
    """)
    yield
    await close_pool()


app = FastAPI(
    title="Trusted Reviews Network API",
    description=(
        "A semi-closed, invite-only reviews platform where users see reviews "
        "from friends and friends-of-friends (2-hop trust graph). "
        "No public content — everything is trust-scoped."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ============================================================
# CORS — must be added FIRST so it wraps all responses including errors
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Global exception handler — ensures unhandled errors still get CORS headers
# (CORSMiddleware wraps this response because it's added as middleware above)
# ============================================================
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return a proper JSON 500 with detail."""
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error."},
    )

# ============================================================
# ROUTERS
# ============================================================
app.include_router(auth.router)
app.include_router(feed.router)
app.include_router(reviews.router)
app.include_router(businesses.router)
app.include_router(invites.router)
app.include_router(graph.router)
app.include_router(users.router)


# ============================================================
# HEALTH CHECK
# ============================================================
@app.get("/health", tags=["system"], summary="Health check")
async def health():
    """Returns 200 OK if the API is running."""
    return {"status": "ok", "version": "1.0.0"}


@app.get("/", tags=["system"], include_in_schema=False)
async def root():
    return {"message": "Trusted Reviews Network API", "docs": "/docs"}
