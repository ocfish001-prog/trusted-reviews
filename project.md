# Trusted Reviews Network

> Semi-closed, invite-only reviews platform — see recommendations from people you trust.

## Current Phase: 🔄 Phase 1 — Sprint 1 MVP (Backend deploy blocked on Railway token)

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 | ✅ Complete | Planning — PRD review, architecture decisions |
| Phase 1 | 🔄 In Progress | Foundation + Core — all code done, frontend deployed, backend pending Railway |
| Phase 2 | ⏳ Pending | Polish — UI refinement, testing, Lighthouse |
| Phase 3 | ⏳ Pending | Deploy verification — smoke tests, end-to-end |

## Tech Stack
- Frontend: Next.js 15 + TypeScript + Tailwind CSS → Netlify ✅
- Backend: FastAPI (Python) + asyncpg + JWT auth → Railway (pending)
- Database: Railway Postgres (pending)
- AI: Anthropic Claude API (review polish)
- Auth: JWT via python-jose + bcrypt via passlib (NO Supabase)

## Sprint 1 Deliverables
- [x] PRD review
- [x] Architecture planning
- [x] FastAPI backend with all API routes (6 routers)
- [x] Database schema with indexes (Railway Postgres compatible)
- [x] JWT auth (signup + login, bcrypt password hashing)
- [x] Next.js frontend with all 8 pages, 23 components
- [x] Auth (invite-only signup, login)
- [x] Trust-scoped feed with filters
- [x] Review writing with AI polish (Polish/Structure/Add Detail)
- [x] Business pages with network stats
- [x] User profiles with reviews
- [x] Invite management (generate, list, copy link)
- [x] Frontend deployed to Netlify
- [x] GitHub repo created and pushed (private)
- [x] Supabase fully removed — migrated to Railway Postgres + JWT
- [ ] Railway project created + Postgres provisioned
- [ ] Backend deployed to Railway
- [ ] Schema applied to Railway Postgres
- [ ] Frontend env updated with Railway backend URL

## Live URLs
- **Frontend:** https://trusted-reviews-app.netlify.app
- **Backend:** Pending Railway deploy
- **GitHub:** https://github.com/ocfish001-prog/trusted-reviews (private)

## ⚠️ BLOCKER: Railway Token
Token `a201f84a-fc18-4310-a2d7-b4bfcdc81868` returns "Not Authorized" from Railway GraphQL API.
Both `RAILWAY_TOKEN` env var and direct API calls fail.
Need Big Poppa to generate a new token from Railway dashboard:
1. Go to https://railway.com/account/tokens
2. Create a new API token
3. Share the token — Santiago will complete deploy immediately
