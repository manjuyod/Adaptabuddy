# Adaptabuddy

Adaptive training companion scaffold built with Next.js 15 App Router, TypeScript, Tailwind, and Supabase. Mobile-first UI with bottom nav, offline-first logging/sync, and DB-seeded program templates.

## Tech stack
- Next.js 15 (App Router, TypeScript)
- Tailwind CSS with custom brand palette and Space Grotesk font
- Supabase (browser + server clients, cookie sessions, OAuth callback)
- PWA basics (manifest, service worker with push handler, generated icons/favicons)
- Design system primitives (Button, Card, Input, Toggle, Chip, Toast)
- Postgres library tables: `muscle_groups`, `exercises`, `templates`
- Training data: `training_sessions`, `training_exercises`, `training_sets`
- Sync: event-based `sync_events` for offline-first workflows
- Wizard: constraint-aware program builder (injuries, fatigue, equipment, template mix, days/time) with deterministic preview/generate handlers, seeded Program Mixing Engine v1 (normalized templates + recovery budgeting/constraint scoring), and a pool-based Hypertrophy Engine v1 (weak-point aware)
- Program engine: progression/deload + auto-regulation/adaptation pipeline (week rules, substitutions, fatigue/pain flags) exposed via `/api/program-engine`
- Training: offline-first `/train` page with per-set logging, pain/bodyweight capture, and batched sync
- KPI: `/kpi` dashboard with server-aggregated completion, streaks, tonnage, e1RM trend, DOTS, and fatigue flags
- Notifications: in-app notification center with reminder/missed/pain trend signals; push subscription scaffolding
- Start menu: `/home` landing after auth with primary actions (Start/Continue/Stats/Settings) and current run card showing plan, week, and next session state

## App structure
- `/login`: Supabase email/password + Google OAuth stub
- `/home`: post-auth start menu; Continue disables when no active program and shows plan/week/next session when present
- `/train`, `/wizard`, `/kpi`, `/settings`, `/library/exercises`: mobile-first pages rendered via protected layout with bottom navigation
- In-app notification center is mounted in the protected layout and pulls `/api/notifications`
- Middleware + auth callback for Supabase session cookies: `middleware.ts`, `app/auth/callback/route.ts`
- PWA wiring: `app/manifest.ts`, `public/sw.js`, `app/providers.tsx`
- Wizard UI: `app/(protected)/wizard/page.tsx` (server data) + `wizard-client.tsx` (multi-step client)

### Start menu (`/home`)
- Server component reads `active_program_json`, `preferences`, and `save_meta_json` to build a run summary (plan names, inferred week, next planned session date/label, last activity/completion).
- Action tiles route to Wizard/Train/KPI/Settings; Continue button is disabled when no active program exists.
- Reusable run card lives in `components/home/current-run-card.tsx`.

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

### KPI dashboard (`/kpi`)
- Server component fetches `/api/kpi` (auth) and renders lightweight SVG sparklines/lines (no chart lib).
- Aggregates last ~12 weeks of sessions/exercises/sets into: weekly completion rate, current/longest streak, tonnage by movement pattern (push/pull/squat/hinge/carry/core), tonnage by muscle group (primary 60% share, secondary split), e1RM trend for S/B/D (best set per week), DOTS (needs bodyweight + S/B/D totals), and fatigue proxies (7d volume spike vs prior 4wk avg, rising RPE with stable volume, pain trend delta).
- Displays flags when volume spikes, RPE drifts upward without more volume, or pain trend worsens; otherwise marks status as stable.

