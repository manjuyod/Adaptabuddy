import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { buildPreview } from "@/lib/wizard/engine";
import { normalizeWizardPayload } from "@/lib/wizard/schemas";

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createSupabaseRouteClient(request, response);

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: response.headers }
    );
  }

  let payload = null;
  try {
    const body = await request.json();
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

  const preview = buildPreview(payload, templates);
  return NextResponse.json(preview, { headers: response.headers });
}
