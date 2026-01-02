import { redirect } from "next/navigation";
import { defaultRedirectForProfile } from "@/lib/auth/redirect";
import { getSessionWithProfile } from "@/lib/supabase/server";

export default async function Home() {
  const { user, profile } = await getSessionWithProfile();

  if (!user || !profile) {
    redirect("/login");
  }

  const destination = defaultRedirectForProfile(profile);
  redirect(destination);
}
