try {
  // Optional in tests; available in Next runtime
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  require("server-only");
} catch {
  // no-op
}

import { createHash } from "crypto";
import { loadUpcomingSession } from "@/lib/train/session-loader";
import type { RescheduleResponse } from "@/lib/train/types";
import { dayOptions, equipmentOptions } from "@/lib/wizard/schemas";
import { buildSchedule, summarizeTemplate } from "@/lib/wizard/engine";
import { ensureInjuryIds } from "@/lib/wizard/injuries";
import type {
  ActiveProgramSnapshot,
  EquipmentOption,
  PlannedSession,
  SelectedProgram,
  WizardInjury,
  WizardPayload
} from "@/lib/wizard/types";
import type { SupabaseClientType, UserProfile } from "../supabase/server";

type RescheduleMode = "auto" | "soft" | "hard";

type RescheduleOptions = {
  mode?: RescheduleMode;
  threshold?: number;
  reshuffle?: boolean;
};

type TemplateSummary = ReturnType<typeof summarizeTemplate>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

const parseIsoDate = (value: string): Date | null => {
  const parts = value.split("-").map((entry) => Number(entry));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
};

const startOfWeekIso = (value: Date): string => {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const weekday = date.getUTCDay();
  const diff = (weekday + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return toIsoDate(date);
};

const endOfWeekIso = (weekKey: string): string => {
  const base = parseIsoDate(weekKey) ?? new Date();
  const end = new Date(base);
  end.setUTCDate(base.getUTCDate() + 6);
  return toIsoDate(end);
};

export const deriveWeekKeyFromSchedule = (schedule: PlannedSession[]): string => {
  if (schedule.length === 0) return startOfWeekIso(new Date());
  const earliest = schedule.reduce((candidate, session) =>
    session.date < candidate.date ? session : candidate
  );
  const parsed = parseIsoDate(earliest.date);
  return parsed ? startOfWeekIso(parsed) : startOfWeekIso(new Date());
};

const generatePlanIdFromSeed = (seed: string): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return createHash("sha256").update(`${seed}-${Date.now()}`).digest("hex").slice(0, 32);
};

export const deriveReshuffledSeed = (seed: string, restartCounter: number) =>
  createHash("sha256").update(`${seed}:${restartCounter}`).digest("hex").slice(0, 12);

const validDay = (value: string): value is (typeof dayOptions)[number] =>
  dayOptions.includes(value as (typeof dayOptions)[number]);

const isEquipmentOption = (value: unknown): value is EquipmentOption =>
  typeof value === "string" &&
  equipmentOptions.includes(value as (typeof equipmentOptions)[number]);

export const resolveTrainingDays = (
  program: ActiveProgramSnapshot
): (typeof dayOptions)[number][] => {
  const preferred = Array.isArray(program.preferred_days)
    ? program.preferred_days.filter(validDay)
    : [];
  const fallback: (typeof dayOptions)[number][] = [
    "Mon",
    "Wed",
    "Fri",
    "Tue",
    "Thu",
    "Sat",
    "Sun"
  ];
  const pool = [...preferred, ...fallback];
  const picked: (typeof dayOptions)[number][] = [];
  for (const day of pool) {
    if (picked.length >= program.days_per_week) break;
    if (!picked.includes(day) && validDay(day)) {
      picked.push(day);
    }
  }
  return picked.slice(0, program.days_per_week);
};

const nextTrainingDate = (
  startIso: string,
  trainingDays: (typeof dayOptions)[number][],
  blocked: Set<string>
): string => {
  const dayNames: (typeof dayOptions)[number][] = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat"
  ];
  const cursor = parseIsoDate(startIso) ?? new Date();
  for (let i = 0; i < 42; i++) {
    const candidateIso = toIsoDate(cursor);
    const dayName = dayNames[cursor.getUTCDay()];
    if (trainingDays.includes(dayName) && !blocked.has(candidateIso)) {
      return candidateIso;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return startIso;
};

const asSelectedPrograms = (
  value: unknown
): SelectedProgram[] | null => {
  if (!Array.isArray(value)) return null;
  const parsed = value
    .map((entry) => {
      if (!isRecord(entry) || typeof entry.template_id !== "number") return null;
      const selected: SelectedProgram = { template_id: entry.template_id };
      if (
        typeof entry.weight_override === "number" &&
        Number.isFinite(entry.weight_override)
      ) {
        selected.weight_override = entry.weight_override;
      }
      return selected;
    })
    .filter((entry): entry is SelectedProgram => entry !== null);
  return parsed.length > 0 ? parsed : null;
};

const asSchedule = (value: unknown): PlannedSession[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const date = typeof entry.date === "string" ? entry.date : null;
      const program_session_key =
        typeof entry.program_session_key === "string" ? entry.program_session_key : null;
      const template_id =
        typeof entry.template_id === "number" && Number.isFinite(entry.template_id)
          ? entry.template_id
          : null;
      const focus = typeof entry.focus === "string" ? entry.focus : "Training session";
      const label = typeof entry.label === "string" ? entry.label : "Program session";
      if (!date || !program_session_key || template_id === null) return null;
      return { date, program_session_key, template_id, focus, label };
    })
    .filter(Boolean) as PlannedSession[];
};

