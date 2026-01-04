import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isProgramEmpty } from "@/lib/auth/redirect";
import {
  generateSchedule,
  applyWeekRules,
  adaptNextWeek,
  type EngineTemplate,
  type PerformanceSample
} from "@/lib/program/engine";
import { createSupabaseRouteClient, ensureUserProfile, type SupabaseClientType } from "@/lib/supabase/server";
import { deriveSeed } from "@/lib/wizard/engine";
import { normalizeWizardPayload } from "@/lib/wizard/schemas";
import type {
  ActiveProgramSnapshot,
  ProgramPerformanceCache,
  SessionPlan,
  WeekRule
} from "@/lib/wizard/types";

const actionSchema = z.object({
  action: z.enum(["generate_schedule", "resolve_slots", "apply_week_rules", "adapt_next_week"])
});

const weekRuleSchema: z.ZodType<WeekRule> = z.object({
  week: z.number().int().min(1),
  volume_multiplier: z.number().positive().optional(),
  rpe_floor: z.number().min(1).max(10).optional(),
  rpe_ceiling: z.number().min(1).max(10).optional(),
  deload: z.boolean().optional(),
  note: z.string().optional()
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseSessionPlans = (value: unknown): SessionPlan[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const program_session_key =
        typeof entry.program_session_key === "string" ? entry.program_session_key : null;
      const template_id =
        typeof entry.template_id === "number" && Number.isFinite(entry.template_id)
          ? entry.template_id
          : null;
      const focus = typeof entry.focus === "string" ? entry.focus : "Training session";
      const label = typeof entry.label === "string" ? entry.label : "Program session";
      const week_offset =
        typeof entry.week_offset === "number" && Number.isFinite(entry.week_offset)
          ? entry.week_offset
          : 0;
      const slots = Array.isArray(entry.slots)
        ? (entry.slots as unknown[]).map((slot) => {
            if (!isRecord(slot)) return null;
            return {
              slot_key: typeof slot.slot_key === "string" ? slot.slot_key : "slot",
              pool_key: typeof slot.pool_key === "string" ? slot.pool_key : "",
              exercise_id:
                typeof slot.exercise_id === "number" && Number.isFinite(slot.exercise_id)
                  ? slot.exercise_id
                  : null,
              exercise_name:
                typeof slot.exercise_name === "string" ? slot.exercise_name : "exercise",
              movement_pattern:
                typeof slot.movement_pattern === "string" ? slot.movement_pattern : null,
              primary_muscle_group_id:
                typeof slot.primary_muscle_group_id === "number" ? slot.primary_muscle_group_id : null,
              secondary_muscle_group_ids: Array.isArray(slot.secondary_muscle_group_ids)
                ? (slot.secondary_muscle_group_ids as unknown[])
                    .map((id) => (typeof id === "number" ? id : null))
                    .filter((id): id is number => id !== null)
                : [],
              tags: Array.isArray(slot.tags)
                ? slot.tags.filter((tag): tag is string => typeof tag === "string")
                : [],
              sets: typeof slot.sets === "number" ? slot.sets : undefined,
              reps:
                typeof slot.reps === "number" || typeof slot.reps === "string"
                  ? slot.reps
                  : null,
              rir: typeof slot.rir === "number" ? slot.rir : null,
              rpe: typeof slot.rpe === "number" ? slot.rpe : null,
              optional: Boolean(slot.optional),
              skip_reason: typeof slot.skip_reason === "string" ? slot.skip_reason : undefined,
              applied_rules: Array.isArray(slot.applied_rules)
                ? slot.applied_rules.filter((entry): entry is string => typeof entry === "string")
                : undefined
            };
          }).filter(Boolean)
        : [];
      if (!program_session_key || template_id === null) return null;
      return { program_session_key, template_id, focus, label, week_offset, slots };
    })
    .filter(Boolean) as SessionPlan[];
};

