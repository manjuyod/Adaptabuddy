import { createHash } from "crypto";
import { dayOptions } from "./schemas";
import type {
  ActiveProgramSnapshot,
  FatigueProfile,
  PlannedSession,
  PreviewResult,
  TemplateSummary,
  WizardPayload
} from "./types";

type TemplateData = {
  id: number;
  name: string;
  template_json: unknown;
  disciplines?: string[] | null;
  methodology?: string | null;
};

const fatigueLoadThreshold: Record<FatigueProfile, number> = {
  low: 65,
  medium: 75,
  high: 85
};

const fatigueLoadMultiplier: Record<FatigueProfile, number> = {
  low: 0.9,
  medium: 1,
  high: 1.1
};

const dayIndexMap: Record<(typeof dayOptions)[number], number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const deriveSeed = (payload: WizardPayload, templateIds: number[]) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        user: payload.user_id,
        templates: templateIds,
        days: payload.days_per_week,
        fatigue: payload.fatigue_profile,
        preferred_days: payload.preferred_days ?? [],
        equipment: payload.equipment_profile ?? []
      })
    )
    .digest("hex")
    .slice(0, 12);

const walkForSets = (node: unknown): number => {
  if (Array.isArray(node)) {
    return node.reduce((sum, item) => sum + walkForSets(item), 0);
  }

  if (isRecord(node)) {
    return Object.entries(node).reduce((sum, [key, value]) => {
      const sets = key === "sets" && typeof value === "number" ? value : 0;
      return sum + sets + walkForSets(value);
    }, 0);
  }

  return 0;
};

export const estimateTotalSetsFromTemplate = (templateJson: unknown): number => {
  const raw = walkForSets(templateJson);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 24; // fallback baseline
  }
  return Math.max(18, Math.round(raw));
};

export const countSessionsInTemplate = (templateJson: unknown): number => {
  if (!isRecord(templateJson)) return 0;

  const possibleArrays = [
    templateJson.microcycle_days,
    templateJson.split,
    templateJson.schedule,
    templateJson.sessions
  ];

  const firstArray = possibleArrays.find((entry) => Array.isArray(entry));
  if (Array.isArray(firstArray)) {
    return firstArray.length;
  }

  // fallback: count objects that look like sessions
  const sessionLike = Object.values(templateJson).filter(
    (value) => Array.isArray(value) && value.every((item) => isRecord(item))
  );
  if (sessionLike.length > 0) {
    return (sessionLike[0] as unknown[]).length;
  }

  return 0;
};

const focusFromTemplate = (templateJson: unknown): string | null => {
  if (!isRecord(templateJson)) return null;
  const candidates = [
    (templateJson.microcycle_days as unknown)?.[0],
    (templateJson.split as unknown)?.[0],
    (templateJson.schedule as unknown)?.[0],
    (templateJson.sessions as unknown)?.[0]
  ];

  for (const candidate of candidates) {
    if (isRecord(candidate) && typeof candidate.focus === "string") {
      return candidate.focus;
    }
  }
  return null;
};

export const summarizeTemplate = (template: TemplateData): TemplateSummary => {
  const estimatedSets = estimateTotalSetsFromTemplate(template.template_json);
  const sessionCount = countSessionsInTemplate(template.template_json) || 3;
  const focusHint =
    focusFromTemplate(template.template_json) ??
    (template.methodology || template.disciplines?.join(", ") || "Program mix");

  return {
    id: template.id,
    name: template.name,
    methodology: template.methodology ?? null,
    disciplines: template.disciplines ?? [],
    estimatedSets,
    sessionCount,
    focusHint
  };
};

const pickTrainingDays = (preferred: string[] | undefined, count: number) => {
  const fallbacks: (typeof dayOptions)[number][] = [
    "Mon",
    "Wed",
    "Fri",
    "Tue",
    "Thu",
    "Sat",
    "Sun"
  ];

  const pool = [...(preferred ?? []), ...fallbacks] as string[];
  const days: string[] = [];

  for (const day of pool) {
    if (days.length >= count) break;
    if (dayOptions.includes(day as (typeof dayOptions)[number]) && !days.includes(day)) {
      days.push(day);
    }
  }

  return days.slice(0, count);
};

const nextDateForDay = (dayName: (typeof dayOptions)[number]): string => {
  const today = new Date();
  const target = dayIndexMap[dayName];
  const current = today.getDay();
  const delta = (target - current + 7) % 7 || 7; // always schedule in the coming week
  const scheduled = new Date(today);
  scheduled.setDate(today.getDate() + delta);
  return scheduled.toISOString().slice(0, 10);
};