const asInjuries = (value: unknown): WizardInjury[] => {
  if (!Array.isArray(value)) return [];
  const parsed: Parameters<typeof ensureInjuryIds>[0] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const name = typeof entry.name === "string" ? entry.name : null;
    const severity =
      typeof entry.severity === "number" && Number.isFinite(entry.severity)
        ? entry.severity
        : null;
    if (!name || severity === null) continue;
    const notes = typeof entry.notes === "string" ? entry.notes : undefined;
    const id = typeof entry.id === "string" ? entry.id : undefined;
    parsed.push({ id, name, severity, notes });
  }
  return ensureInjuryIds(parsed);
};

const upgradeActiveProgram = (value: unknown): ActiveProgramSnapshot | null => {
  if (!isRecord(value)) return null;
  const seed = typeof value.seed === "string" ? value.seed : null;
  const daysPerWeek =
    typeof value.days_per_week === "number" && Number.isFinite(value.days_per_week)
      ? value.days_per_week
      : null;
  const selectedPrograms = asSelectedPrograms(value.selected_programs);
  if (!seed || !daysPerWeek || !selectedPrograms) return null;

  const schedule = asSchedule(value.schedule);
  const plan_id =
    typeof value.plan_id === "string" ? value.plan_id : generatePlanIdFromSeed(seed);
  const week_key =
    typeof value.week_key === "string" ? value.week_key : deriveWeekKeyFromSchedule(schedule);
  const restart_counter =
    typeof value.restart_counter === "number" && Number.isFinite(value.restart_counter)
      ? value.restart_counter
      : 0;
  const seed_strategy = value.seed_strategy === "reshuffle" ? "reshuffle" : "static";
  const injuries = asInjuries(value.injuries);
  const preferred_days = Array.isArray(value.preferred_days)
    ? value.preferred_days.filter(validDay)
    : undefined;
  const equipment_profile = Array.isArray(value.equipment_profile)
    ? value.equipment_profile.filter(isEquipmentOption)
    : undefined;
  const decisions_log = Array.isArray(value.decisions_log)
    ? value.decisions_log.filter((entry): entry is string => typeof entry === "string")
    : [];

  return {
    seed,
    seed_strategy,
    plan_id,
    week_key,
    restart_counter,
    generated_at:
      typeof value.generated_at === "string" ? value.generated_at : new Date().toISOString(),
    fatigue_profile:
      value.fatigue_profile === "high" || value.fatigue_profile === "low"
        ? value.fatigue_profile
        : "medium",
    equipment_profile,
    days_per_week: daysPerWeek,
    max_session_minutes:
      typeof value.max_session_minutes === "number" ? value.max_session_minutes : undefined,
    preferred_days,
    injuries,
    selected_programs: selectedPrograms,
    schedule,
    decisions_log,
    preview: isRecord(value.preview)
      ? (value.preview as ActiveProgramSnapshot["preview"])
      : {
          seed,
          weeklySets: [],
          recoveryLoad: 0,
          warnings: [],
          removedSlots: 0
        }
  };
};

const persistProgram = async (
  supabase: SupabaseClientType,
  userId: string,
  program: ActiveProgramSnapshot
) => {
  await supabase.from("users").update({ active_program_json: program }).eq("user_id", userId);
};

const buildWeeklySchedule = (params: {
  program: ActiveProgramSnapshot;
  templateSummaries: TemplateSummary[];
  seed: string;
  planId: string;
  weekKey: string;
  userId: string;
}) => {
  const payload: WizardPayload = {
    user_id: params.userId,
    injuries: params.program.injuries,
    fatigue_profile: params.program.fatigue_profile,
    equipment_profile: params.program.equipment_profile,
    selected_programs: params.program.selected_programs,
    days_per_week: params.program.days_per_week,
    max_session_minutes: params.program.max_session_minutes,
    preferred_days: params.program.preferred_days
  };
  return buildSchedule(payload, params.templateSummaries, params.seed, {
    planId: params.planId,
    weekKey: params.weekKey
  });
};

