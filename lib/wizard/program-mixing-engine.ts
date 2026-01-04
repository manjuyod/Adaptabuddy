import { createHash } from "crypto";
import { dayOptions } from "./schemas";
import { parseIsoDate } from "./engine";
import {
  normalizeTemplateJson,
  programTemplateSchema,
  type ProgramTemplateV1
} from "./template-normalization";
import type { Database } from "../supabase/server";
import type {
  ActiveProgramSnapshot,
  FatigueProfile,
  PlannedSession,
  PoolPreference,
  PreviewResult,
  PreviewWarning,
  ResolvedSlot,
  SessionPlan,
  WizardInjury,
  WizardPayload
} from "./types";

type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];
type MuscleGroupRow = Database["public"]["Tables"]["muscle_groups"]["Row"];

export type NormalizedProgramTemplate = ProgramTemplateV1 & { id: number };

export type MixingPlan = {
  seed: string;
  planId: string;
  weekKey: string;
  sessionPlans: SessionPlan[];
  schedule: PlannedSession[];
  preview: PreviewResult;
  decisions: string[];
};

const fatigueLoadThreshold: Record<FatigueProfile, number> = {
  low: 65,
  medium: 75,
  high: 85
};

const fatigueBudget: Record<FatigueProfile, number> = {
  low: 70,
  medium: 90,
  high: 110
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

const normalize = (value: string | null | undefined) => value?.toLowerCase().trim() ?? "";

const parseWeeklyGoal = (goal: unknown): { sets: number; priority: number } => {
  if (!isRecord(goal)) return { sets: 0, priority: 1 };
  const sets = (goal as { sets?: unknown }).sets;
  const priority = (goal as { priority?: unknown }).priority;
  return {
    sets: typeof sets === "number" ? sets : 0,
    priority: typeof priority === "number" ? priority : 1
  };
};

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

const startOfWeekIso = (value: Date): string => {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const weekday = date.getUTCDay();
  const diff = (weekday + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return toIsoDate(date);
};

const nextDateForDay = (dayName: (typeof dayOptions)[number]): string => {
  const today = new Date();
  const target = dayIndexMap[dayName];
  const current = today.getUTCDay();
  const delta = (target - current + 7) % 7 || 7;
  const scheduled = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  scheduled.setUTCDate(scheduled.getUTCDate() + delta);
  return scheduled.toISOString().slice(0, 10);
};

const deriveWeekKeyFromSchedule = (schedule: PlannedSession[]): string => {
  if (schedule.length === 0) return startOfWeekIso(new Date());
  const earliest = schedule.reduce((candidate, session) =>
    session.date < candidate.date ? session : candidate
  );
  const parsed = parseIsoDate(earliest.date);
  return startOfWeekIso(parsed ?? new Date());
};

const pickTrainingDays = (
  preferred: string[] | readonly string[] | undefined,
  count: number
): (typeof dayOptions)[number][] => {
  const fallbacks: (typeof dayOptions)[number][] = [
    "Mon",
    "Wed",
    "Fri",
    "Tue",
    "Thu",
    "Sat",
    "Sun"
  ];

  const pool = [...(preferred ?? []), ...fallbacks];
  const days: (typeof dayOptions)[number][] = [];

  for (const day of pool) {
    if (days.length >= count) break;
    if (dayOptions.includes(day as (typeof dayOptions)[number])) {
      const typedDay = day as (typeof dayOptions)[number];
      if (!days.includes(typedDay)) {
        days.push(typedDay);
      }
    }
  }

  return days.slice(0, count);
};

const seededNumber = (seed: string, key: string): number => {
  const hash = createHash("sha256")
    .update(`${seed}:${key}`)
    .digest("hex")
    .slice(0, 8);
  const int = parseInt(hash, 16);
  return (int % 10000) / 10000;
};

const seededInt = (seed: string, key: string, min: number, max: number): number => {
  const raw = seededNumber(seed, key);
  return Math.floor(raw * (max - min + 1)) + min;
};

const average = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const recoveryLoadScore = (
  totalSets: number,
  payload: { days_per_week: number; fatigue_profile: FatigueProfile },
  removedSlots: number
): number => {
  const volumeScore = totalSets / Math.max(payload.days_per_week, 1);
  const fatigueLoadMultiplier: Record<FatigueProfile, number> = {
    low: 0.9,
    medium: 1,
    high: 1.1
  };
  return Math.min(
    100,
    Math.round(
      (volumeScore * 2.8 + payload.days_per_week * 6 + removedSlots * 3) *
        fatigueLoadMultiplier[payload.fatigue_profile]
    )
  );
};

const expandEquipmentProfile = (equipment: string[] | null | undefined) => {
  if (!equipment || equipment.length === 0) return null;
  const set = new Set<string>(["bodyweight"]);
  for (const item of equipment) {
    const normalizedItem = normalize(item);
    if (!normalizedItem) continue;
    set.add(normalizedItem);
  }
  return set;
};

const equipmentAllowed = (
  exerciseEquipment: string[] | null | undefined,
  available: Set<string> | null
): boolean => {
  if (!available) return true;
  const normalized = (exerciseEquipment ?? [])
    .map((item) => normalize(item).replace(/s$/, ""))
    .filter(Boolean);
  if (normalized.length === 0) return true;
  return normalized.some((item) => available.has(item));
};

const parseContraindications = (
  value: unknown
): { muscle_group_ids: number[]; replace: number; avoid: number }[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const target = (entry as { target?: unknown }).target;
      const replace = (entry as { replace_severity_min?: unknown }).replace_severity_min;
      const avoid = (entry as { avoid_severity_min?: unknown }).avoid_severity_min;
      const muscleIds = Array.isArray((target as { muscle_group_ids?: unknown })?.muscle_group_ids)
        ? ((target as { muscle_group_ids?: unknown })?.muscle_group_ids as unknown[])
            .map((id) => (typeof id === "number" ? id : null))
            .filter((id): id is number => id !== null)
        : [];
      return {
        muscle_group_ids: muscleIds,
        replace: typeof replace === "number" ? replace : 4,
        avoid: typeof avoid === "number" ? avoid : 5
      };
    })
    .filter(Boolean) as { muscle_group_ids: number[]; replace: number; avoid: number }[];
};

