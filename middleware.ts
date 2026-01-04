import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolveNextPath } from "./lib/auth/redirect";
import { createSupabaseRouteClient } from "./lib/supabase/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createSupabaseRouteClient(request, response);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    const loginUrl = new URL("/login", request.url);
    const nextPath = resolveNextPath(
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
    if (nextPath) {
      loginUrl.searchParams.set("next", nextPath);
    }
    return NextResponse.redirect(loginUrl, { headers: response.headers });
  }

  return response;
}

export const config = {
  matcher: [
    "/home/:path*",
    "/train/:path*",
    "/wizard/:path*",
    "/kpi/:path*",
    "/settings/:path*",
    "/library/:path*"
  ]
};
