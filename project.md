# Trusted Reviews Network

> Semi-closed, invite-only reviews platform — see recommendations from people you trust.

## Current Phase: 🔄 Phase 1 — Foundation + Core Features (Sprint 1 MVP)

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
- [ ] FastAPI backend with all API routes
- [ ] Supabase DB schema + RLS policies
- [ ] Next.js frontend with all pages
- [ ] Auth (invite-only signup, login, magic link)
- [ ] Trust-scoped feed
- [ ] Review writing with AI polish
- [ ] Business pages
- [ ] User profiles
- [ ] Invite management
- [ ] Deploy to Netlify + Railway

## Known Issues
- secrets.json path needs sandbox escape for Railway token