const mapInjuryToMuscles = (
  injuries: WizardInjury[],
  muscleGroups: MuscleGroupRow[]
): Map<number, number> => {
  const map = new Map<number, number>();
  const idBySlug = new Map<string, number>();
  muscleGroups.forEach((group) => {
    if (typeof group.slug === "string" && typeof group.id === "number") {
      idBySlug.set(normalize(group.slug), group.id);
    }
  });

  injuries.forEach((injury) => {
    const name = normalize(injury.name);
    const severity = injury.severity ?? 0;
    if (!name || severity <= 0) return;
    idBySlug.forEach((id, slug) => {
      if (name.includes(slug) || slug.includes(name)) {
        const prev = map.get(id) ?? 0;
        map.set(id, Math.max(prev, severity));
      }
    });
  });

  return map;
};

const violatesInjuryRule = (
  exercise: ExerciseRow,
  injuryMap: Map<number, number>
): boolean => {
  const rules = parseContraindications(exercise.contraindications);
  if (rules.length === 0) return false;
  for (const rule of rules) {
    for (const muscleId of rule.muscle_group_ids) {
      const severity = injuryMap.get(muscleId);
      if (severity && (severity >= rule.replace || severity >= rule.avoid)) {
        return true;
      }
    }
  }
  return false;
};

