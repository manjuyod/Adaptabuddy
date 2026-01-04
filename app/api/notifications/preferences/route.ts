import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createSupabaseServerClient,
  ensureUserProfile,
  type SupabaseClientType
} from "@/lib/supabase/server";
import {
  extractNotificationPreferences,
  mergeNotificationPreferences
} from "@/lib/notifications/preferences";

const preferencesSchema = z.object({
  reminders_24h: z.boolean().optional(),
  reminders_2h: z.boolean().optional(),
  missed_session: z.boolean().optional(),
  reschedule_recommendation: z.boolean().optional(),
  pain_trend: z.boolean().optional(),
  push_opt_in: z.boolean().optional()
});

export async function GET() {
  const supabase: SupabaseClientType = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await ensureUserProfile(supabase, authData.user);
  const preferences = extractNotificationPreferences(profile.preferences);
  return NextResponse.json({ preferences });
}

export async function POST(request: NextRequest) {
  const supabase: SupabaseClientType = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof preferencesSchema>;
  try {
    const body: unknown = await request.json();
    parsed = preferencesSchema.parse(body);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid payload", details: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }

  const profile = await ensureUserProfile(supabase, authData.user);
  const nextPreferences = mergeNotificationPreferences(profile.preferences, parsed);

  const { error } = await supabase
    .from("users")
    .update({ preferences: nextPreferences })
    .eq("user_id", authData.user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to save preferences" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    preferences: extractNotificationPreferences(nextPreferences)
  });
}
