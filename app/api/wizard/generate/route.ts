import { NextResponse, type NextRequest } from "next/server";
import { isProgramEmpty } from "@/lib/auth/redirect";
import {
  createSupabaseRouteClient,
  ensureUserProfile,
  type SupabaseClientType
} from "@/lib/supabase/server";
import { buildActiveProgramSnapshot, deriveSeed } from "@/lib/wizard/engine";
import {
  buildHypertrophyPlan,
  composeHypertrophySnapshot,
  isHypertrophyTemplate
} from "@/lib/wizard/hypertrophy-engine";
import {
  composeMixingSnapshot,
  generatePlan as generateMixingPlan,
  normalizeProgramTemplates
} from "@/lib/wizard/program-mixing-engine";
import { normalizeWizardPayload } from "@/lib/wizard/schemas";
import type { SessionPlan } from "@/lib/wizard/types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export async function POST(request: NextRequest) {
  const response = new NextResponse();
  const supabase: SupabaseClientType = createSupabaseRouteClient(request, response);

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: response.headers }
    );
  }

  const profile = await ensureUserProfile(supabase, authData.user);

  let payload = null;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      throw new Error("Invalid payload");
    }
    payload = normalizeWizardPayload({
      ...body,
      user_id: authData.user.id
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid payload", details: (error as Error).message },
      { status: 400, headers: response.headers }
    );
  }

  if (!payload.confirm_overwrite && !isProgramEmpty(profile.active_program_json)) {
    return NextResponse.json(
      { error: "Existing program present. Confirm overwrite to proceed." },
      { status: 409, headers: response.headers }
    );
  }

  const templateIds = payload.selected_programs.map((program) => program.template_id);
  const { data: templates, error: templateError } = await supabase
    .from("templates")
    .select("id, name, disciplines, methodology, template_json")
    .in("id", templateIds);

  if (templateError) {
    return NextResponse.json(
      { error: "Failed to load templates" },
      { status: 500, headers: response.headers }
    );
  }

  if (!templates || templates.length === 0) {
    return NextResponse.json(
      { error: "No matching templates found." },
      { status: 404, headers: response.headers }
    );
  }

  const seed = deriveSeed(payload, templateIds);
  const hypertrophyTemplate =
    templates.length === 1 && isHypertrophyTemplate(templates[0].template_json)
      ? (templates[0].template_json)
      : null;
  const normalizedPrograms = normalizeProgramTemplates(templates ?? []);
  const isMixingPlan =
    normalizedPrograms.length > 0 && normalizedPrograms.length === (templates?.length ?? 0);

  let preview = null;
  let schedule = null;
  let snapshot = null;
  let sessionPlans: SessionPlan[] | null = null;

  if (hypertrophyTemplate) {
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

    const plan = buildHypertrophyPlan({
      template: hypertrophyTemplate,
      templateId: templates[0].id,
      exercises,
      muscleGroups,
      payload: {
        days_per_week: payload.days_per_week,
        fatigue_profile: payload.fatigue_profile,
        max_session_minutes: payload.max_session_minutes,
        preferred_days: payload.preferred_days,
        equipment_profile: payload.equipment_profile,
        pool_preferences: payload.pool_preferences,
        weak_point_selection: payload.weak_point_selection
      },
      injuries: payload.injuries,
      seed
    });
    preview = plan.preview;
    schedule = plan.schedule;
    sessionPlans = plan.sessionPlans;
    snapshot = composeHypertrophySnapshot({
      payload,
      seed,
      planId: plan.planId,
      weekKey: plan.weekKey,
      schedule: plan.schedule,
      preview: plan.preview,
      sessionPlans: plan.sessionPlans
    });
  } else if (isMixingPlan) {
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

    const plan = generateMixingPlan({
      payload,
      templates: normalizedPrograms,
      exercises,
      muscleGroups
    });

    preview = plan.preview;
    schedule = plan.schedule;
    sessionPlans = plan.sessionPlans;
    snapshot = composeMixingSnapshot({
      payload,
      plan
    });
  } else {
    const built = buildActiveProgramSnapshot(payload, templates);
    preview = built.preview;
    schedule = built.schedule;
    snapshot = built.snapshot;
  }

  const existingPreferences = isRecord(profile.preferences) ? profile.preferences : {};
  const updatedPreferences = {
    ...existingPreferences,
    fatigue_profile: payload.fatigue_profile,
    equipment_profile: payload.equipment_profile ?? existingPreferences.equipment_profile,
    preferred_days: payload.preferred_days ?? existingPreferences.preferred_days,
    max_session_minutes: payload.max_session_minutes ?? existingPreferences.max_session_minutes,
    days_per_week: payload.days_per_week,
    pool_preferences: payload.pool_preferences ?? existingPreferences.pool_preferences,
    weak_point_selection: payload.weak_point_selection ?? existingPreferences.weak_point_selection
  };

  const saveMetaFromProfile = isRecord(profile.save_meta_json) ? profile.save_meta_json : {};
  const nowIso = new Date().toISOString();
  const nextSaveMeta = {
    ...saveMetaFromProfile,
    plan_started_at:
      typeof saveMetaFromProfile.plan_started_at === "string"
        ? saveMetaFromProfile.plan_started_at
        : nowIso,
    last_activity_at: nowIso
  };

  const previousPlanId =
    isRecord(profile.active_program_json) && typeof (profile.active_program_json as { plan_id?: unknown }).plan_id === "string"
      ? ((profile.active_program_json as { plan_id: string }).plan_id)
      : null;
  if (payload.confirm_overwrite && previousPlanId) {
    await supabase
      .from("training_sessions")
      .delete()
      .eq("user_id", authData.user.id)
      .eq("plan_id", previousPlanId);
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({
      injuries: payload.injuries,
      preferences: updatedPreferences,
      active_program_json: snapshot,
      save_meta_json: nextSaveMeta
    })
    .eq("user_id", authData.user.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to save active program" },
      { status: 500, headers: response.headers }
    );
  }

  if (Array.isArray(schedule) && schedule.length > 0) {
    const inserts = schedule.map((session) => ({
      user_id: authData.user.id,
      session_date: session.date,
      program_session_key: session.program_session_key,
      plan_id: (snapshot as { plan_id: string }).plan_id,
      week_key: (snapshot as { week_key: string }).week_key,
      status: "planned",
      notes: session.focus
    }));

    const { data: sessionRows, error: sessionError } = await supabase
      .from("training_sessions")
      .upsert(inserts, { onConflict: "user_id,session_date,program_session_key" })
      .select("id, program_session_key");

    if (sessionError) {
      return NextResponse.json(
        { error: "Program saved but sessions could not be planned." },
        { status: 500, headers: response.headers }
      );
    }

    if (sessionPlans && sessionPlans.length > 0 && sessionRows && sessionRows.length > 0) {
      const sessionIdByKey = new Map(
        sessionRows
          .filter((row): row is { id: number; program_session_key: string } => !!row.id)
          .map((row) => [row.program_session_key, row.id])
      );
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

      if (exerciseInserts.length > 0) {
        const { data: insertedExercises, error: exerciseError } = await supabase
          .from("training_exercises")
          .insert(exerciseInserts)
          .select("id, exercise_key");

        if (exerciseError) {
          return NextResponse.json(
            { error: "Program saved but exercises could not be seeded." },
            { status: 500, headers: response.headers }
          );
        }

        const exerciseIdByKey = new Map(
          (insertedExercises ?? []).map((row) => [row.exercise_key, row.id])
        );
        const setRows: {
          exercise_id: number;
          set_index: number;
          reps?: number | null;
          rpe?: number | null;
          rir?: number | null;
          rest_seconds?: number | null;
        }[] = [];

        sessionPlans.forEach((plan) => {
          const sessionId = sessionIdByKey.get(plan.program_session_key);
          if (!sessionId) return;
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
          const { error: setError } = await supabase.from("training_sets").insert(setRows);
          if (setError) {
            console.error("Failed to seed training sets", setError);
            const exerciseIds = (insertedExercises ?? [])
              .map((row) => row.id)
              .filter((id): id is number => typeof id === "number");
            if (exerciseIds.length > 0) {
              const { error: rollbackError } = await supabase
                .from("training_exercises")
                .delete()
                .in("id", exerciseIds);
              if (rollbackError) {
                console.error("Failed to roll back exercises after set insert failure", rollbackError);
              }
            }
            // TODO: move inserts into a single DB transaction or stored procedure for atomicity.
            return NextResponse.json(
              { error: "Program saved but sets could not be seeded. Please retry." },
              { status: 500, headers: response.headers }
            );
          }
        }
      }
    }
  }

  return NextResponse.json(
    { preview, schedule, active_program: snapshot },
    { headers: response.headers }
  );
}