const deriveInjuriesVersion = (injuries: WizardInjury[]) =>
  createHash("sha256")
    .update(
      JSON.stringify(
        injuries
          .map((injury) => ({ name: injury.name, severity: injury.severity }))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    )
    .digest("hex")
    .slice(0, 10);

const deriveSeed = (params: {
  payload: WizardPayload;
  weekKey: string;
  templates: NormalizedProgramTemplate[];
}): string => {
  const programIds = params.templates.map((template) => template.id).sort((a, b) => a - b);
  const seedSalt = params.templates
    .map((template) => template.seed_salt ?? "")
    .filter(Boolean)
    .sort()
    .join("|");
  const injuriesVersion = deriveInjuriesVersion(params.payload.injuries ?? []);
  return createHash("sha256")
    .update(
      [
        params.payload.user_id,
        params.weekKey,
        params.payload.fatigue_profile,
        programIds.join(","),
        injuriesVersion,
        seedSalt
      ].join("|")
    )
    .digest("hex")
    .slice(0, 16);
};

const derivePlanId = (seed: string): string =>
  createHash("sha256").update(seed).digest("hex").slice(0, 32);

const aggregatePolicy = (
  templates: NormalizedProgramTemplate[],
  weights: Map<number, number>
) => {
  let total = 0;
  let sumTopK = 0;
  let sumTemp = 0;
  let sumNovelty = 0;

  templates.forEach((template) => {
    const weight = weights.get(template.id) ?? template.program_weight_default ?? 1;
    total += weight;
    sumTopK += (template.selection_policy?.top_k ?? 6) * weight;
    sumTemp += (template.selection_policy?.softmax_temperature ?? 0.9) * weight;
    sumNovelty += (template.selection_policy?.novelty_decay ?? 0.35) * weight;
  });

  const divisor = total || 1;
  return {
    top_k: Math.max(1, Math.round(sumTopK / divisor)),
    softmax_temperature: sumTemp / divisor,
    novelty_decay: sumNovelty / divisor
  };
};

const computeWeeklyBudget = (payload: WizardPayload): number => {
  const base = fatigueBudget[payload.fatigue_profile];
  const timeFactor = ((payload.max_session_minutes ?? 60) / 60);
  return base * Math.max(1, payload.days_per_week / 3) * timeFactor;
};

const scoreCoverage = (
  remaining: number,
  target: number,
  priority: number
): number => {
  if (target <= 0) return 0;
  return (remaining / target) * priority;
};

const buildWeeklyDemand = (
  templates: NormalizedProgramTemplate[],
  weights: Map<number, number>
) => {
  const movement = new Map<string, { target: number; priority: number; remaining: number }>();
  const muscles = new Map<string, { target: number; priority: number; remaining: number }>();

  templates.forEach((template) => {
    const weight = weights.get(template.id) ?? template.program_weight_default ?? 1;
    Object.entries(template.weekly_goals.movement_patterns ?? {}).forEach(([key, goal]) => {
      const { sets, priority } = parseWeeklyGoal(goal);
      const normalizedKey = normalize(key);
      const targetSets = sets * weight;
      if (!movement.has(normalizedKey)) {
        movement.set(normalizedKey, {
          target: 0,
          priority,
          remaining: 0
        });
      }
      const entry = movement.get(normalizedKey);
      if (entry) {
        entry.target += targetSets;
        entry.remaining += targetSets;
        entry.priority = average([entry.priority, priority]);
      }
    });

    Object.entries(template.weekly_goals.muscle_groups ?? {}).forEach(([key, goal]) => {
      const { sets, priority } = parseWeeklyGoal(goal);
      const normalizedKey = normalize(key);
      const targetSets = sets * weight;
      if (!muscles.has(normalizedKey)) {
        muscles.set(normalizedKey, { target: 0, priority, remaining: 0 });
      }
      const entry = muscles.get(normalizedKey);
      if (entry) {
        entry.target += targetSets;
        entry.remaining += targetSets;
        entry.priority = average([entry.priority, priority]);
      }
    });
  });

  return { movement, muscles };
};

type SlotRequest = {
  templateId: number;
  slot_key: string;
  movement_pattern: string;
  sets: number;
  priority: number;
  reps_hint: [number, number];
  rpe_hint: [number, number];
  recovery_cost_per_set: number;
  pool_key?: string;
  required?: boolean;
};

const buildSlotRequests = (
  templates: NormalizedProgramTemplate[],
  weights: Map<number, number>,
  seed: string
): SlotRequest[] => {
  const requests: SlotRequest[] = [];
  templates.forEach((template) => {
    const weight = weights.get(template.id) ?? template.program_weight_default ?? 1;
    template.slot_blueprints.forEach((slot) => {
      const avgSets = Math.round((slot.min_sets + slot.max_sets) / 2);
      const weightedSets = Math.round(avgSets * weight);
      const sets = Math.min(slot.max_sets, Math.max(slot.min_sets, weightedSets));
      const jitter = seededInt(seed, `${template.id}_${slot.slot_key}`, 0, 1);
      const finalSets = Math.min(slot.max_sets, sets + jitter);
      requests.push({
        templateId: template.id,
        slot_key: `${template.id}_${slot.slot_key}`,
        movement_pattern: slot.movement_pattern,
        sets: finalSets,
        priority: (slot.priority ?? 1) * weight,
        reps_hint: slot.reps_hint ?? [6, 10],
        rpe_hint: slot.rpe_hint ?? [6, 9],
        recovery_cost_per_set: slot.recovery_cost_per_set ?? 2.5,
        pool_key: slot.pool_key,
        required: slot.required ?? false
      });
    });
  });
  return requests;
};

type DaySlotPlan = {
  slot: SlotRequest;
  sets: number;
  skip_reason?: string;
};

const allocateSlotsToDays = (params: {
  slots: SlotRequest[];
  demand: ReturnType<typeof buildWeeklyDemand>;
  budget: number;
  trainingDays: (typeof dayOptions)[number][];
}) => {
  const dayPlans: { slots: DaySlotPlan[]; recovery: number }[] = params.trainingDays.map(() => ({
    slots: [],
    recovery: 0
  }));
  let removedSlots = 0;

  const totalDemand = params.demand;

  const orderedSlots = [...params.slots].sort((a, b) => b.priority - a.priority);

  orderedSlots.forEach((slot) => {
    const baseCost = slot.recovery_cost_per_set ?? 2.5;
    const bestDayIndex = dayPlans.reduce(
      (best, plan, index) => (plan.recovery < dayPlans[best].recovery ? index : best),
      0
    );
    const dayPlan = dayPlans[bestDayIndex];
    const remainingBudget = Math.max(0, params.budget - dayPlans.reduce((sum, plan) => sum + plan.recovery, 0));
    const allowedSets =
      remainingBudget >= baseCost ? Math.min(slot.sets, Math.floor(remainingBudget / baseCost)) : 0;

    const demandEntry = totalDemand.movement.get(normalize(slot.movement_pattern));
    const demandRemaining = demandEntry?.remaining ?? slot.sets;
    const targetSets = Math.min(allowedSets, demandRemaining);

    if (targetSets <= 0 && slot.required) {
      removedSlots += 1;
      dayPlan.slots.push({ slot, sets: 0, skip_reason: "recovery_budget" });
      return;
    }

    const finalSets = Math.max(0, targetSets);
    if (finalSets <= 0) {
      removedSlots += 1;
      dayPlan.slots.push({ slot, sets: 0, skip_reason: "recovery_budget" });
      return;
    }

    if (demandEntry) {
      demandEntry.remaining = Math.max(0, demandEntry.remaining - finalSets);
    }

    dayPlan.slots.push({ slot, sets: finalSets });
    dayPlan.recovery += finalSets * baseCost;
  });

  return { dayPlans, removedSlots };
};

const softmaxPick = (
  candidates: { score: number; exercise: ExerciseRow }[],
  temperature: number,
  seed: string
): ExerciseRow => {
  const safeTemp = Math.max(0.1, temperature);
  const weights = candidates.map((candidate) => Math.exp(candidate.score / safeTemp));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const normalized = weights.map((weight) => weight / total);
  const roll = seededNumber(seed, `softmax_${candidates.map((c) => c.exercise.id).join("_")}`);
  let acc = 0;
  for (let i = 0; i < normalized.length; i++) {
    acc += normalized[i];
    if (roll <= acc) return candidates[i].exercise;
  }
  return candidates[candidates.length - 1].exercise;
};

const selectExerciseForSlot = (params: {
  slot: DaySlotPlan;
  available: Set<string> | null;
  exercises: ExerciseRow[];
  injuryMap: Map<number, number>;
  poolPreferences: Map<string, PoolPreference>;
  selectionPolicy: { top_k: number; softmax_temperature: number; novelty_decay: number };
  seed: string;
  demand: ReturnType<typeof buildWeeklyDemand>;
  muscleSlugById: Map<number, string>;
  usage: Map<number, number>;
}) => {
  const { slot } = params;
  const poolPreference = slot.slot.pool_key
    ? params.poolPreferences.get(slot.slot.pool_key)
    : undefined;
  const bannedNames = new Set((poolPreference?.banned ?? []).map((name) => normalize(name)));
  const pinned = poolPreference?.pinned ? normalize(poolPreference.pinned) : null;
  const slotKey = slot.slot.slot_key;

  const candidates = params.exercises.filter((exercise) => {
    if (normalize(exercise.movement_pattern) !== normalize(slot.slot.movement_pattern)) {
      return false;
    }
    if (!equipmentAllowed(exercise.equipment, params.available)) return false;
    if (violatesInjuryRule(exercise, params.injuryMap)) return false;
    if (bannedNames.has(normalize(exercise.canonical_name))) return false;

    const rawConstraints = (slot.slot as { constraints?: unknown }).constraints;
    const constraint = isRecord(rawConstraints) ? rawConstraints : null;
    if (constraint) {
      const avoidTags = Array.isArray(constraint.avoid_tags)
        ? (constraint.avoid_tags as unknown[]).map((tag) => normalize(String(tag)))
        : [];
      if (avoidTags.length > 0) {
        const exerciseTags = (exercise.tags ?? []).map(normalize);
        if (exerciseTags.some((tag) => avoidTags.includes(tag))) return false;
      }
      const requireEquipment = Array.isArray(constraint.require_equipment)
        ? (constraint.require_equipment as unknown[]).map((item) => normalize(String(item)))
        : [];
      if (requireEquipment.length > 0) {
        const exerciseEquipment = (exercise.equipment ?? []).map((item) => normalize(String(item)));
        if (!requireEquipment.every((req) => exerciseEquipment.includes(req))) return false;
      }
    }

    return true;
  });

  if (candidates.length === 0) {
    return {
      slot: {
        slot_key: slot.slot.slot_key,
        pool_key: slot.slot.pool_key ?? slot.slot.movement_pattern,
        exercise_id: null,
        exercise_name: slot.slot.pool_key ?? slot.slot.movement_pattern,
        movement_pattern: slot.slot.movement_pattern,
        primary_muscle_group_id: null,
        secondary_muscle_group_ids: [],
        tags: [],
        sets: slot.sets,
        reps: null,
        rir: null,
        rpe: null,
        optional: !slot.slot.required,
        skip_reason: slot.skip_reason ?? "no_candidate",
        applied_rules: []
      } satisfies ResolvedSlot,
      chosen: null,
      candidates: [] as { name: string; score: number }[]
    };
  }

  const pinnedCandidate = pinned
    ? candidates.find((exercise) => normalize(exercise.canonical_name) === pinned)
    : null;

  const demandMovement = params.demand.movement.get(normalize(slot.slot.movement_pattern));

  const scored = candidates.map((exercise) => {
    const primarySlug = exercise.primary_muscle_group_id
      ? params.muscleSlugById.get(exercise.primary_muscle_group_id)
      : null;
    const secondarySlugs = Array.isArray(exercise.secondary_muscle_group_ids)
      ? exercise.secondary_muscle_group_ids
          .map((id) => params.muscleSlugById.get(id))
          .filter(Boolean)
      : [];

    const muscleScores = [primarySlug, ...secondarySlugs].map((slug) => {
      if (!slug) return 0;
      const muscle = params.demand.muscles.get(normalize(slug));
      if (!muscle) return 0;
      return scoreCoverage(muscle.remaining, muscle.target, muscle.priority);
    });

    const coverageScore = scoreCoverage(
      demandMovement?.remaining ?? slot.slot.sets,
      demandMovement?.target ?? slot.slot.sets,
      demandMovement?.priority ?? 1
    );

    const hasValidId = typeof exercise.id === "number";
    const noveltyPenalty = hasValidId
      ? (params.usage.get(exercise.id) ?? 0) * (params.selectionPolicy.novelty_decay ?? 0.35)
      : 0;

    const baseScore =
      (slot.slot.priority ?? 1) * (1 + coverageScore + average(muscleScores)) -
      noveltyPenalty;

    const noise = seededNumber(params.seed, `${slotKey}_${exercise.id}`) * 0.05;
    return { exercise, score: baseScore + noise };
  });

  const topCandidates = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, params.selectionPolicy.top_k));

  const chosen =
    pinnedCandidate ??
    softmaxPick(topCandidates, params.selectionPolicy.softmax_temperature, `${params.seed}_${slotKey}`);

  const chosenScore = topCandidates.find((entry) => entry.exercise.id === chosen.id)?.score ?? 0;
  const decisionLog = topCandidates.map((entry) => ({
    name: entry.exercise.canonical_name,
    score: Number(entry.score.toFixed(3))
  }));

  const repsMid = Math.round(average(slot.slot.reps_hint ?? [6, 10]));
  const rpeMid = Math.round(average(slot.slot.rpe_hint ?? [6, 9]) * 10) / 10;

  if (typeof chosen.id === "number") {
    params.usage.set(chosen.id, (params.usage.get(chosen.id) ?? 0) + 1);
  }

  return {
    slot: {
      slot_key: slot.slot.slot_key,
      pool_key: slot.slot.pool_key ?? slot.slot.movement_pattern,
      exercise_id: chosen.id ?? null,
      exercise_name: chosen.canonical_name,
      movement_pattern: chosen.movement_pattern,
      primary_muscle_group_id:
        typeof chosen.primary_muscle_group_id === "number" ? chosen.primary_muscle_group_id : null,
      secondary_muscle_group_ids: Array.isArray(chosen.secondary_muscle_group_ids)
        ? chosen.secondary_muscle_group_ids.filter((id): id is number => typeof id === "number")
        : [],
      tags: Array.isArray(chosen.tags) ? chosen.tags : [],
      sets: slot.sets,
      reps: repsMid,
      rir: null,
      rpe: rpeMid,
      optional: !slot.slot.required,
      applied_rules: []
    } satisfies ResolvedSlot,
    chosen: { name: chosen.canonical_name, score: Number(chosenScore.toFixed(3)) },
    candidates: decisionLog
  };
};