const deriveWeekKey = (schedule: { date: string }[], fallback?: string) => {
  if (!schedule.length) return fallback;
  const earliest = schedule.reduce((candidate, session) =>
    session.date < candidate.date ? session : candidate
  );
  const parsed = new Date(`${earliest.date}T00:00:00Z`);
  const weekday = parsed.getUTCDay();
  const diff = (weekday + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - diff);
  return parsed.toISOString().slice(0, 10);
};

const persistSessions = async (
  supabase: SupabaseClientType,
  userId: string,
  schedule: ActiveProgramSnapshot["schedule"],
  planId: string,
  weekKey: string
) => {
  const inserts = schedule.map((session) => ({
    user_id: userId,
    session_date: session.date,
    program_session_key: session.program_session_key,
    plan_id: planId,
    week_key: weekKey,
    status: "planned",
    notes: session.focus
  }));

  return supabase
    .from("training_sessions")
    .upsert(inserts, { onConflict: "user_id,session_date,program_session_key" })
    .select("id, program_session_key");
};

const persistExercisesAndSets = async (
  supabase: SupabaseClientType,
  sessionPlans: SessionPlan[],
  sessionRows: { id: number; program_session_key: string }[]
) => {
  const sessionIdByKey = new Map(sessionRows.map((row) => [row.program_session_key, row.id]));
  const targetSessionIds = Array.from(sessionIdByKey.values());
  if (targetSessionIds.length > 0) {
    await supabase.from("training_exercises").delete().in("session_id", targetSessionIds);
  }

  const exerciseKeyForSlot = (planKey: string, slotKey: string) =>
    `${planKey}_${slotKey}`;

  const exerciseInserts: {
    session_id: number;
    exercise_id: number | null;
    exercise_key: string;
    name: string;
    tags: string[];
    movement_pattern: string | null;
    primary_muscle_group_id: number | null;
    secondary_muscle_group_ids: number[];
    order_index: number;
  }[] = [];

  sessionPlans.forEach((plan) => {
    const sessionId = sessionIdByKey.get(plan.program_session_key);
    if (!sessionId) return;
    plan.slots.forEach((slot, index) => {
      if (slot.skip_reason) return;
      exerciseInserts.push({
        session_id: sessionId,
        exercise_id: slot.exercise_id ?? null,
        exercise_key: exerciseKeyForSlot(plan.program_session_key, slot.slot_key),
        name: slot.exercise_name,
        tags: slot.tags ?? [],
        movement_pattern: slot.movement_pattern ?? null,
        primary_muscle_group_id: slot.primary_muscle_group_id,
        secondary_muscle_group_ids: slot.secondary_muscle_group_ids ?? [],
        order_index: index
      });
    });
  });

  if (exerciseInserts.length === 0) return;

  const { data: insertedExercises, error: exerciseError } = await supabase
    .from("training_exercises")
    .insert(exerciseInserts)
    .select("id, exercise_key");

  if (exerciseError) {
    throw exerciseError;
  }

  const exerciseIdByKey = new Map((insertedExercises ?? []).map((row) => [row.exercise_key, row.id]));
  const setRows: {
    exercise_id: number;
    set_index: number;
    reps?: number | null;
    rpe?: number | null;
    rir?: number | null;
    rest_seconds?: number | null;
  }[] = [];

  sessionPlans.forEach((plan) => {
    plan.slots.forEach((slot) => {
      if (slot.skip_reason || !slot.sets || slot.sets <= 0) return;
      const key = exerciseKeyForSlot(plan.program_session_key, slot.slot_key);
      const exerciseId = exerciseIdByKey.get(key);
      if (!exerciseId) return;
      for (let i = 1; i <= slot.sets; i++) {
        setRows.push({
          exercise_id: exerciseId,
          set_index: i,
          reps: typeof slot.reps === "number" ? slot.reps : null,
          rpe: typeof slot.rpe === "number" ? slot.rpe : null,
          rir: typeof slot.rir === "number" ? slot.rir : null,
          rest_seconds: 90
        });
      }
    });
  });

  if (setRows.length > 0) {
    await supabase.from("training_sets").insert(setRows);
  }
};

