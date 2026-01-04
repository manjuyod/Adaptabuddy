# Template JSON schema (engine progression/deload)

Minimum keys for program-capable templates:
- `engine_version`: `"1"`
- `template_type`: `"program"` | `"workout"` | `"hypertrophy_engine_v1"`
- `canonical_name`: string, `tags`: string[]
- `pools[]`: `{ pool_key, selection_query{movement_pattern,equipment?,tags?}, fallback_pool_keys[], default_exercise_names[] }`
- `sessions[]`: `{ session_key, focus, label?, slots[] }`
- `slots[]`: `{ slot_key, pool_key, movement_pattern, target_muscles?, tags?, sets?, reps?, rir?, rpe?, optional?, substitution_pool_keys? }`

Progression and deload rules:
- Optional `phases[]`: `{ key, weeks, deload_after?, rules?: WeekRule[] }`
- Optional `week_rules[]`: fallback list of `WeekRule`
- `WeekRule`: `{ week, volume_multiplier?, rpe_floor?, rpe_ceiling?, deload?, note? }`
- Semideload example: `{ week: 5, volume_multiplier: 0.75, rpe_ceiling: 7.5, deload: true, note: "semi-deload" }`

Auto-regulation and adaptation state:
- `active_program_json` now carries:
  - `session_plans[]` with resolved slots and optional `applied_rules[]`
  - `week_rules[]`, `week_cursor` (progressed week index)
  - `performance_cache`: `{ [exercise_key]: { avg_rpe?, avg_rir?, pain?, last_session, samples } }`
  - `decisions_log[]` entries for week rules, auto-regulation, and fatigue flags
  - `pool_preferences` (pins/bans for substitutions) and `weak_point_selection`

Scheduling and determinism:
- Seeds derive from user + template ids; `plan_id` is stored in the snapshot.
- Training days come from `preferred_days` (default Mon/Wed/Fri fallback).
- `week_key` is the start-of-week ISO date for the earliest planned session; schedule keys include week offsets to keep replay deterministic.

Substitutions and constraints:
- Injury/equipment checks happen before pool selection; slots with no valid exercise set `skip_reason`.
- Substitution pools can be passed via `substitution_pool_keys` or appended bans in `pool_preferences` (e.g., pain >= 7 adds a ban for that slot pool).
- Resolved exercises keep `exercise_id` plus denormalized `exercise_name/tags` for history in `training_exercises`.

API helpers:
- `/api/program-engine` POST actions:
  - `generate_schedule` (preview + optional commit to users.active_program_json and planned sessions/exercises/sets)
  - `resolve_slots` (dry-run resolver)
  - `apply_week_rules` (pure adjustment with a `WeekRule` + optional auto-regulation map)
  - `adapt_next_week` (uses recent sets/pain to auto-regulate and inject soft deloads when weekly volume spikes >25% vs prior weeks)
