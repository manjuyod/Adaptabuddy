import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/supabase/server";
import { loadUpcomingSession } from "@/lib/train/session-loader";
import { ensureInjuryIds } from "@/lib/wizard/injuries";
import type { WizardInjury } from "@/lib/wizard/types";
import TrainClient from "./train-client";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseInjuries = (value: unknown): WizardInjury[] => {
  if (!Array.isArray(value)) return [];
  const parsed = value
    .map((entry) => {
      if (!isRecord(entry) || typeof entry.name !== "string") return null;
      const severity =
        typeof entry.severity === "number" && Number.isFinite(entry.severity)
          ? Math.min(10, Math.max(0, entry.severity))
          : 0;
      const notes = typeof entry.notes === "string" ? entry.notes : undefined;
      const id = typeof entry.id === "string" ? entry.id : undefined;
      return { id, name: entry.name, severity, notes };
    })
    .filter(Boolean) as WizardInjury[];

  return ensureInjuryIds(parsed);
};

export default async function TrainPage() {
  const { supabase, user, profile } = await getSessionWithProfile();
  if (!user || !profile) {
    redirect("/login");
  }

  const session = await loadUpcomingSession(supabase, user.id);
  const injuries = parseInjuries(profile.injuries);
  const activeProgram = isRecord(profile.active_program_json)
    ? profile.active_program_json
    : null;

  return (
    <TrainClient
      userId={user.id}
      initialSession={session}
      initialBodyweight={typeof profile.bodyweight === "number" ? profile.bodyweight : null}
      initialInjuries={injuries}
      activeProgram={activeProgram}
      offlineCursor={profile.offline_sync_cursor ?? 0}
    />
  );
}
