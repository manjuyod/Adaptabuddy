import { redirect } from "next/navigation";
import { defaultRedirectForProfile } from "@/lib/auth/redirect";
import { getSessionWithProfile } from "@/lib/supabase/server";

export default async function Home() {
  let user; let profile;
  try {
    const session = await getSessionWithProfile();
    user = session.user;
    profile = session.profile;
  } catch (err) {
    // Log for diagnostics, then send user to login if Supabase is unreachable
    // eslint-disable-next-line no-console
    console.error("getSessionWithProfile failed:", err);
    redirect("/login");
    return;
  }

  if (!user || !profile) {
    redirect("/login");
  }

  const destination = defaultRedirectForProfile(profile);
  redirect(destination);
}