const summarizePreview = (params: {
  sessionPlans: SessionPlan[];
  muscleGroups: MuscleGroupRow[];
  payload: WizardPayload;
  removedSlots: number;
  seed: string;
}): PreviewResult => {
  const idToRegion = new Map<number, string>();
  params.muscleGroups.forEach((group) => {
    if (typeof group.id === "number" && typeof group.region === "string") {
      idToRegion.set(group.id, group.region);
    }
  });

  const weeklySetsMap = new Map<string, number>();
  params.sessionPlans.forEach((plan) => {
    if (plan.week_offset !== 0) return;
    plan.slots.forEach((slot) => {
      if (slot.skip_reason) return;
      const sets = slot.sets ?? 0;
      const region = slot.primary_muscle_group_id
        ? idToRegion.get(slot.primary_muscle_group_id) ?? slot.movement_pattern ?? "Training"
        : slot.movement_pattern ?? "Training";
      weeklySetsMap.set(region, (weeklySetsMap.get(region) ?? 0) + sets);
    });
  });

  const weeklySets = Array.from(weeklySetsMap.entries()).map(([muscleGroup, sets]) => ({
    muscleGroup,
    sets
  }));

  const totalSets = weeklySets.reduce((sum, entry) => sum + entry.sets, 0);
  const recoveryLoad = recoveryLoadScore(
    totalSets,
    { days_per_week: params.payload.days_per_week, fatigue_profile: params.payload.fatigue_profile },
    params.removedSlots
  );

  const warnings: PreviewWarning[] = [];
  const underTargetGroups = weeklySets.filter((group) => group.sets < 10).length;
  if (underTargetGroups > 0) {
    warnings.push({
      type: "under_target",
      message: `${underTargetGroups} muscle groups under target`
    });
  }
  if (recoveryLoad > fatigueLoadThreshold[params.payload.fatigue_profile]) {
    warnings.push({
      type: "recovery_load",
      message: `Recovery load high for ${params.payload.fatigue_profile} fatigue profile`
    });
  }
  if (params.removedSlots > 0) {
    warnings.push({
      type: "injury_reduction",
      message: `Constraints removed ${params.removedSlots} slots`
    });
  }

  return {
    seed: params.seed,
    weeklySets,
    recoveryLoad,
    warnings,
    removedSlots: params.removedSlots
  };
};