const loadTemplateSummaries = async (
  supabase: SupabaseClientType,
  program: ActiveProgramSnapshot
): Promise<TemplateSummary[]> => {
  const ids = program.selected_programs.map((entry) => entry.template_id);
  const { data, error } = await supabase
    .from("templates")
    .select("id, name, disciplines, methodology, template_json")
    .in("id", ids);
  if (error || !data) {
    throw new Error("Failed to load templates for reschedule.");
  }
  return data.map((template) => summarizeTemplate(template));
};

const applyAutoReschedule = async (params: {
  supabase: SupabaseClientType;
  userId: string;
  program: ActiveProgramSnapshot;
  threshold: number;
}): Promise<RescheduleResponse> => {
  const { supabase, userId, program, threshold } = params;
  const today = toIsoDate(new Date());
  const trainingDays = resolveTrainingDays(program);
  const { data: sessions, error } = await supabase
    .from("training_sessions")
    .select("id, session_date, status, program_session_key, inconsistency_score, notes")
    .eq("user_id", userId)
    .order("session_date", { ascending: true });

  if (error) {
    throw new Error("Unable to load sessions for reschedule.");
  }

  const scheduleLookup = new Map(
    (program.schedule ?? []).map((entry) => [entry.program_session_key, entry])
  );
  const blocked = new Set(
    (sessions ?? [])
      .filter(
        (session) =>
          session.session_date >= today &&
          (session.status === "planned" || session.status === "completed")
      )
      .map((session) => session.session_date)
  );

  const missed = (sessions ?? []).filter(
    (session) =>
      session.session_date < today &&
      (session.status === "planned" || session.status === null || session.status === "skipped")
  );

  const updatedSchedule: PlannedSession[] = [...(program.schedule ?? [])];
  const missUpdates: { id: number; nextScore: number; sessionDate: string; programKey: string }[] =
    [];
  const rescheduleRows: {
    user_id: string;
    session_date: string;
    program_session_key: string;
    plan_id: string;
    week_key: string;
    status: string;
    reschedule_flag: boolean;
    inconsistency_score: number;
    notes: string | null;
  }[] = [];

  for (const session of missed) {
    if (typeof session.id !== "number") continue;
    const programKey =
      typeof session.program_session_key === "string" && session.program_session_key
        ? session.program_session_key
        : `auto_${session.id}`;
    const nextDate = nextTrainingDate(today, trainingDays, blocked);
    blocked.add(nextDate);
    const targetSchedule = scheduleLookup.get(programKey);
    const nextScore = (session.inconsistency_score ?? 0) + 1;
    const baseNotes =
      targetSchedule?.focus ??
      targetSchedule?.label ??
      (typeof session.notes === "string" ? session.notes : null);
    missUpdates.push({
      id: session.id,
      nextScore,
      sessionDate: session.session_date,
      programKey
    });
    rescheduleRows.push({
      user_id: userId,
      session_date: nextDate,
      program_session_key: programKey,
      plan_id: program.plan_id,
      week_key: program.week_key,
      status: "planned",
      reschedule_flag: true,
      inconsistency_score: nextScore,
      notes: baseNotes
    });

    const existingIndex = updatedSchedule.findIndex(
      (entry) => entry.program_session_key === programKey
    );
    if (existingIndex >= 0) {
      updatedSchedule[existingIndex] = {
        ...updatedSchedule[existingIndex],
        date: nextDate
      };
    } else if (targetSchedule) {
      updatedSchedule.push({ ...targetSchedule, date: nextDate });
    }
  }

  const resolvedWeekKey =
    parseIsoDate(program.week_key) && program.week_key
      ? program.week_key
      : deriveWeekKeyFromSchedule(updatedSchedule);
  rescheduleRows.forEach((row) => {
    row.week_key = resolvedWeekKey;
  });

  for (const entry of missUpdates) {
    await supabase
      .from("training_sessions")
      .update({
        status: "missed",
        reschedule_flag: true,
        inconsistency_score: entry.nextScore
      })
      .eq("id", entry.id);
  }

  if (rescheduleRows.length > 0) {
    await supabase
      .from("training_sessions")
      .upsert(rescheduleRows, { onConflict: "user_id,session_date,program_session_key" });
  }

  const weekEnd = endOfWeekIso(resolvedWeekKey);
  const missedInWeekExisting = (sessions ?? []).filter(
    (session) =>
      session.status === "missed" &&
      session.session_date >= resolvedWeekKey &&
      session.session_date <= weekEnd
  ).length;
  const missedNewInWeek = missUpdates.filter(
    (entry) => entry.sessionDate >= resolvedWeekKey && entry.sessionDate <= weekEnd
  ).length;

  const updatedProgram: ActiveProgramSnapshot = {
    ...program,
    schedule: updatedSchedule,
    week_key: resolvedWeekKey,
    decisions_log: [
      ...program.decisions_log,
      `Auto-rescheduled ${rescheduleRows.length} session(s) on ${today}`
    ]
  };

  await persistProgram(supabase, userId, updatedProgram);

  const upcoming_session = await loadUpcomingSession(supabase, userId);

  return {
    missed: missed.length,
    rescheduled: rescheduleRows.length,
    created: rescheduleRows.length,
    restart_required: missedInWeekExisting + missedNewInWeek >= threshold,
    restart_reason:
      missedInWeekExisting + missedNewInWeek >= threshold
        ? `Missed ${missedInWeekExisting + missedNewInWeek} session(s) this week`
        : undefined,
    active_program: updatedProgram,
    upcoming_session
  };
};

