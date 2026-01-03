# Agent Notes (Adaptabuddy)

- Stack: Next.js 15 (App Router, TS), Tailwind, Supabase (SSR/browser clients), PWA shell. Design system primitives in `components/ui/`.
- Auth: Supabase cookies; protected routes gated by `middleware.ts`. Keep redirects using `resolveNextPath` helpers in `lib/auth/redirect.ts`.

## Wizard (P05)
- UI: `app/(protected)/wizard/page.tsx` (server) + `wizard-client.tsx` (client). Multi-step: constraints → program mix → schedule → preview/generate. Determinism via seed shown in preview.
- Engine helpers: `lib/wizard/engine.ts` (seed derivation, template summaries, preview load calc, schedule builder), `lib/wizard/schemas.ts` (zod payload), `lib/wizard/types.ts`.
- API routes: `POST /api/wizard/preview` (dry-run only) and `POST /api/wizard/generate` (persists injuries/preferences/active_program_json + upserts planned `training_sessions`). Overwrite requires `confirm_overwrite` when an active program exists.
- Data contract (wizard payload): `user_id`, `injuries[{name,severity,notes?}]`, `fatigue_profile ("low"|"medium"|"high")`, optional `equipment_profile`, `selected_programs[{template_id, weight_override?}]`, `days_per_week (2-5)`, optional `max_session_minutes`, optional `preferred_days`, optional `confirm_overwrite`.
- Templates: pulled from `public.templates` where `template_json.template_type` == "program" (currently summarized heuristically). Update Supabase typings if schema expands.

## Library
- Exercises page: `app/(protected)/library/exercises` server + `exercise-client.tsx` client search/filters. Uses Supabase RLS reads for `exercises` + `muscle_groups`.

## Training / Sync (P06)
- UI: `app/(protected)/train/page.tsx` (server load) + `train-client.tsx` (client). Shows today/next session with completion toggle, per-set CRUD (reps/weight/RPE/RIR/tempo/rest_seconds/AMRAP/Joker), per-exercise pain score, session/exercise tonnage and e1RM estimates. Offline banner + toasts.
- Offline: `lib/train/offline.ts` IndexedDB cache for session/active_program + append-only event queue. Events: `UPSERT_SET`, `DELETE_SET`, `TOGGLE_EXERCISE`, `UPDATE_PAIN`, `UPDATE_BODYWEIGHT`, `UPDATE_INJURIES` with `local_seq`.
- Sync endpoint: `POST /api/sync` (auth). Writes to `sync_events` idempotently, applies mutations to `training_sets`/`training_exercises`/`users`, advances `users.offline_sync_cursor`, returns authoritative session + bodyweight + injuries.
- Loader/helpers: `lib/train/session-loader.ts` for upcoming session; types in `lib/train/types.ts`. Keep non-ASCII out; preserve deterministic seeds/decisions in wizard flow.

## Supabase types/helpers
- Lightweight manual types live in `lib/supabase/server.ts`; includes users (injuries/preferences/active_program_json), templates, training_sessions. Prefer extending here when tables change.
- Admin client lives in `lib/supabase/admin.ts`; browser client in `lib/supabase/browser.ts`.

## Testing
- Vitest config at `vitest.config.ts`. Run `npm run test` or `npm run test:run`.
- Current coverage: wizard schema/engine tests in `tests/wizard/*.test.ts`.
- Add `npm run typecheck` and `npm run lint` before shipping changes to catch TS/ES issues.

## DB
- Schema migration: `supabase/migrations/00_schema.sql` (users, exercises, templates, sessions, RLS).
- Seeds: `supabase/seed.sql` (muscle groups, exercises, templates). Idempotent; templates used by wizard.

## Conventions / cautions
- Prefer `rg` for search. Keep non-ASCII out unless necessary. Use `apply_patch` for targeted edits.
- Preserve deterministic wizard behavior (seed + decisions_log) and avoid mutating active_program_json without explicit confirmation.