const loadPerformanceSamples = async (
  supabase: SupabaseClientType,
  userId: string,
  days: number
): Promise<PerformanceSample[]> => {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  const startIso = start.toISOString().slice(0, 10);
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, session_date, program_session_key, plan_id, status")
    .eq("user_id", userId)
    .gte("session_date", startIso)
    .order("session_date", { ascending: true });

  const sessionIds = (sessions ?? [])
    .map((session) => session.id)
    .filter((id): id is number => typeof id === "number");

  if (sessionIds.length === 0) return [];

  const { data: exercises } = await supabase
    .from("training_exercises")
    .select("id, session_id, exercise_id, exercise_key, name, pain_score")
    .in("session_id", sessionIds);

  const exerciseIds = (exercises ?? [])
    .map((exercise) => exercise.id)
    .filter((id): id is number => typeof id === "number");

  const { data: sets } = exerciseIds.length
    ? await supabase
        .from("training_sets")
        .select("exercise_id, set_index, reps, rpe, rir, weight")
        .in("exercise_id", exerciseIds)
    : { data: [] };

  const sessionById = new Map(
    (sessions ?? []).map((session) => [session.id, session.session_date])
  );
  const setsByExercise = new Map<
    number,
    { rpe?: number | null; rir?: number | null; exercise_id?: number }[]
  >();
  (sets ?? []).forEach((set) => {
    if (typeof set.exercise_id !== "number") return;
    const current = setsByExercise.get(set.exercise_id) ?? [];
    current.push({
      rpe: typeof set.rpe === "number" ? set.rpe : null,
      rir: typeof set.rir === "number" ? set.rir : null,
      exercise_id: set.exercise_id
    });
    setsByExercise.set(set.exercise_id, current);
  });

  const samples: PerformanceSample[] = [];
  (exercises ?? []).forEach((exercise) => {
    if (typeof exercise.id !== "number") return;
    const exerciseSets = setsByExercise.get(exercise.id) ?? [];
    const avg_rpe =
      exerciseSets.length > 0
        ? exerciseSets.reduce((sum, set) => sum + (set.rpe ?? 0), 0) / exerciseSets.length
        : null;
    const avg_rir =
      exerciseSets.length > 0
        ? exerciseSets.reduce((sum, set) => sum + (set.rir ?? 0), 0) / exerciseSets.length
        : null;

    samples.push({
      exercise_key: exercise.exercise_key ?? `${exercise.session_id}_${exercise.id}`,
      avg_rpe,
      avg_rir,
      pain: typeof exercise.pain_score === "number" ? exercise.pain_score : null,
      sets: exerciseSets.length,
      session_date: sessionById.get(exercise.session_id ?? -1) ?? new Date().toISOString().slice(0, 10)
    });
  });

  return samples;
};

