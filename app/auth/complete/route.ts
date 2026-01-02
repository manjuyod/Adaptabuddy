import { NextResponse, type NextRequest } from "next/server";
import { defaultRedirectForProfile, resolveNextPath } from "@/lib/auth/redirect";
import {
  createSupabaseRouteClient,
  ensureUserProfile
} from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createSupabaseRouteClient(request, response);

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: response.headers }
    );
  }

  const profile = await ensureUserProfile(supabase, data.user);

  let nextParam: string | null = null;
  try {
    const body = (await request.json()) as { next?: unknown };
    nextParam = typeof body.next === "string" ? body.next : null;
  } catch {
    nextParam = null;
  }

  const safeNext = resolveNextPath(nextParam);
  const redirectPath = safeNext ?? defaultRedirectForProfile(profile);

  return NextResponse.json(
    { redirectPath },
    {
      headers: response.headers
    }
  );
}
