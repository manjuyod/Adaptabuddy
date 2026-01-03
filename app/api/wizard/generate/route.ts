import { NextResponse, type NextRequest } from "next/server";
import { isProgramEmpty } from "@/lib/auth/redirect";
import {
  createSupabaseRouteClient,
  ensureUserProfile
} from "@/lib/supabase/server";
import { buildActiveProgramSnapshot } from "@/lib/wizard/engine";
import { normalizeWizardPayload } from "@/lib/wizard/schemas";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export async function POST(request: NextRequest) {
  const response = new NextResponse();
  const supabase = createSupabaseRouteClient(request, response);

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
    const body = await request.json();
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

  const { preview, schedule, snapshot } = buildActiveProgramSnapshot(payload, templates);

  const existingPreferences = isRecord(profile.preferences) ? profile.preferences : {};
  const updatedPreferences = {
    ...existingPreferences,
    fatigue_profile: payload.fatigue_profile,
    equipment_profile: payload.equipment_profile ?? existingPreferences.equipment_profile,
    preferred_days: payload.preferred_days ?? existingPreferences.preferred_days,
    max_session_minutes: payload.max_session_minutes ?? existingPreferences.max_session_minutes,
    days_per_week: payload.days_per_week
  };

  const { error: updateError } = await supabase
    .from("users")
    .update({
      injuries: payload.injuries,
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

  if (schedule.length > 0) {
    const inserts = schedule.map((session) => ({
      user_id: authData.user.id,
      session_date: session.date,
      program_session_key: session.program_session_key,
      status: "planned",
      notes: session.focus
    }));

    const { error: sessionError } = await supabase
      .from("training_sessions")
      .upsert(inserts, { onConflict: "user_id,session_date,program_session_key" });

    if (sessionError) {
      return NextResponse.json(
        { error: "Program saved but sessions could not be planned." },
        { status: 500, headers: response.headers }
      );
    }
  }

  return NextResponse.json(
    { preview, schedule, active_program: snapshot },
    { headers: response.headers }
  );
}
