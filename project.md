# Trusted Reviews Network

> Semi-closed, invite-only reviews platform — see recommendations from people you trust.

## Current Phase: 🔄 Phase 1 — Sprint 1 MVP (Deploy pending backend)

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 | ✅ Complete | Planning — PRD review, architecture decisions |
| Phase 1 | 🔄 In Progress | Foundation — scaffolding, DB, auth, all core pages + API |
| Phase 2 | ⏳ Pending | Polish — UI refinement, testing, Lighthouse |
| Phase 3 | ⏳ Pending | Deploy — Netlify + Railway, smoke test |

## Tech Stack
- Frontend: Next.js 15 + TypeScript + Tailwind CSS → Netlify
- Backend: FastAPI (Python) → Railway
- Database: Supabase (Postgres + Auth + RLS + Storage)
- AI: Anthropic Claude API (review polish)

## Sprint 1 Deliverables
- [x] PRD review
- [x] Architecture planning
- [x] FastAPI backend with all API routes (6 routers)
- [x] Supabase DB schema + RLS policies + 2-hop trust function
- [x] Next.js frontend with all 8 pages
- [x] Auth (invite-only signup, login, magic link)
- [x] Trust-scoped feed with filters
- [x] Review writing with AI polish (Polish/Structure/Add Detail)
- [x] Business pages with network stats
- [x] User profiles with reviews
- [x] Invite management (generate, list, copy link)
- [x] Frontend deployed to Netlify
- [x] GitHub repo created (private)
- [ ] Backend deployed to Railway (token expired)
- [ ] Supabase schema applied

## Live URLs
- **Frontend:** https://trusted-reviews-app.netlify.app
- **Backend:** Pending Railway deploy (token needs refresh)
- **GitHub:** https://github.com/ocfish001-prog/trusted-reviews (private)

## Blockers
- Railway API token expired — needs Big Poppa to generate a new one
- Supabase schema needs to be applied via dashboard or CLI
