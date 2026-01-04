# Agent Notes (Adaptabuddy)

- Stack: Next.js 15 (App Router, TS), Tailwind, Supabase (SSR/browser clients), PWA shell. Design system primitives in `components/ui/`.
- Auth: Supabase cookies; protected routes gated by `middleware.ts`. Keep redirects using `resolveNextPath` helpers in `lib/auth/redirect.ts`.

## Wizard (P05)
- UI: `app/(protected)/wizard/page.tsx` (server) + `wizard-client.tsx` (client). Multi-step: constraints -> program mix -> schedule -> preview/generate. Determinism via seed shown in preview.
- Engine helpers: `lib/wizard/engine.ts` (seed derivation, template summaries, preview load calc, schedule builder), `lib/wizard/hypertrophy-engine.ts` (pool/slot resolver + weak-point logic), `lib/wizard/schemas.ts` (zod payload), `lib/wizard/types.ts`.
- API routes: `POST /api/wizard/preview` (dry-run only) and `POST /api/wizard/generate` (persists injuries/preferences/active_program_json, upserts planned `training_sessions`; hypertrophy engine also seeds `training_exercises` + starter sets). Overwrite requires `confirm_overwrite` when an active program exists (route deletes prior plan_id sessions when confirmed).
- Data contract (wizard payload): `user_id`, `injuries[{name,severity,notes?}]`, `fatigue_profile ("low"|"medium"|"high")`, optional `equipment_profile`, `selected_programs[{template_id, weight_override?}]`, `days_per_week (2-5)`, optional `max_session_minutes`, optional `preferred_days`, optional `confirm_overwrite`, optional `pool_preferences[{pool_key,pinned?,banned[]?}]`, optional `weak_point_selection{focus,option1,option2?}`.
- Templates: pulled from `public.templates`; Hypertrophy Engine v1 template_json uses pools/slots/weak_points (template_type `hypertrophy_engine_v1`). Update Supabase typings if schema expands.

## Notifications (P09)
- In-app center: `components/layout/notification-center.tsx` mounted in `app/(protected)/layout.tsx`, calls `GET /api/notifications` for reminders (24h/2h), missed-session warning, restart suggestion, pain trend warning.
- Preferences: stored under `users.preferences.notification_settings` booleans (reminders_24h, reminders_2h, missed_session, reschedule_recommendation, pain_trend, push_opt_in). `GET/POST /api/notifications/preferences` manages them; merge existing preference keys.
- Push scaffolding: `/api/push` stores `push_subscriptions` (upsert/delete). Client helper `lib/pwa/push-client.ts` plus `public/sw.js` handles `push` + `notificationclick`; requires `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Delivery scheduling not built yet.
- Settings UI: `app/(protected)/settings/page.tsx` exposes notification toggles and push subscribe/unsubscribe alongside reschedule/restart controls.

## KPI dashboard (P08)
- UI: `app/(protected)/kpi/page.tsx` (server). Fetches `/api/kpi` and renders lightweight SVG sparklines/lines (no chart lib).
- API: `GET /api/kpi` aggregates last ~12 weeks of `training_sessions`/`training_exercises`/`training_sets` + `muscle_groups`. Returns weekly completion (rate + streaks), pattern tonnage (push/pull/squat/hinge/carry/core), muscle tonnage (primary 60% / secondary split), e1RM trend for S/B/D (best set per week heuristic), DOTS (requires sex/bodyweight + SBD total), fatigue flags (7d volume spike vs prior 4wk avg, RPE rising with stable volume, pain trend delta).
- DOTS status returns `needs_data` when bodyweight or lift totals missing.

## Library
- Exercises page: `app/(protected)/library/exercises` server + `exercise-client.tsx` client search/filters. Uses Supabase RLS reads for `exercises` + `muscle_groups`.

## Training / Sync (P06)
- UI: `app/(protected)/train/page.tsx` (server load) + `train-client.tsx` (client). Shows today/next session with completion toggle, per-set CRUD (reps/weight/RPE/RIR/tempo/rest_seconds/AMRAP/Joker), per-exercise pain score, session/exercise tonnage and e1RM estimates. Offline banner + toasts.
- Offline: `lib/train/offline.ts` IndexedDB cache for session/active_program + append-only event queue. Events: `UPSERT_SET`, `DELETE_SET`, `TOGGLE_EXERCISE`, `UPDATE_PAIN`, `UPDATE_BODYWEIGHT`, `UPDATE_INJURIES` with `local_seq`.
- Sync endpoint: `POST /api/sync` (auth). Writes to `sync_events` idempotently, applies mutations to `training_sets`/`training_exercises`/`users`, advances `users.offline_sync_cursor`, returns authoritative session + bodyweight + injuries.
- Loader/helpers: `lib/train/session-loader.ts` for upcoming session; types in `lib/train/types.ts`. Keep non-ASCII out; preserve deterministic seeds/decisions in wizard flow.

## Supabase types/helpers
- Lightweight manual types live in `lib/supabase/server.ts`; includes users (injuries/preferences/active_program_json), templates, training_sessions, push_subscriptions. Prefer extending here when tables change.
- Admin client lives in `lib/supabase/admin.ts`; browser client in `lib/supabase/browser.ts`.

## Testing
- Vitest config at `vitest.config.ts`. Run `npm run test` or `npm run test:run`.
- Current coverage: wizard schema/engine tests in `tests/wizard/*.test.ts`.
- Add `npm run typecheck` and `npm run lint` before shipping changes to catch TS/ES issues.

## Dockerization / AWS (P10)
- Next.js build must use `output: "standalone"` and expose `/api/health` for health probes.
- Docker: multi-stage build on minimal Node 20 alpine; copy `.next/standalone` + `public`; run as non-root user; healthcheck hits `/api/health`.
- docker-compose: local prod-style run; rely on hosted Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
- AWS: prefer ECS Fargate behind an internet-facing ALB; HTTP -> HTTPS redirect with ACM cert; ALB SG only exposes 80/443, task SG only from ALB.
- Env/secrets: store in Secrets Manager or SSM Parameter Store and wire into the task definition (public config vs server-only keys). Mention WAF as optional; add security headers via ALB (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy; optional CSP).

## DB
- Schema migration: `supabase/migrations/00_schema.sql` (users, exercises, templates, sessions, RLS, push_subscriptions).
- Seeds: `supabase/seed.sql` (muscle groups, exercises, templates). Idempotent; templates used by wizard.

## Conventions / cautions
- Prefer `rg` for search. Keep non-ASCII out unless necessary. Use `apply_patch` for targeted edits.
- Preserve deterministic wizard behavior (seed + decisions_log) and avoid mutating active_program_json without explicit confirmation.
- When updating preferences, merge keys under `users.preferences` (do not drop unrelated settings); notification toggles live in `preferences.notification_settings`.