export async function POST(request: NextRequest) {
  const response = new NextResponse();
  const supabase: SupabaseClientType = createSupabaseRouteClient(request, response);

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: response.headers });
  }

  const profile = await ensureUserProfile(supabase, authData.user);

  let action: z.infer<typeof actionSchema>["action"];
  let body: unknown;
  try {
    body = await request.json();
    action = actionSchema.parse(body).action;
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid payload", details: error instanceof Error ? error.message : String(error) },
      { status: 400, headers: response.headers }
    );
  }

  if (action === "apply_week_rules") {
    try {
      if (!isRecord(body)) throw new Error("Payload missing");
      const session_plans = parseSessionPlans((body as { session_plans?: unknown }).session_plans);
      const week_rule = weekRuleSchema.parse((body as { week_rule?: unknown }).week_rule);
      const rawAuto = isRecord((body as { auto_regulation?: unknown }).auto_regulation)
        ? ((body as { auto_regulation: Record<string, { rpeDelta?: number; setScale?: number; reason?: string }> }).auto_regulation)
        : undefined;
      const auto_regulation = rawAuto
        ? Object.fromEntries(
            Object.entries(rawAuto).map(([key, value]) => [
              key,
              { ...value, reason: value.reason ?? "manual" }
            ])
          )
        : undefined;
      const adjusted = applyWeekRules({
        sessionPlans: session_plans,
        weekRule: week_rule,
        autoRegulation: auto_regulation
      });
      return NextResponse.json({ session_plans: adjusted }, { headers: response.headers });
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to apply week rules", details: error instanceof Error ? error.message : String(error) },
        { status: 400, headers: response.headers }
      );
    }
  }

  if (action === "generate_schedule" || action === "resolve_slots") {
    let payloadParsed = null;
    let commit = false;
    let startWeekKey: string | undefined;
    try {
      if (!isRecord(body)) {
        throw new Error("Invalid payload");
      }
      payloadParsed = normalizeWizardPayload({
        ...(body.payload ?? body),
        user_id: authData.user.id
      });
      commit = Boolean((body as { commit?: boolean }).commit);
      startWeekKey =
        typeof (body as { start_week_key?: unknown }).start_week_key === "string"
          ? (body as { start_week_key: string }).start_week_key
          : undefined;
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid payload", details: error instanceof Error ? error.message : String(error) },
        { status: 400, headers: response.headers }
      );
    }

    if (action === "generate_schedule" && !payloadParsed.confirm_overwrite && !isProgramEmpty(profile.active_program_json)) {
      return NextResponse.json(
        { error: "Existing program present. Confirm overwrite to proceed." },
        { status: 409, headers: response.headers }
      );
    }

    const templateIds = payloadParsed.selected_programs.map((program) => program.template_id);
    const { data: templates, error: templateError } = await supabase
      .from("templates")
      .select("id, name, disciplines, methodology, template_json")
      .in("id", templateIds);

    if (templateError || !templates || templates.length === 0) {
      return NextResponse.json(
        { error: "Failed to load templates" },
        { status: 500, headers: response.headers }
      );
    }

    const seed = deriveSeed(payloadParsed, templateIds);
    const template = templates[0];

    const { data: muscleGroups, error: muscleError } = await supabase
      .from("muscle_groups")
      .select("id, name, slug, region, parent_id, created_at");
    if (muscleError || !muscleGroups) {
      return NextResponse.json(
        { error: "Failed to load muscle groups" },
        { status: 500, headers: response.headers }
      );
    }

    const { data: exercises, error: exerciseError } = await supabase
      .from("exercises")
      .select(
        "id, canonical_name, aliases, movement_pattern, equipment, is_bodyweight, primary_muscle_group_id, secondary_muscle_group_ids, tags, contraindications, default_warmups, default_warmdowns, media, created_at"
      );

    if (exerciseError || !exercises) {
      return NextResponse.json(
        { error: "Failed to load exercises" },
        { status: 500, headers: response.headers }
      );
    }

    const plan = generateSchedule({
      template: template.template_json as EngineTemplate,
      templateId: template.id,
      exercises,
      muscleGroups,
      payload: payloadParsed,
      seed,
      startWeekKey
    });

    const snapshot: ActiveProgramSnapshot = {
      seed,
      seed_strategy: "static",
      plan_id: plan.planId,
      week_key: plan.weekKey,
      restart_counter: 0,
      generated_at: new Date().toISOString(),
      fatigue_profile: payloadParsed.fatigue_profile,
      equipment_profile: payloadParsed.equipment_profile ?? [],
      days_per_week: payloadParsed.days_per_week,
      max_session_minutes: payloadParsed.max_session_minutes,
      preferred_days: payloadParsed.preferred_days ?? [],
      injuries: payloadParsed.injuries,
      selected_programs: payloadParsed.selected_programs,
      schedule: plan.schedule,
      decisions_log: [
        `Program engine schedule generated (${plan.schedule.length} sessions)`,
        ...plan.decisions
      ],
      preview: {
        seed,
        weeklySets: plan.preview.weeklySets,
        recoveryLoad: plan.preview.recoveryLoad,
        warnings: [],
        removedSlots: plan.preview.removedSlots
      },
      pool_preferences: payloadParsed.pool_preferences ?? [],
      week_rules: plan.weekRules,
      week_cursor: 0,
      performance_cache: {} as ProgramPerformanceCache,
      weak_point_selection: payloadParsed.weak_point_selection ?? null,
      session_plans: plan.sessionPlans
    };

    if (commit) {
      const previousPlanId =
        isRecord(profile.active_program_json) &&
        typeof (profile.active_program_json as { plan_id?: unknown }).plan_id === "string"
          ? ((profile.active_program_json as { plan_id: string }).plan_id)
          : null;
      if (payloadParsed.confirm_overwrite && previousPlanId) {
        await supabase
          .from("training_sessions")
          .delete()
          .eq("user_id", authData.user.id)
          .eq("plan_id", previousPlanId);
      }

      const basePreferences = isRecord(profile.preferences) ? profile.preferences : {};
      const updatedPreferences = {
        ...basePreferences,
        fatigue_profile: payloadParsed.fatigue_profile,
        equipment_profile:
          payloadParsed.equipment_profile ??
          (basePreferences as { equipment_profile?: unknown }).equipment_profile,
        preferred_days:
          payloadParsed.preferred_days ??
          (basePreferences as { preferred_days?: unknown }).preferred_days,
        max_session_minutes:
          payloadParsed.max_session_minutes ??
          (basePreferences as { max_session_minutes?: unknown }).max_session_minutes,
        days_per_week: payloadParsed.days_per_week,
        pool_preferences:
          payloadParsed.pool_preferences ??
          (basePreferences as { pool_preferences?: unknown }).pool_preferences,
        weak_point_selection:
          payloadParsed.weak_point_selection ??
          (basePreferences as { weak_point_selection?: unknown }).weak_point_selection
      };

      const { error: updateError } = await supabase
        .from("users")
        .update({
          injuries: payloadParsed.injuries,
          preferences: updatedPreferences,
          active_program_json: snapshot
        })
        .eq("user_id", authData.user.id);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to save active program" },
          { status: 500, headers: response.headers }
        );
      }

      if (Array.isArray(plan.schedule) && plan.schedule.length > 0) {
        const { data: sessionRows, error: sessionError } = await persistSessions(
          supabase,
          authData.user.id,
          plan.schedule,
          snapshot.plan_id,
          snapshot.week_key
        );

        if (sessionError) {
          return NextResponse.json(
            { error: "Program saved but sessions could not be planned." },
            { status: 500, headers: response.headers }
          );
        }

          if (sessionRows && plan.sessionPlans.length > 0) {
            try {
              await persistExercisesAndSets(supabase, plan.sessionPlans, sessionRows);
            } catch (error) {
              void error;
              return NextResponse.json(
                { error: "Program saved but exercises could not be seeded." },
                { status: 500, headers: response.headers }
              );
            }
          }
      }
    }

    return NextResponse.json(
      {
        preview: plan.preview,
        schedule: plan.schedule,
        active_program: snapshot
      },
      { headers: response.headers }
    );
  }

  if (action === "adapt_next_week") {
    if (!isRecord(profile.active_program_json)) {
      return NextResponse.json(
        { error: "No active program to adapt." },
        { status: 409, headers: response.headers }
      );
    }
    const activeProgram = profile.active_program_json as ActiveProgramSnapshot;
    const templateId = activeProgram.selected_programs?.[0]?.template_id;
    if (!templateId) {
      return NextResponse.json(
        { error: "Active program missing template." },
        { status: 400, headers: response.headers }
      );
    }

    const { data: templateRow, error: templateError } = await supabase
      .from("templates")
      .select("id, template_json")
      .eq("id", templateId)
      .maybeSingle();

    if (templateError || !templateRow) {
      return NextResponse.json(
        { error: "Failed to load template for adaptation." },
        { status: 500, headers: response.headers }
      );
    }

    const { data: muscleGroups, error: muscleError } = await supabase
      .from("muscle_groups")
      .select("id, name, slug, region, parent_id, created_at");
    if (muscleError || !muscleGroups) {
      return NextResponse.json(
        { error: "Failed to load muscle groups" },
        { status: 500, headers: response.headers }
      );
    }

    const { data: exercises, error: exerciseError } = await supabase
      .from("exercises")
      .select(
        "id, canonical_name, aliases, movement_pattern, equipment, is_bodyweight, primary_muscle_group_id, secondary_muscle_group_ids, tags, contraindications, default_warmups, default_warmdowns, media, created_at"
      );

    if (exerciseError || !exercises) {
      return NextResponse.json(
        { error: "Failed to load exercises" },
        { status: 500, headers: response.headers }
      );
    }

    const performance = await loadPerformanceSamples(supabase, authData.user.id, 28);
    const fatigueHistory = performance.reduce<Record<string, number>>((acc, sample) => {
      const [year, month, day] = sample.session_date.split("-").map((part) => Number.parseInt(part, 10));
      const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
      const weekKey = new Date(date);
      weekKey.setUTCDate(weekKey.getUTCDate() - ((weekKey.getUTCDay() + 6) % 7));
      const iso = weekKey.toISOString().slice(0, 10);
      acc[iso] = (acc[iso] ?? 0) + sample.sets;
      return acc;
    }, {});
    const fatigueHistoryArr = Object.entries(fatigueHistory).map(([week, sets]) => ({ week, sets }));

    const adaptation = adaptNextWeek({
      activeProgram,
      template: templateRow.template_json as EngineTemplate,
      templateId: templateRow.id,
      performance,
      fatigueHistory: fatigueHistoryArr,
      payload: {
        days_per_week: activeProgram.days_per_week,
        fatigue_profile: activeProgram.fatigue_profile,
        preferred_days: activeProgram.preferred_days,
        equipment_profile: activeProgram.equipment_profile,
        pool_preferences: activeProgram.pool_preferences,
        max_session_minutes: activeProgram.max_session_minutes,
        injuries: activeProgram.injuries ?? [],
        weak_point_selection: activeProgram.weak_point_selection
      },
      exercises,
      muscleGroups,
      seed: activeProgram.seed
    });

    const updatedProgram: ActiveProgramSnapshot = {
      ...activeProgram,
      week_cursor: (activeProgram.week_cursor ?? 0) + 1,
      week_rules: [...(activeProgram.week_rules ?? []), adaptation.nextWeekRule],
      performance_cache: adaptation.performanceCache,
      pool_preferences: adaptation.substitutions.length
        ? [...(activeProgram.pool_preferences ?? []), ...adaptation.substitutions]
        : activeProgram.pool_preferences,
      week_key: deriveWeekKey(adaptation.schedule, activeProgram.week_key) ?? activeProgram.week_key,
      schedule: adaptation.schedule,
      session_plans: adaptation.sessionPlans,
      decisions_log: [...(activeProgram.decisions_log ?? []), ...adaptation.decisions]
    };

    const commit = isRecord(body) ? Boolean((body as { commit?: boolean }).commit) : false;

    if (commit) {
      await supabase
        .from("users")
        .update({ active_program_json: updatedProgram })
        .eq("user_id", authData.user.id);
      const { data: sessionRows, error: sessionError } = await persistSessions(
        supabase,
        authData.user.id,
        adaptation.schedule,
        updatedProgram.plan_id,
        updatedProgram.week_key
      );
      if (sessionError) {
        return NextResponse.json(
          { error: "Adaptation saved but sessions could not be planned." },
          { status: 500, headers: response.headers }
        );
      }
      if (sessionRows) {
        await persistExercisesAndSets(supabase, adaptation.sessionPlans, sessionRows);
      }
    }

    return NextResponse.json(
      {
        active_program: updatedProgram,
        auto_regulation: adaptation.autoRegulation,
        fatigue_deload: adaptation.nextWeekRule.deload ?? false
      },
      { headers: response.headers }
    );
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400, headers: response.headers });
}
