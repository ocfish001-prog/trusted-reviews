# Trusted Reviews Network

A semi-closed, invite-only reviews platform where users see reviews from friends and friends-of-friends (2-hop trust graph). No public content — everything is trust-scoped.

## Project Structure

```
trusted-reviews/
  backend/          # FastAPI Python API
    main.py         # App entry point
    config.py       # Settings from env vars
    requirements.txt
    Procfile        # Railway deployment
    .env.example
    db/
      schema.sql    # Full Supabase schema + RLS policies
    routers/
      auth.py       # POST /auth/signup
      feed.py       # GET /feed
      reviews.py    # POST /reviews, POST /reviews/polish, GET /business/{id}/reviews
      businesses.py # GET /businesses/search
      invites.py    # POST /invites/generate, GET /invites
      graph.py      # GET /graph/connections
    services/
      supabase_client.py  # Supabase client init
      trust_graph.py      # 2-hop trust graph logic (cached)
      ai_polish.py        # Claude AI review polish
    models/
      schemas.py    # All Pydantic request/response models
```

## Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your Supabase + Anthropic credentials
pip install -r requirements.txt
uvicorn main:app --reload
```

## Database Setup

1. Create a Supabase project
2. Run `backend/db/schema.sql` in the Supabase SQL editor
3. This creates all tables, RLS policies, indexes, and the trust graph helper function

## Deployment (Railway)

```bash
railway login
railway init
railway up
```

Set environment variables in Railway dashboard matching `.env.example`.

## API Docs

Once running: http://localhost:8000/docs
