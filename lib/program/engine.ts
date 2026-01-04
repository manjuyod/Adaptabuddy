import { createHash } from "crypto";
import {
  buildHypertrophyPlan,
  isHypertrophyTemplate,
  type HypertrophyTemplate
} from "@/lib/wizard/hypertrophy-engine";
import { dayOptions } from "@/lib/wizard/schemas";
import type {
  ActiveProgramSnapshot,
  EquipmentOption,
  FatigueProfile,
  PlannedSession,
  PoolPreference,
  ProgramPerformanceCache,
  ResolvedSlot,
  SessionPlan,
  WeakPointSelection,
  WeekRule,
  WizardInjury
} from "@/lib/wizard/types";
import type { Database } from "../supabase/server";

type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];
type MuscleGroupRow = Database["public"]["Tables"]["muscle_groups"]["Row"];

export type EngineWeekRule = WeekRule;

export type EnginePhase = {
  key: string;
  weeks: number;
  deload_after?: number;
  rules?: EngineWeekRule[];
};

export type EngineTemplate =
  | (HypertrophyTemplate & {
      phases?: EnginePhase[];
      week_rules?: EngineWeekRule[];
    })
  | {
      weeks?: number;
      sessions?: SessionPlan[];
      template_type?: string;
    };

export type PerformanceSample = {
  exercise_key: string;
  avg_rpe?: number | null;
  avg_rir?: number | null;
  pain?: number | null;
  sets: number;
  session_date: string;
};

export type PerformanceCache = ProgramPerformanceCache;

export type AutoRegulationAdjustment = {
  rpeDelta?: number;
  setScale?: number;
  reason: string;
};

export type AutoRegulationPlan = Record<string, AutoRegulationAdjustment>;

type ResolveParams = {
  template: EngineTemplate;
  templateId: number;
  exercises: ExerciseRow[];
  muscleGroups: MuscleGroupRow[];
  payload: {
    days_per_week: number;
    fatigue_profile: FatigueProfile;
    preferred_days?: string[];
    equipment_profile?: EquipmentOption[] | readonly EquipmentOption[];
    pool_preferences?: PoolPreference[];
    max_session_minutes?: number;
    injuries: WizardInjury[];
    weak_point_selection?: WeakPointSelection | null;
  };
  seed: string;
  planId?: string;
  poolPreferenceOverride?: PoolPreference[];
};

