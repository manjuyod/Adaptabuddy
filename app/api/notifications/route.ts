import { NextResponse } from "next/server";
import {
  createSupabaseServerClient,
  ensureUserProfile,
  type SupabaseClientType
} from "@/lib/supabase/server";
import { loadNotifications } from "@/lib/notifications/builder";

export async function GET() {
  const supabase: SupabaseClientType = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await ensureUserProfile(supabase, authData.user);
    const payload = await loadNotifications({
      supabase,
      userId: authData.user.id,
      preferences: profile.preferences
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load notifications", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
