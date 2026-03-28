"""
Trusted Reviews Network — FastAPI Application

Entry point. Configures CORS, mounts all routers, and provides health check.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import auth, feed, reviews, businesses, invites, graph

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
)

# ============================================================
# CORS
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