export const normalizeProgramTemplates = (
  templates: { id: number; template_json: unknown; name?: string }[]
): NormalizedProgramTemplate[] => {
  const normalized: NormalizedProgramTemplate[] = [];
  templates.forEach((row) => {
    const parsed = normalizeTemplateJson(row.template_json, {
      fallbackName: row.name ?? "Template",
      defaultType: "program"
    });
    if (parsed?.type === "program") {
      const program = programTemplateSchema.parse(parsed.template);
      normalized.push({ ...program, id: row.id });
    }
  });
  return normalized;
};

export const previewPlan = (params: {
  payload: WizardPayload;
  templates: NormalizedProgramTemplate[];
  exercises: ExerciseRow[];
  muscleGroups: MuscleGroupRow[];
  weekKey?: string;
  planId?: string;
}): MixingPlan => {
  const { payload } = params;
  if (params.templates.length === 0) {
    throw new Error("No templates provided to mixing engine.");
  }

  const trainingDays = pickTrainingDays(payload.preferred_days, payload.days_per_week);
  const weekKey = params.weekKey ?? startOfWeekIso(new Date());
  const weights = new Map<number, number>();
  payload.selected_programs.forEach((program) => {
    const weight =
      program.weight_override ??
      params.templates.find((template) => template.id === program.template_id)?.program_weight_default ??
      1;
    weights.set(program.template_id, weight);
  });

  const seed = deriveSeed({ payload, weekKey, templates: params.templates });
  const planId = params.planId ?? derivePlanId(seed);
  const selectionPolicy = aggregatePolicy(params.templates, weights);
  const budget = computeWeeklyBudget(payload);
  const demand = buildWeeklyDemand(params.templates, weights);
  const availableEquipment = expandEquipmentProfile(payload.equipment_profile);
  const injuryMap = mapInjuryToMuscles(payload.injuries, params.muscleGroups);
  const slotRequests = buildSlotRequests(params.templates, weights, seed);

  const { dayPlans, removedSlots } = allocateSlotsToDays({
    slots: slotRequests,
    demand,
    budget,
    trainingDays
  });

  const poolPreferenceMap = new Map<string, PoolPreference>(
    (payload.pool_preferences ?? []).map((pref) => [pref.pool_key, pref])
  );
  const muscleSlugById = new Map<number, string>();
  params.muscleGroups.forEach((group) => {
    if (typeof group.id === "number" && typeof group.slug === "string") {
      muscleSlugById.set(group.id, normalize(group.slug));
    }
  });

  const sessionPlans: SessionPlan[] = [];
  const decisions: string[] = [];
  const usage = new Map<number, number>();
  const schedule: PlannedSession[] = [];

  dayPlans.forEach((plan, index) => {
    const dayName = trainingDays[index % trainingDays.length];
    const date = nextDateForDay(dayName);
    const program_session_key = `mix_${index + 1}_${planId.slice(0, 6)}_${seed.slice(0, 6)}`;
    const resolvedSlots: ResolvedSlot[] = [];
    plan.slots.forEach((slot) => {
      if (slot.skip_reason === "recovery_budget") {
        resolvedSlots.push({
          slot_key: slot.slot.slot_key,
          pool_key: slot.slot.pool_key ?? slot.slot.movement_pattern,
          exercise_id: null,
          exercise_name: slot.slot.pool_key ?? slot.slot.movement_pattern,
          movement_pattern: slot.slot.movement_pattern,
          primary_muscle_group_id: null,
          secondary_muscle_group_ids: [],
          tags: [],
          sets: slot.sets,
          reps: null,
          rir: null,
          rpe: null,
          optional: !slot.slot.required,
          skip_reason: slot.skip_reason,
          applied_rules: []
        });
        return;
      }

      const decision = selectExerciseForSlot({
        slot,
        available: availableEquipment,
        exercises: params.exercises,
        injuryMap,
        poolPreferences: poolPreferenceMap,
        selectionPolicy,
        seed,
        demand,
        muscleSlugById,
        usage
      });

      resolvedSlots.push(decision.slot);
      const candidateLog = decision.candidates
        .map((entry) => `${entry.name}:${entry.score}`)
        .join(", ");
      decisions.push(
        `slot:${slot.slot.slot_key} -> ${decision.chosen?.name ?? "none"} [${candidateLog}]`
      );
    });

    const focusMovement =
      plan.slots[0]?.slot.movement_pattern ??
      Object.keys(params.templates[0]?.weekly_goals?.movement_patterns ?? {})[0] ??
      "Training";
    const sessionTemplateId = plan.slots[0]?.slot.templateId ?? params.templates[0].id;
    const label = `${dayName} ${focusMovement}`;
    sessionPlans.push({
      template_id: sessionTemplateId,
      program_session_key,
      focus: focusMovement,
      label,
      week_offset: 0,
      slots: resolvedSlots
    });
    schedule.push({
      date,
      label,
      program_session_key,
      template_id: sessionTemplateId,
      focus: focusMovement,
      week: 0
    });
  });

  const preview = summarizePreview({
    sessionPlans,
    muscleGroups: params.muscleGroups,
    payload,
    removedSlots,
    seed
  });
  const weekKeyDerived = deriveWeekKeyFromSchedule(schedule);

  return {
    seed,
    planId,
    weekKey: weekKeyDerived,
    sessionPlans,
    schedule,
    preview,
    decisions
  };
};

