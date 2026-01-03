import { redirect } from "next/navigation";
import { isProgramEmpty } from "@/lib/auth/redirect";
import { getSessionWithProfile } from "@/lib/supabase/server";
import { summarizeTemplate } from "@/lib/wizard/engine";
import type { WizardInjury } from "@/lib/wizard/types";
import WizardClient from "./wizard-client";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseInjuries = (value: unknown): WizardInjury[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry) || typeof entry.name !== "string") return null;
      const severity =
        typeof entry.severity === "number" && Number.isFinite(entry.severity)
          ? Math.min(5, Math.max(1, Math.round(entry.severity)))
          : 3;
      const notes = typeof entry.notes === "string" ? entry.notes : undefined;
      return { name: entry.name, severity, notes };
    })
    .filter(Boolean) as WizardInjury[];
};

export default async function WizardPage() {
  const { supabase, user, profile } = await getSessionWithProfile();
  if (!user || !profile) {
    redirect("/login");
  }

  const { data: templatesData, error: templateError } = await supabase
    .from("templates")
    .select("id, name, disciplines, methodology, template_json");

  if (templateError) {
    // Consider redirecting to an error page or showing an error UI
    throw new Error(`Failed to load templates: ${templateError.message}`);
  }

  const templateSummaries = (templatesData ?? []).map((template) =>
    summarizeTemplate(template)
  );

  const injuries = parseInjuries(profile.injuries);
  const preferences = isRecord(profile.preferences) ? profile.preferences : {};

  return (
    <WizardClient
      userId={user.id}
      initialInjuries={injuries}
      initialPreferences={preferences}
      templateSummaries={templateSummaries}
      hasExistingProgram={!isProgramEmpty(profile.active_program_json)}
    />
  );
}