export type GenerateScheduleResult = {
  sessionPlans: SessionPlan[];
  schedule: PlannedSession[];
  weekRules: EngineWeekRule[];
  planId: string;
  weekKey: string;
  decisions: string[];
  preview: {
    recoveryLoad: number;
    removedSlots: number;
    weeklySets: { muscleGroup: string; sets: number }[];
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

const parseIsoDate = (value: string): Date | null => {
  const parts = value.split("-").map((entry) => Number(entry));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
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

const nextDateForDay = (dayName: (typeof dayOptions)[number]): string => {
  const today = new Date();
  const target = dayIndexMap[dayName];
  const current = today.getUTCDay();
  const delta = (target - current + 7) % 7 || 7;
  const scheduled = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  scheduled.setUTCDate(scheduled.getUTCDate() + delta);
  return scheduled.toISOString().slice(0, 10);
};

const dateForWeekKey = (weekKey: string, dayName: (typeof dayOptions)[number]): string => {
  const base = parseIsoDate(weekKey);
  if (!base) return nextDateForDay(dayName);
  const offset = (dayIndexMap[dayName] - base.getUTCDay() + 7) % 7;
  const target = new Date(base);
  target.setUTCDate(base.getUTCDate() + offset);
  return toIsoDate(target);
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

const deriveWeekKeyFromSchedule = (schedule: PlannedSession[]): string => {
  if (schedule.length === 0) return startOfWeekIso(new Date());
  const earliest = schedule.reduce((candidate, session) =>
    session.date < candidate.date ? session : candidate
  );
  const parsed = parseIsoDate(earliest.date);
  return parsed ? startOfWeekIso(parsed) : startOfWeekIso(new Date());
};

const recoveryLoadFromSets = (totalSets: number, payload: ResolveParams["payload"], removedSlots: number) => {
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const applyWeekRules = (params: {
  sessionPlans: SessionPlan[];
  weekRule: EngineWeekRule;
  autoRegulation?: AutoRegulationPlan;
  substitutionPool?: Map<string, string>;
}): SessionPlan[] => {
  const { sessionPlans, weekRule, autoRegulation, substitutionPool } = params;
  return sessionPlans.map((plan) => {
    const adjustedSlots: ResolvedSlot[] = plan.slots.map((slot) => {
      const applied: string[] = [];
      let sets = typeof slot.sets === "number" ? slot.sets : undefined;
      let rpe = typeof slot.rpe === "number" ? slot.rpe : null;

      if (weekRule.volume_multiplier && sets) {
        sets = Math.max(1, Math.round(sets * weekRule.volume_multiplier));
        applied.push(`volume_x${weekRule.volume_multiplier}`);
      }

      if (weekRule.deload && sets) {
        sets = Math.max(1, Math.round(sets * 0.6));
        rpe = typeof rpe === "number" ? Math.min(rpe, weekRule.rpe_ceiling ?? 7.5) : rpe;
        applied.push("deload");
      }

      if (typeof rpe === "number" && typeof weekRule.rpe_floor === "number") {
        rpe = Math.max(rpe, weekRule.rpe_floor);
        applied.push(`rpe_floor_${weekRule.rpe_floor}`);
      }

      if (typeof rpe === "number" && typeof weekRule.rpe_ceiling === "number") {
        rpe = Math.min(rpe, weekRule.rpe_ceiling);
        applied.push(`rpe_cap_${weekRule.rpe_ceiling}`);
      }

      const exerciseKey = `${plan.program_session_key}_${slot.slot_key}`;
      const auto = autoRegulation ? autoRegulation[exerciseKey] : undefined;
      if (auto) {
        if (typeof auto.setScale === "number" && sets) {
          sets = Math.max(1, Math.round(sets * auto.setScale));
          applied.push(`auto_sets_x${auto.setScale}`);
        }
        if (typeof auto.rpeDelta === "number" && typeof rpe === "number") {
          rpe = clamp(rpe + auto.rpeDelta, 5, 10);
          applied.push(`auto_rpe_${auto.rpeDelta > 0 ? "up" : "down"}`);
        }
      }

      const substitution = substitutionPool
        ? substitutionPool.get(slot.slot_key) ?? substitutionPool.get(exerciseKey)
        : null;
      const baseSlot: ResolvedSlot = {
        ...slot,
        sets,
        rpe,
        applied_rules: applied.length > 0 ? applied : slot.applied_rules
      };
      if (substitution) {
        return {
          ...baseSlot,
          skip_reason: slot.skip_reason ?? "substituted",
          exercise_name: substitution
        };
      }
      return baseSlot;
    });

    return { ...plan, slots: adjustedSlots };
  });
};

const summarizeWeeklySets = (sessionPlans: SessionPlan[]) => {
  const muscleGroupTotals = new Map<string, number>();
  sessionPlans.forEach((plan) => {
    plan.slots.forEach((slot) => {
      if (slot.skip_reason) return;
      const sets = typeof slot.sets === "number" ? slot.sets : 0;
      const key = slot.movement_pattern ?? "Training";
      muscleGroupTotals.set(key, (muscleGroupTotals.get(key) ?? 0) + sets);
    });
  });
  return Array.from(muscleGroupTotals.entries()).map(([muscleGroup, sets]) => ({
    muscleGroup,
    sets
  }));
};

export const resolveSlots = (params: ResolveParams): {
  sessionPlans: SessionPlan[];
  removedSlots: number;
  previewSets: { muscleGroup: string; sets: number }[];
} => {
  if (isHypertrophyTemplate(params.template)) {
    const equipmentProfile = params.payload.equipment_profile
      ? [...params.payload.equipment_profile]
      : undefined;

    const plan = buildHypertrophyPlan({
      template: params.template,
      templateId: params.templateId,
      exercises: params.exercises,
      muscleGroups: params.muscleGroups,
      payload: {
        days_per_week: params.payload.days_per_week,
        fatigue_profile: params.payload.fatigue_profile,
        max_session_minutes: params.payload.max_session_minutes,
        preferred_days: params.payload.preferred_days,
        equipment_profile: equipmentProfile,
        pool_preferences: params.poolPreferenceOverride ?? params.payload.pool_preferences,
        weak_point_selection: params.payload.weak_point_selection ?? null
      },
      injuries: params.payload.injuries,
      seed: params.seed,
      planId: params.planId
    });
    const previewSets = summarizeWeeklySets(plan.sessionPlans.filter((session) => session.week_offset === 0));
    return { sessionPlans: plan.sessionPlans, removedSlots: plan.preview.removedSlots, previewSets };
  }

  // Fallback: treat template.sessions as already resolved slots
  const sessions = Array.isArray((params.template as { sessions?: unknown }).sessions)
    ? ((params.template as { sessions: SessionPlan[] }).sessions ?? [])
    : [];

  const weeks = Math.max(1, params.template.weeks ?? 4);
  const trainingDays = pickTrainingDays(params.payload.preferred_days, params.payload.days_per_week);

  const sessionPlans: SessionPlan[] = [];
  let removedSlots = 0;
  for (let week = 0; week < weeks; week++) {
    trainingDays.forEach((day, index) => {
      const base = sessions[index % sessions.length];
      const planKey = base?.program_session_key
        ? `${base.program_session_key}_w${week + 1}`
        : `plan_${params.templateId}_${week + 1}_${day.toLowerCase()}_${params.seed.slice(0, 6)}`;
      const slots = Array.isArray(base?.slots) ? base.slots : [];
      const slotCopies = slots.map((slot) => ({ ...slot, applied_rules: [] as string[] }));
      removedSlots += slotCopies.filter((slot) => slot.skip_reason).length;
      sessionPlans.push({
        template_id: params.templateId,
        program_session_key: planKey,
        focus: base?.focus ?? "Training",
        label: base?.label ?? `${day} Session`,
        week_offset: week,
        slots: slotCopies
      });
    });
  }
  const previewSets = summarizeWeeklySets(sessionPlans.filter((session) => session.week_offset === 0));
  return { sessionPlans, removedSlots, previewSets };
};

const expandWeekRules = (template: EngineTemplate, totalWeeks: number): EngineWeekRule[] => {
  const rules: EngineWeekRule[] = [];
  const phases = Array.isArray((template as { phases?: unknown }).phases)
    ? ((template as { phases: EnginePhase[] }).phases ?? [])
    : [];

  if (phases.length > 0) {
    let cursor = 0;
    phases.forEach((phase: EnginePhase) => {
      for (let i = 0; i < phase.weeks; i++) {
        const phaseRule = phase.rules?.find((rule: EngineWeekRule) => rule.week === i + 1);
        rules.push({
          week: cursor + i + 1,
          volume_multiplier: phaseRule?.volume_multiplier ?? 1,
          rpe_ceiling: phaseRule?.rpe_ceiling ?? (phase.deload_after && i + 1 === phase.deload_after ? 7.5 : 9),
          rpe_floor: phaseRule?.rpe_floor ?? 6,
          deload: phaseRule?.deload ?? false,
          note: phaseRule?.note ?? phase.key
        });
      }
      cursor += phase.weeks;
    });
  }

  const weekRules = Array.isArray((template as { week_rules?: unknown }).week_rules)
    ? ((template as { week_rules: EngineWeekRule[] }).week_rules ?? [])
    : [];

  if (rules.length === 0 && weekRules.length > 0) {
    weekRules.forEach((rule: EngineWeekRule) => {
      rules.push({ ...rule });
    });
  }

  if (rules.length === 0) {
    for (let i = 0; i < totalWeeks; i++) {
      rules.push({
        week: i + 1,
        volume_multiplier: i === 4 ? 0.75 : 1,
        rpe_ceiling: i === 4 ? 7.5 : 9,
        rpe_floor: 6,
        deload: i === 4
      });
    }
  }

  while (rules.length < totalWeeks) {
    const last = rules[rules.length - 1];
    rules.push({ ...last, week: rules.length + 1 });
  }

  return rules.slice(0, totalWeeks);
};

const applyTrainingDates = (params: {
  weekPlans: SessionPlan[];
  trainingDays: (typeof dayOptions)[number][];
  startWeekKey?: string;
}) => {
  const { weekPlans, trainingDays, startWeekKey } = params;
  const schedule: PlannedSession[] = [];
  const byWeek = new Map<number, SessionPlan[]>();
  weekPlans.forEach((plan) => {
    const week = plan.week_offset ?? 0;
    if (!byWeek.has(week)) byWeek.set(week, []);
    byWeek.get(week)?.push(plan);
  });

  const weekKeys: string[] = [];
  const baseKey =
    startWeekKey && parseIsoDate(startWeekKey) ? startWeekKey : startOfWeekIso(new Date());

  const parsed = parseIsoDate(baseKey) ?? new Date();
  const baseWeekStart = startOfWeekIso(parsed);

  for (const [week] of byWeek.entries()) {
    const offset = week * 7;
    const weekStart = parseIsoDate(baseWeekStart) ?? new Date();
    weekStart.setUTCDate(weekStart.getUTCDate() + offset);
    weekKeys[week] = toIsoDate(weekStart);
  }

  byWeek.forEach((plans, weekIndex) => {
    plans.forEach((plan, planIndex) => {
      const dayName = trainingDays[planIndex % trainingDays.length];
      const weekKey = weekKeys[weekIndex] ?? baseWeekStart;
      const date = dateForWeekKey(weekKey, dayName);
      schedule.push({
        date,
        label: plan.label,
        program_session_key: plan.program_session_key,
        template_id: plan.template_id,
        focus: plan.focus,
        week: weekIndex
      });
    });
  });

  return { schedule, week_key: deriveWeekKeyFromSchedule(schedule) };
};

export const generateSchedule = (
  params: ResolveParams & {
    startWeek?: number;
    weeksToBuild?: number;
    startWeekKey?: string;
    applyRules?: boolean;
  }
): GenerateScheduleResult => {
  const weeks = params.weeksToBuild ?? Math.max(1, params.template.weeks ?? 4);
  const trainingDays = pickTrainingDays(params.payload.preferred_days, params.payload.days_per_week);
  const { sessionPlans, removedSlots, previewSets } = resolveSlots(params);
  const weekRules = expandWeekRules(params.template, weeks + (params.startWeek ?? 0));

  let plansForWindow = sessionPlans.filter(
    (plan) => (plan.week_offset ?? 0) >= (params.startWeek ?? 0) &&
      (plan.week_offset ?? 0) < (params.startWeek ?? 0) + weeks
  );

  if (plansForWindow.length === 0 && sessionPlans.length > 0) {
    const templateWeeks =
      sessionPlans.reduce((max, plan) => Math.max(max, plan.week_offset ?? 0), 0) + 1;
    const normalizedWeek = params.startWeek ?? 0;
    const templateWeek = templateWeeks > 0 ? normalizedWeek % templateWeeks : 0;
    const basePlans = sessionPlans.filter(
      (plan) => (plan.week_offset ?? 0) === templateWeek
    );
    plansForWindow = basePlans.map((plan) => ({
      ...plan,
      week_offset: normalizedWeek
    }));
  }

  const adjustedPlans =
    params.applyRules === false
      ? plansForWindow
      : plansForWindow.map((plan) => {
          const weekRule = weekRules[(plan.week_offset ?? 0)] ?? weekRules[0];
          const applied = applyWeekRules({
            sessionPlans: [plan],
            weekRule
          });
          return { ...applied[0], week_offset: plan.week_offset };
        });

  const { schedule, week_key } = applyTrainingDates({
    weekPlans: adjustedPlans,
    trainingDays,
    startWeekKey: params.startWeekKey
  });

  const planId =
    params.planId ??
    createHash("sha256")
      .update(`${params.seed}-${params.startWeek ?? 0}-${weeks}`)
      .digest("hex")
      .slice(0, 32);
  const previewTotalSets = previewSets.reduce((sum, entry) => sum + entry.sets, 0);
  const recoveryLoad = recoveryLoadFromSets(previewTotalSets, params.payload, removedSlots);
  const decisions = [
    `Week rules applied: ${weekRules.length}`,
    `Training days: ${trainingDays.join(", ")}`
  ];

  return {
    sessionPlans: adjustedPlans.map((plan) => ({ ...plan, program_session_key: plan.program_session_key })),
    schedule,
    weekRules,
    planId,
    weekKey: week_key,
    decisions,
    preview: {
      recoveryLoad,
      removedSlots,
      weeklySets: previewSets
    }
  };
};

const buildPerformanceCache = (
  samples: PerformanceSample[],
  previous?: PerformanceCache
): PerformanceCache => {
  const cache: PerformanceCache = { ...(previous ?? {}) };
  samples.forEach((sample) => {
    const prev = cache[sample.exercise_key];
    const nextSamples = (prev?.samples ?? 0) + 1;
    cache[sample.exercise_key] = {
      avg_rpe:
        sample.avg_rpe !== undefined && sample.avg_rpe !== null
          ? sample.avg_rpe
          : prev?.avg_rpe,
      avg_rir:
        sample.avg_rir !== undefined && sample.avg_rir !== null
          ? sample.avg_rir
          : prev?.avg_rir,
      pain: sample.pain ?? prev?.pain,
      last_session: sample.session_date,
      samples: nextSamples
    };
  });
  return cache;
};

const deriveAutoRegulation = (
  plans: SessionPlan[],
  samples: PerformanceSample[]
): AutoRegulationPlan => {
  const planByKey = new Map<string, ResolvedSlot>();
  plans.forEach((plan) => {
    plan.slots.forEach((slot) => {
      const key = `${plan.program_session_key}_${slot.slot_key}`;
      planByKey.set(key, slot);
    });
  });

  const auto: AutoRegulationPlan = {};
  samples.forEach((sample) => {
    const target = planByKey.get(sample.exercise_key);
    if (!target) return;
    if (typeof target.rpe !== "number") return;
    if (typeof sample.avg_rpe !== "number") return;
    const delta = sample.avg_rpe - target.rpe;
    if (delta > 0.5) {
      auto[sample.exercise_key] = { rpeDelta: -0.5, reason: "overshoot" };
    } else if (delta < -1) {
      auto[sample.exercise_key] = { rpeDelta: 0.5, reason: "undershoot" };
    }
  });
  return auto;
};

const fatigueFlag = (history: { week: string; sets: number }[]): boolean => {
  if (history.length < 2) return false;
  const sorted = [...history].sort((a, b) => (a.week < b.week ? -1 : 1));
  const latest = sorted[sorted.length - 1];
  const prior = sorted.slice(0, -1);
  const avg = prior.reduce((sum, entry) => sum + entry.sets, 0) / Math.max(prior.length, 1);
  if (avg <= 0) return false;
  return latest.sets > avg * 1.25;
};

export const adaptNextWeek = (params: {
  activeProgram: ActiveProgramSnapshot;
  template: EngineTemplate;
  templateId: number;
  performance: PerformanceSample[];
  fatigueHistory?: { week: string; sets: number }[];
  payload: ResolveParams["payload"];
  exercises: ExerciseRow[];
  muscleGroups: MuscleGroupRow[];
  seed: string;
}): {
  nextWeekRule: EngineWeekRule;
  autoRegulation: AutoRegulationPlan;
  performanceCache: PerformanceCache;
  substitutions: PoolPreference[];
  schedule: PlannedSession[];
  sessionPlans: SessionPlan[];
  decisions: string[];
} => {
  const weekCursor = (params.activeProgram.week_cursor ?? 0) + 1;
  const weeksNeeded = Math.max(1, params.template.weeks ?? 4);
  const weekRules = expandWeekRules(params.template, weeksNeeded + weekCursor);
  const nextWeekRule = weekRules[Math.min(weekRules.length - 1, weekCursor)];
  const painBans = new Map<string, Set<string>>();

  params.performance.forEach((sample) => {
    if (typeof sample.pain === "number" && sample.pain >= 7) {
      const [programSessionKey, slotKey] = sample.exercise_key.split("_", 2);
      if (!programSessionKey || !slotKey) return;
      if (!painBans.has(slotKey)) painBans.set(slotKey, new Set());
      painBans.get(slotKey)?.add(programSessionKey);
    }
  });

  const poolPreferenceOverride: PoolPreference[] = [];
  painBans.forEach((_sessions, slotKey) => {
    poolPreferenceOverride.push({
      pool_key: slotKey,
      banned: ["painful"]
    });
  });

  const plan = generateSchedule({
    ...params,
    planId: params.activeProgram.plan_id,
    templateId: params.templateId,
    startWeek: weekCursor,
    weeksToBuild: 1,
    startWeekKey: params.activeProgram.week_key,
    poolPreferenceOverride,
    applyRules: false
  });

  const autoRegulation = deriveAutoRegulation(plan.sessionPlans, params.performance);
  const fatigue = params.fatigueHistory ? fatigueFlag(params.fatigueHistory) : false;
  const ruleWithFatigue = fatigue
    ? { ...nextWeekRule, deload: true, volume_multiplier: (nextWeekRule.volume_multiplier ?? 1) * 0.75 }
    : nextWeekRule;

  const appliedPlans = applyWeekRules({
    sessionPlans: plan.sessionPlans,
    weekRule: ruleWithFatigue,
    autoRegulation
  });

  const performanceCache = buildPerformanceCache(params.performance, params.activeProgram.performance_cache);
  const decisions = [
    `Auto-reg slots: ${Object.keys(autoRegulation).length}`,
    fatigue ? "Inserted soft deload from fatigue flag" : "No fatigue deload",
    `Week cursor advanced to ${weekCursor}`
  ];

  return {
    nextWeekRule: ruleWithFatigue,
    autoRegulation,
    performanceCache,
    substitutions: poolPreferenceOverride,
    schedule: plan.schedule,
    sessionPlans: appliedPlans,
    decisions
  };
};