const applyRestart = async (params: {
  supabase: SupabaseClientType;
  userId: string;
  program: ActiveProgramSnapshot;
  mode: Exclude<RescheduleMode, "auto">;
  reshuffle: boolean;
}): Promise<RescheduleResponse> => {
  const { supabase, userId, program, mode, reshuffle } = params;
  const today = toIsoDate(new Date());
  const weekKey = program.week_key
    ? startOfWeekIso(parseIsoDate(program.week_key) ?? new Date())
    : startOfWeekIso(new Date());
  const nextCounter = (program.restart_counter ?? 0) + 1;
  const nextSeed = reshuffle ? deriveReshuffledSeed(program.seed, nextCounter) : program.seed;
  const seed_strategy = reshuffle ? "reshuffle" : program.seed_strategy ?? "static";
  const planId = generatePlanIdFromSeed(nextSeed);

  const summaries = await loadTemplateSummaries(supabase, program);
  const fullSchedule = buildWeeklySchedule({
    program,
    templateSummaries: summaries,
    seed: nextSeed,
    planId,
    weekKey,
    userId
  });
  const weekEnd = endOfWeekIso(weekKey);

  const targetSchedule =
    mode === "soft"
      ? fullSchedule.filter((session) => session.date >= today && session.date <= weekEnd)
      : fullSchedule;

  const { data: existing, error } = await supabase
    .from("training_sessions")
    .select("id, session_date, status, inconsistency_score")
    .eq("user_id", userId)
    .gte("session_date", weekKey)
    .lte("session_date", weekEnd);

  if (error) {
    throw new Error("Unable to load week for restart.");
  }

  const toSkip = (existing ?? []).filter((session) => {
    if (mode === "hard") {
      return session.status === "planned" || session.status === null;
    }
    return (
      session.session_date >= today &&
      (session.status === "planned" || session.status === null)
    );
  });

  for (const session of toSkip) {
    const nextScore = (session.inconsistency_score ?? 0) + 1;
    await supabase
      .from("training_sessions")
      .update({
        status: "skipped",
        reschedule_flag: true,
        inconsistency_score: nextScore
      })
      .eq("id", session.id);
  }

  if (targetSchedule.length > 0) {
    const inserts = targetSchedule.map((session) => ({
      user_id: userId,
      session_date: session.date,
      program_session_key: session.program_session_key,
      plan_id: planId,
      week_key: weekKey,
      status: "planned",
      reschedule_flag: mode === "hard",
      inconsistency_score: 0,
      notes: session.focus
    }));
    await supabase
      .from("training_sessions")
      .upsert(inserts, { onConflict: "user_id,session_date,program_session_key" });
  }

  const updatedProgram: ActiveProgramSnapshot = {
    ...program,
    seed: nextSeed,
    seed_strategy,
    plan_id: planId,
    week_key: weekKey,
    restart_counter: nextCounter,
    schedule: fullSchedule,
    decisions_log: [
      ...program.decisions_log,
      `${mode === "soft" ? "Soft" : "Hard"} restart on ${today}${
        reshuffle ? " (reshuffled)" : ""
      }`
    ]
  };

  await persistProgram(supabase, userId, updatedProgram);
  const upcoming_session = await loadUpcomingSession(supabase, userId);

  return {
    missed: 0,
    rescheduled: toSkip.length,
    created: targetSchedule.length,
    restart_required: false,
    active_program: updatedProgram,
    upcoming_session
  };
};

export const runReschedule = async (params: {
  supabase: SupabaseClientType;
  userId: string;
  profile: UserProfile;
  options?: RescheduleOptions;
}): Promise<RescheduleResponse> => {
  const { supabase, userId, profile, options } = params;
  const mode = options?.mode ?? "auto";
  const threshold = options?.threshold ?? 2;
  const program = upgradeActiveProgram(profile.active_program_json);
  if (!program) {
    throw new Error("No active program to reschedule.");
  }

  if (mode === "soft" || mode === "hard") {
    return applyRestart({
      supabase,
      userId,
      program,
      mode,
      reshuffle: options?.reshuffle ?? false
    });
  }

  return applyAutoReschedule({
    supabase,
    userId,
    program,
    threshold
  });
};