export const buildPreview = (
  payload: WizardPayload,
  templates: TemplateData[]
): PreviewResult => {
  const templateIds = templates.map((template) => template.id);
  const seed = deriveSeed(payload, templateIds);

  const weightLookup = new Map(
    payload.selected_programs.map((program) => [program.template_id, program.weight_override ?? 1])
  );

  const rawSets = templates.reduce((sum, template) => {
    const weight = weightLookup.get(template.id) ?? 1;
    return sum + estimateTotalSetsFromTemplate(template.template_json) * weight;
  }, 0);

  const scaledSets =
    rawSets * (payload.days_per_week / Math.max(templates.length, 1)) *
    ((payload.max_session_minutes ?? 60) / 60);

  const weeklySets = [
    { muscleGroup: "Upper", sets: Math.max(6, Math.round(scaledSets * 0.42)) },
    { muscleGroup: "Lower", sets: Math.max(6, Math.round(scaledSets * 0.36)) },
    { muscleGroup: "Core", sets: Math.max(4, Math.round(scaledSets * 0.22)) }
  ];

  const removedSlots = payload.injuries.reduce((sum, injury) => {
    if (injury.severity >= 4) return sum + 2;
    if (injury.severity >= 2) return sum + 1;
    return sum;
  }, 0);

  const volumeScore = scaledSets / Math.max(payload.days_per_week, 1);
  const recoveryLoad = Math.min(
    100,
    Math.round(
      (volumeScore * 2.8 + payload.days_per_week * 6 + removedSlots * 3) *
        fatigueLoadMultiplier[payload.fatigue_profile]
    )
  );

  const warnings: PreviewResult["warnings"] = [];
  const underTargetGroups = weeklySets.filter((group) => group.sets < 10).length;
  if (underTargetGroups > 0) {
    warnings.push({
      type: "under_target",
      message: `${underTargetGroups} muscle groups under target`
    });
  }

  if (recoveryLoad > fatigueLoadThreshold[payload.fatigue_profile]) {
    warnings.push({
      type: "recovery_load",
      message: `Recovery load high for ${payload.fatigue_profile} fatigue profile`
    });
  }

  if (removedSlots > 0) {
    warnings.push({
      type: "injury_reduction",
      message: `Injury constraints removed ${removedSlots} slots`
    });
  }

  return {
    seed,
    weeklySets,
    recoveryLoad,
    warnings,
    removedSlots
  };
};

export const buildSchedule = (
  payload: WizardPayload,
  templateSummaries: TemplateSummary[],
  seed: string
): PlannedSession[] => {
  const templatesById = new Map(templateSummaries.map((entry) => [entry.id, entry]));
  const selectedPrograms = payload.selected_programs.map((program) => ({
    ...program,
    summary: templatesById.get(program.template_id) ?? templateSummaries[0]
  }));

  const trainingDays = pickTrainingDays(payload.preferred_days, payload.days_per_week);

  return trainingDays.map((day, index) => {
    const program = selectedPrograms[index % selectedPrograms.length];
    const summary = program.summary;
    const sessionKey = `wiz_${summary?.id ?? "program"}_${index + 1}_${seed.slice(0, 6)}`;

    return {
      date: nextDateForDay(day as (typeof dayOptions)[number]),
      label: `${summary?.name ?? "Program"} — ${day}`,
      program_session_key: sessionKey,
      template_id: program.template_id,
      focus: summary?.focusHint ?? "Training session"
    };
  });
};

export const buildActiveProgramSnapshot = (
  payload: WizardPayload,
  templates: TemplateData[]
): { preview: PreviewResult; schedule: PlannedSession[]; snapshot: ActiveProgramSnapshot } => {
  const summaries = templates.map((template) => summarizeTemplate(template));
  const preview = buildPreview(payload, templates);
  const schedule = buildSchedule(payload, summaries, preview.seed);
  const decisions: string[] = [
    `Selected templates: ${summaries.map((summary) => summary.name).join(", ")}`,
    `Days per week: ${payload.days_per_week}`,
    `Preferred days: ${(payload.preferred_days ?? []).join(", ") || "auto-assigned"}`,
    `Fatigue profile: ${payload.fatigue_profile}`
  ];

  const snapshot: ActiveProgramSnapshot = {
    seed: preview.seed,
    generated_at: new Date().toISOString(),
    fatigue_profile: payload.fatigue_profile,
    equipment_profile: payload.equipment_profile ?? [],
    days_per_week: payload.days_per_week,
    max_session_minutes: payload.max_session_minutes,
    preferred_days: payload.preferred_days ?? [],
    injuries: payload.injuries,
    selected_programs: payload.selected_programs,
    schedule,
    decisions_log: decisions,
    preview
  };

  return { preview, schedule, snapshot };
};
