import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.redirect(new URL("/train", request.url));
  const supabase = createServerClient(
    appConfig.supabaseUrl,
    appConfig.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  await supabase.auth.exchangeCodeForSession(code);

  return response;
}
