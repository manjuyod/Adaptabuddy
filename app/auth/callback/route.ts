import { NextResponse, type NextRequest } from "next/server";
import { defaultRedirectForProfile, resolveNextPath } from "@/lib/auth/redirect";
import {
  createSupabaseRouteClient,
  ensureUserProfile
} from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();
  const supabase = createSupabaseRouteClient(request, response);
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(new URL("/login", request.url), {
      headers: response.headers
    });
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login", request.url), {
      headers: response.headers
    });
  }

  const profile = await ensureUserProfile(supabase, data.user);
  const safeNext =
    resolveNextPath(request.nextUrl.searchParams.get("next")) ??
    defaultRedirectForProfile(profile);

  return NextResponse.redirect(new URL(safeNext, request.url), {
    headers: response.headers
  });
}
