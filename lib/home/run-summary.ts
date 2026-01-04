import { isProgramEmpty } from "@/lib/auth/redirect";
import type { SaveMeta, SupabaseClientType } from "@/lib/supabase/server";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

type ScheduleEntry = {
  program_session_key: string;
  date?: string;
  label?: string;
  focus?: string;
  week?: number | null;
};

export type CurrentRunSummary = {
  hasProgram: boolean;
  planNames: string[];
  weekNumber: number | null;
  planStartedAt?: string | null;
  lastActivityAt?: string | null;
  lastCompletedAt?: string | null;
  nextSession?: {
    date: string;
    label: string;
    exerciseCount?: number | null;
  } | null;
};

const parseIsoDate = (iso: string): Date | null => {
  const parts = iso.split("-").map((entry) => Number(entry));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
};

const parseSelectedProgramIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const templateId =
        typeof entry.template_id === "number" && Number.isFinite(entry.template_id)
          ? entry.template_id
          : null;
      return templateId;
    })
    .filter((id): id is number => id !== null);
};

const parseSchedule = (value: unknown): ScheduleEntry[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const programKey =
        typeof entry.program_session_key === "string" ? entry.program_session_key : null;
      if (!programKey) return null;
      const date = typeof entry.date === "string" ? entry.date : undefined;
      const label = typeof entry.label === "string" ? entry.label : undefined;
      const focus = typeof entry.focus === "string" ? entry.focus : undefined;
      const week =
        typeof entry.week === "number" && Number.isFinite(entry.week) ? entry.week : null;
      return { program_session_key: programKey, date, label, focus, week };
    })
    .filter(Boolean) as ScheduleEntry[];
};

const deriveWeekNumber = (program: Record<string, unknown>): number | null => {
  const cursor =
    typeof program.week_cursor === "number" && Number.isFinite(program.week_cursor)
      ? program.week_cursor
      : null;
  if (cursor !== null) return Math.max(1, cursor + 1);

  const weekKey =
    typeof program.week_key === "string" && program.week_key.length > 0
      ? program.week_key
      : null;
  const parsed = weekKey ? parseIsoDate(weekKey) : null;
  if (parsed) {
    const today = new Date();
    const diff = today.getTime() - parsed.getTime();
    const weeks = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
    return Math.max(1, weeks + 1);
  }

  return 1;
};

const fetchTemplateNames = async (
  supabase: SupabaseClientType,
  templateIds: number[]
): Promise<string[]> => {
  if (templateIds.length === 0) return [];
  const { data, error } = await supabase
    .from("templates")
    .select("id, name")
    .in("id", templateIds);

  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error("Failed to load template names for run summary", error);
    return [];
  }

  const nameById = new Map<number, string>();
  data.forEach((row) => {
    if (typeof row.id === "number" && typeof row.name === "string") {
      nameById.set(row.id, row.name);
    }
  });
  return templateIds
    .map((id) => nameById.get(id))
    .filter((name): name is string => Boolean(name));
};

const fetchNextSession = async (params: {
  supabase: SupabaseClientType;
  userId: string;
  schedule: ScheduleEntry[];
}): Promise<CurrentRunSummary["nextSession"]> => {
  const { supabase, userId, schedule } = params;
  const today = new Date().toISOString().slice(0, 10);
  const scheduleLookup = new Map(
    schedule.map((entry) => [entry.program_session_key, entry])
  );

  const { data: sessions, error } = await supabase
    .from("training_sessions")
    .select("id, session_date, status, program_session_key, notes")
    .eq("user_id", userId)
    .or("status.eq.planned,status.is.null")
    .gte("session_date", today)
    .order("session_date", { ascending: true })
    .limit(1);

  if (!error && sessions && sessions.length > 0) {
    const session = sessions[0];
    const label =
      (typeof session.notes === "string" && session.notes) ||
      scheduleLookup.get(session.program_session_key ?? "")?.label ||
      scheduleLookup.get(session.program_session_key ?? "")?.focus ||
      "Planned session";

    let exerciseCount: number | null = null;
    if (typeof session.id === "number") {
      const { count } = await supabase
        .from("training_exercises")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id);
      if (typeof count === "number") {
        exerciseCount = count;
      }
    }

    return {
      date: session.session_date,
      label,
      exerciseCount
    };
  }

  // Fallback to schedule snapshot if no planned session rows exist yet
  const upcomingFromSchedule = schedule
    .filter((entry) => entry.date && entry.date >= today)
    .sort((a, b) => (a.date! < b.date! ? -1 : 1))[0];

  if (upcomingFromSchedule?.date) {
    return {
      date: upcomingFromSchedule.date,
      label:
        upcomingFromSchedule.label ??
        upcomingFromSchedule.focus ??
        "Planned session",
      exerciseCount: null
    };
  }

  return null;
};

export const buildCurrentRunSummary = async (params: {
  supabase: SupabaseClientType;
  userId: string;
  activeProgram: Record<string, unknown> | null;
  saveMeta?: SaveMeta;
}): Promise<CurrentRunSummary> => {
  const { supabase, userId, activeProgram, saveMeta } = params;
  const hasProgram = !isProgramEmpty(activeProgram);
  const baseMeta = {
    planStartedAt: saveMeta?.plan_started_at ?? null,
    lastActivityAt: saveMeta?.last_activity_at ?? null,
    lastCompletedAt: saveMeta?.last_completed_session_at ?? null
  };

  if (!hasProgram || !activeProgram) {
    return {
      hasProgram,
      planNames: [],
      weekNumber: null,
      ...baseMeta,
      nextSession: null
    };
  }

  const program = activeProgram;
  const templateIds = parseSelectedProgramIds(
    (program as { selected_programs?: unknown }).selected_programs
  );
  const planNames = await fetchTemplateNames(supabase, templateIds);
  const schedule = parseSchedule((program as { schedule?: unknown }).schedule);
  const weekNumber = deriveWeekNumber(program);
  const nextSession = await fetchNextSession({ supabase, userId, schedule });

  const planStartedAt =
    baseMeta.planStartedAt ??
    (typeof (program as { generated_at?: unknown }).generated_at === "string"
      ? (program as { generated_at: string }).generated_at
      : null);

  return {
    hasProgram,
    planNames: planNames.length > 0 ? planNames : ["Program mix"],
    weekNumber,
    planStartedAt,
    lastActivityAt: baseMeta.lastActivityAt,
    lastCompletedAt: baseMeta.lastCompletedAt,
    nextSession
  };
};
