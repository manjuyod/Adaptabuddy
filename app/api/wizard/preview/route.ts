import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient, type SupabaseClientType } from "@/lib/supabase/server";
import { buildPreview, deriveSeed } from "@/lib/wizard/engine";
import {
  buildHypertrophyPlan,
  isHypertrophyTemplate
} from "@/lib/wizard/hypertrophy-engine";
import { normalizeWizardPayload } from "@/lib/wizard/schemas";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase: SupabaseClientType = createSupabaseRouteClient(request, response);

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: response.headers }
    );
  }
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
      { error: "Invalid payload", details: error instanceof Error ? error.message : String(error) },
      { status: 400, headers: response.headers }
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

  if (hypertrophyTemplate) {
    const { data: muscleGroups, error: muscleError } = await supabase
      .from("muscle_groups")
      .select("id, name, slug, region, parent_id, created_at");
    if (muscleError || !muscleGroups) {
      return NextResponse.json(
        { error: "Failed to load muscle groups for preview" },
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
        { error: "Failed to load exercises for preview" },
        { status: 500, headers: response.headers }
      );
    }

    const { preview } = buildHypertrophyPlan({
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

    return NextResponse.json(preview, { headers: response.headers });
  }

  const preview = buildPreview(payload, templates);
  return NextResponse.json(preview, { headers: response.headers });
}
