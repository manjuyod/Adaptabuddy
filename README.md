# Adaptabuddy

Adaptive training companion scaffold built with Next.js 15 App Router, TypeScript, Tailwind, and Supabase. Mobile-first UI with bottom nav, offline-first logging/sync, and DB-seeded program templates.

## Tech stack
- Next.js 15 (App Router, TypeScript)
- Tailwind CSS with custom brand palette and Space Grotesk font
- Supabase (browser + server clients, cookie sessions, OAuth callback)
- PWA basics (manifest, service worker stub, generated icons/favicons)
- Design system primitives (Button, Card, Input, Toggle, Chip, Toast)
- Postgres library tables: `muscle_groups`, `exercises`, `templates`
- Training data: `training_sessions`, `training_exercises`, `training_sets`
- Sync: event-based `sync_events` for offline-first workflows

## App structure
- `/login`: Supabase email/password + Google OAuth stub
- `/train`, `/wizard`, `/kpi`, `/settings`, `/library/exercises`: mobile-first pages rendered via `app/(app)/` layout with bottom navigation
- Middleware + API callback for Supabase session cookies: `middleware.ts`, `app/api/auth/callback/route.ts`
- PWA wiring: `app/manifest.ts`, `public/sw.js`, `app/providers.tsx`

## Database setup (Supabase)
1) Create a Supabase project (free tier is fine for solo/small-group).
2) Run schema migration SQL (tables + RLS).
3) Run library seed SQL **separately** (muscle groups, exercises, templates). Seed scripts are idempotent.

### Notes
- `muscle_groups.name` is the stable upsert key. Seeds should derive/provide `slug` explicitly.
- Templates are stored in `public.templates.template_json` and copied into `users.active_program_json` when selected (offline-first snapshot).

## Getting started
```bash
npm install
npm run dev
```

Set required environment variables (see `.env.example`):
```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Deployment (AWS Amplify)
This app is designed to deploy cheaply:
1) Push to GitHub
2) Create an AWS Amplify Hosting app connected to the repo
3) Set env vars in Amplify Console
4) Amplify provides HTTPS automatically (no custom domain required)

No load balancer is needed for solo or small-group usage.

## Included starter programs (templates)
- Prime DUP Submax (Sumo Dead)
- 5/3/1 Auto-Regulated DUP
- Post-College Bench Keeper (3x/week)
- 100 Push-Ups Challenge (6-week / 3-group)
- 20 Pull-Ups Challenge (derived in-app from 100-pushups structure)
- 200 Sit-Ups Challenge (derived in-app from 100-pushups structure)

## Changelog
- Initial scaffold: Next.js + Tailwind app with Supabase SSR/browser clients, PWA manifest + service worker stub, design system components, and all required routes/pages.
- Database seeding: muscle groups, exercises, and program templates (idempotent SQL patches).