### Notifications & Settings
- In-app notification center lives in the protected layout and calls `GET /api/notifications` to surface session reminders (24h/2h), missed session warnings, reschedule/restart suggestions, and pain trend alerts.
- Notification preferences are stored in `users.preferences.notification_settings`; `GET/POST /api/notifications/preferences` reads/writes booleans for each signal and `push_opt_in` while merging other preference keys.
- Settings page exposes those toggles plus web push subscribe/unsubscribe. Push subscriptions are saved via `/api/push` into `push_subscriptions`; the service worker (`public/sw.js`) handles `push` and `notificationclick` events. Push delivery scheduling is intentionally out of scope for now.
- Optional env var `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is required to enable browser push subscriptions.

## Database setup (Supabase)
1) Create a Supabase project (free tier is fine for solo/small-group).
2) Run schema migration SQL (tables + RLS) in order: `supabase/migrations/00_schema.sql`, then `01_add_save_meta_json.sql`, then `02_template_normalization.sql` (adds GIN index + normalized program templates).
3) Run library seed SQL **separately** (muscle groups, exercises, templates). Seed scripts are idempotent; normalized fixture lives in `supabase/templates.normalized.json`.

### Notes
- `muscle_groups.name` is the stable upsert key. Seeds should derive/provide `slug` explicitly.
- Templates are stored in `public.templates.template_json` and copied into `users.active_program_json` when selected (offline-first snapshot). Save state metadata can live in `users.save_meta_json` (`plan_started_at`, `last_activity_at`, `last_completed_session_at`). Normalized examples live in `supabase/templates.normalized.json`; CI drift guard in `tests/template-normalization.test.ts`.
- Push subscriptions persist raw JSON blobs per user in `public.push_subscriptions` (unique per user_id); service worker push handler lives in `public/sw.js`.
- Template JSON progression/deload/auto-regulation fields are documented in `docs/template-json-schema.md`.

## Program Builder Wizard (P05)
- Endpoint contracts:
  - Preview: `POST /api/wizard/preview` -> `{seed, weeklySets, recoveryLoad, warnings, removedSlots}`
  - Generate: `POST /api/wizard/generate` (requires `confirm_overwrite` when an active program exists) -> persists `users.injuries`, `users.preferences` (fatigue/equipment/days/pool + weak-point choices), `users.active_program_json`, and upserts `training_sessions` (Hypertrophy Engine also seeds `training_exercises` + starter sets). Overwrite deletes prior plan_id sessions when confirmed.
- Payload schema (zod-backed, see `lib/wizard/schemas.ts`):
  - `user_id`, `injuries[{name,severity}]`, `fatigue_profile`, optional `equipment_profile`, `selected_programs[{template_id, weight_override?}]`, `days_per_week` (2-5), optional `max_session_minutes`, optional `preferred_days`, `confirm_overwrite`, optional `pool_preferences[{pool_key,pinned?,banned[]?}]`, optional `weak_point_selection{focus,option1,option2?}`.
- Determinism: preview/generate share `seed` derived from user + selected templates; snapshot stores `decisions_log`, schedule, and session_plans (Hypertrophy Engine or Mixing Engine) for reproducibility.
- UI: lets users pin/ban exercises per pool, choose equipment availability, and pick weak-point focus (optional second exercise is auto-skipped when not recovered).

## Program Engine (P12)
- Endpoint: `POST /api/program-engine` with actions:
  - `generate_schedule` / `resolve_slots` (deterministic week/phase schedule with week rules and session_plans stored in `active_program_json`; optional commit seeds sessions/exercises/sets)
  - `apply_week_rules` (pure deload/progression adjustment and auto-regulation)
  - `adapt_next_week` (uses recent RPE/RIR/pain to auto-regulate and insert soft deload when volume spikes)
- Engine state is documented in `docs/template-json-schema.md` (week rules, performance cache, substitutions, applied_rules on slots).

## Getting started
```bash
npm install
npm run dev
```

Set required environment variables (see `.env.example`):
```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key # required for browser push subscription
```

## Docker
- Build: `docker build -t adaptabuddy:local .`
- Local production run: `docker compose up --build`
- Env: reuse hosted Supabase keys in `.env` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
- Health check: `http://localhost:3000/api/health` (used by container and ALB probes)

## Deployment (AWS Amplify - simple)
This app can deploy cheaply:
1) Push to GitHub
2) Create an AWS Amplify Hosting app connected to the repo
3) Set env vars in Amplify Console
4) Amplify provides HTTPS automatically (no custom domain required)

No load balancer is needed for solo or small-group usage.

## Containerized deployment (AWS ECS)
See `DEPLOYMENT_AWS_ECS.md` for a step-by-step Fargate + ALB + HTTPS guide with Secrets Manager/SSM-backed env vars, HTTP→HTTPS redirect, security headers, and optional WAF.

## Included starter programs (templates)
- DUP Powerlifting (normalized program template)
- RP Hypertrophy (normalized program template)
- Calisthenics Progression (normalized program template)
- Prime DUP Submax (Sumo Dead)
- 5/3/1 Auto-Regulated DUP
- Hypertrophy Engine v1 (pool-based Jeff Nippard-inspired full-body)

## Changelog
- Initial scaffold: Next.js + Tailwind app with Supabase SSR/browser clients, PWA manifest + service worker stub, design system components, and all required routes/pages.
- Database seeding: muscle groups, exercises, and program templates (idempotent SQL patches).
- Program Builder Wizard v2: multi-step UI, deterministic preview/generate API routes, zod schemas, and engine helpers with minimal Vitest coverage.
- KPI dashboard: `/kpi` server-rendered page + `/api/kpi` aggregation for completion, tonnage (pattern/muscle), e1RM trend, DOTS, and fatigue flags.
- Notifications phase 1: in-app center pulling `/api/notifications`, settings toggles stored in `preferences.notification_settings`, push subscription scaffolding via `/api/push` + service worker `push` handler.
- Hypertrophy Engine v1: pool-based resolver with weak-point selection, pins/bans, and 4-week session/exercise seeding (template `Hypertrophy Engine v1` in seeds).
- Program Engine v1: week/phase rules + deload/auto-regulation/substitution/adaptation hooks with `/api/program-engine` actions and expanded snapshot metadata (`week_rules`, `performance_cache`, `session_plans` with applied_rules).
- Start Menu (/home): default post-auth landing with Start/Continue/Stats/Settings buttons, current run card, and save-state metadata persisted to `users.save_meta_json`.
- Program Mixing Engine v1 + Template Normalization: normalized program templates (per `agents_prompts/template_templatejson_example`), mixing engine with recovery budgeting/constraints/scoring (`lib/wizard/program-mixing-engine.ts`), normalization helpers/validation (`lib/wizard/template-normalization.ts`, `tests/template-normalization.test.ts`), and migration `02_template_normalization.sql` with `supabase/templates.normalized.json`.
