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
- Wizard: constraint-aware program builder (injuries, fatigue, equipment, template mix, days/time) with deterministic preview/generate handlers
- Training: offline-first `/train` page with per-set logging, pain/bodyweight capture, and batched sync

## App structure
- `/login`: Supabase email/password + Google OAuth stub
- `/train`, `/wizard`, `/kpi`, `/settings`, `/library/exercises`: mobile-first pages rendered via `app/(app)/` layout with bottom navigation
- Middleware + auth callback for Supabase session cookies: `middleware.ts`, `app/auth/callback/route.ts`
- PWA wiring: `app/manifest.ts`, `public/sw.js`, `app/providers.tsx`
- Wizard UI: `app/(protected)/wizard/page.tsx` (server data) + `wizard-client.tsx` (multi-step client)

### Exercise library (`/library/exercises`)
- Server component loads `exercises` + `muscle_groups` from Supabase using authenticated select (RLS enforced).
- Client UI supports: search by name/alias, filter by movement pattern, equipment, muscle group, and tags.
- Tapping a card opens a details drawer showing canonical name, aliases, movement pattern, equipment, primary/secondary muscles, contraindications (body parts with replace/avoid thresholds), warmups/warmdowns, and media placeholders.
- Read-only: no mutations are issued from this page.

### Training (`/train`)
- Server loads today/next planned session (`training_sessions` + nested exercises/sets) and passes to client.
- Client UI supports toggling exercise completion, per-set add/edit/delete (reps/weight/RPE/RIR/tempo/rest_seconds/AMRAP/Joker), per-exercise pain score, and derived tonnage/e1RM display.
- Offline-first: IndexedDB caches session + active program and appends events (`UPSERT_SET`, `DELETE_SET`, `TOGGLE_EXERCISE`, `UPDATE_PAIN`, `UPDATE_BODYWEIGHT`, `UPDATE_INJURIES`) with local sequence numbers.
- Sync: `/api/sync` batches queued events, writes to `sync_events` idempotently, applies mutations inside RLS, advances `users.offline_sync_cursor`, and returns the authoritative session/bodyweight/injuries; UI surfaces offline indicator and sync toasts.

## Database setup (Supabase)
1) Create a Supabase project (free tier is fine for solo/small-group).
2) Run schema migration SQL (tables + RLS).
3) Run library seed SQL **separately** (muscle groups, exercises, templates). Seed scripts are idempotent.

### Notes
- `muscle_groups.name` is the stable upsert key. Seeds should derive/provide `slug` explicitly.
- Templates are stored in `public.templates.template_json` and copied into `users.active_program_json` when selected (offline-first snapshot).

## Program Builder Wizard (P05)
- Endpoint contracts:
  - Preview: `POST /api/wizard/preview` -> `{seed, weeklySets, recoveryLoad, warnings, removedSlots}`
  - Generate: `POST /api/wizard/generate` (requires `confirm_overwrite` when an active program exists) -> persists `users.injuries`, `users.preferences` (fatigue/equipment/days), `users.active_program_json`, and upserts `training_sessions`.
- Payload schema (zod-backed, see `lib/wizard/schemas.ts`):
  - `user_id`, `injuries[{name,severity}]`, `fatigue_profile`, optional `equipment_profile`, `selected_programs[{template_id, weight_override?}]`, `days_per_week` (2–5), optional `max_session_minutes`, optional `preferred_days`, `confirm_overwrite`.
- Determinism: preview/generate share `seed` derived from user + selected templates; snapshot stores `decisions_log` and schedule for reproducibility.

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
- Program Builder Wizard v2: multi-step UI, deterministic preview/generate API routes, zod schemas, and engine helpers with minimal Vitest coverage.
