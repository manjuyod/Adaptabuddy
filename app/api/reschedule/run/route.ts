import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createSupabaseRouteClient,
  ensureUserProfile,
  type SupabaseClientType
} from "@/lib/supabase/server";
import { runReschedule } from "@/lib/train/reschedule";
import type { RescheduleResponse } from "@/lib/train/types";

const requestSchema = z.object({
  mode: z.enum(["auto", "soft", "hard"]).default("auto"),
  threshold: z.number().int().min(1).max(10).optional(),
  reshuffle: z.boolean().optional()
});

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

  let parsed: z.infer<typeof requestSchema>;
  try {
    const body: unknown = await request.json().catch(() => ({}));
    parsed = requestSchema.parse(body ?? {});
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 400, headers: response.headers }
    );
  }

  const profile = await ensureUserProfile(supabase, authData.user);

  try {
    const result: RescheduleResponse = await runReschedule({
      supabase,
      userId: authData.user.id,
      profile,
      options: parsed
    });
    return NextResponse.json(result, { headers: response.headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reschedule failed";
    const status = message.includes("No active program") ? 409 : 500;
    return NextResponse.json(
      { error: message },
      { status, headers: response.headers }
    );
  }
}