export const generatePlan = (params: {
  payload: WizardPayload;
  templates: NormalizedProgramTemplate[];
  exercises: ExerciseRow[];
  muscleGroups: MuscleGroupRow[];
  weekKey?: string;
  planId?: string;
}): MixingPlan => previewPlan(params);

export const composeMixingSnapshot = (params: {
  payload: WizardPayload;
  plan: MixingPlan;
}): ActiveProgramSnapshot => {
  const decisions = [
    `Templates: ${params.payload.selected_programs.map((program) => program.template_id).join(", ")}`,
    `Days per week: ${params.payload.days_per_week}`,
    `Preferred days: ${(params.payload.preferred_days ?? []).join(", ") || "auto-assigned"}`,
    `Fatigue profile: ${params.payload.fatigue_profile}`,
    ...params.plan.decisions
  ];

  return {
    seed: params.plan.seed,
    seed_strategy: "mixing_v1",
    plan_id: params.plan.planId,
    week_key: params.plan.weekKey,
    restart_counter: 0,
    generated_at: new Date().toISOString(),
    fatigue_profile: params.payload.fatigue_profile,
    equipment_profile: params.payload.equipment_profile ?? [],
    days_per_week: params.payload.days_per_week,
    max_session_minutes: params.payload.max_session_minutes,
    preferred_days: params.payload.preferred_days ?? [],
    injuries: params.payload.injuries,
    selected_programs: params.payload.selected_programs,
    schedule: params.plan.schedule,
    decisions_log: decisions,
    preview: params.plan.preview,
    pool_preferences: params.payload.pool_preferences ?? [],
    weak_point_selection: params.payload.weak_point_selection ?? null,
    session_plans: params.plan.sessionPlans,
    week_rules: [],
    week_cursor: 0
  };
};
