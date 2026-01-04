import { createHash } from "crypto";
import { dayOptions } from "./schemas";
import type { Database } from "../supabase/server";
import type {
  ActiveProgramSnapshot,
  EquipmentOption,
  ExercisePool,
  PlannedSession,
  PoolPreference,
  PreviewResult,
  PreviewWarning,
  ResolvedSlot,
  SessionPlan,
  SlotDescriptor,
  WeakPointSelection,
  WizardInjury
} from "./types";

type ExerciseRow = Database["public"]["Tables"]["exercises"]["Row"];
type MuscleGroupRow = Database["public"]["Tables"]["muscle_groups"]["Row"];

export type HypertrophyTemplate = {
  template_type?: string;
  pools: ExercisePool[];
  sessions: {
    session_key: string;
    focus: string;
    label?: string;
    archetype?: string;
    slots: SlotDescriptor[];
  }[];
  weeks?: number;
  weak_points?: Record<string, string[]>;
};

const fatigueLoadThreshold = {
  low: 65,
  medium: 75,
  high: 85
};

const fatigueLoadMultiplier = {
  low: 0.9,
  medium: 1,
  high: 1.1
};

const normalize = (value: string) => value.trim().toLowerCase();

const dayIndexMap: Record<(typeof dayOptions)[number], number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
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

const addDays = (isoDate: string, offset: number): string => {
  const [year, month, day] = isoDate.split("-").map((part) => Number.parseInt(part, 10));
  const base = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  base.setUTCDate(base.getUTCDate() + offset);
  return toIsoDate(base);
};

export const __internal = { addDays, nextDateForDay };

const seededIndex = (seed: string, key: string) =>
  parseInt(
    createHash("sha256")
      .update(`${seed}:${key}`)
      .digest("hex")
      .slice(0, 8),
    16
  );

const normalizeEquipment = (value: string | null | undefined) =>
  value ? value.toLowerCase().replace(/\s+/g, "_").replace(/s$/, "") : null;

const expandEquipmentProfile = (equipment: EquipmentOption[] | undefined | null) => {
  if (!equipment || equipment.length === 0) return null;
  const set = new Set<string>(["bodyweight"]);
  for (const item of equipment) {
    if (item === "barbell") set.add("barbell");
    else if (item === "dumbbell") set.add("dumbbell");
    else if (item === "cables") set.add("cable");
    else if (item === "machines") set.add("machine");
    else if (item === "home-gym") {
      set.add("barbell");
      set.add("dumbbell");
      set.add("bodyweight");
    }
  }
  return set;
};

const equipmentAllowed = (
  exerciseEquipment: string[] | null | undefined,
  available: Set<string> | null
): boolean => {
  if (!available) return true;
  const normalized = (exerciseEquipment ?? []).map(normalizeEquipment).filter(Boolean) as string[];
  if (normalized.length === 0) return true;
  return normalized.some((item) => available.has(item));
};

const buildMuscleMaps = (muscleGroups: MuscleGroupRow[]) => {
  const slugToId = new Map<string, number>();
  const idToRegion = new Map<number, string>();
  muscleGroups.forEach((group) => {
    if (typeof group.slug === "string" && typeof group.id === "number") {
      slugToId.set(normalize(group.slug), group.id);
    }
    if (typeof group.id === "number" && typeof group.region === "string") {
      idToRegion.set(group.id, group.region);
    }
  });
  return { slugToId, idToRegion };
};

const keywordInjuryMap: Record<string, string[]> = {
  knee: ["quads", "hamstrings", "calves"],
  quad: ["quads"],
  hamstring: ["hamstrings"],
  hip: ["glutes", "adductors", "abductors", "hip-flexors"],
  back: ["lower-back", "spinal-erectors", "upper-back", "lats"],
  shoulder: ["delts", "traps", "rotator-cuff", "upper-back"],
  elbow: ["biceps", "triceps", "forearms"],
  wrist: ["forearms"],
  ankle: ["calves"],
  foot: ["calves"],
  chest: ["chest"],
  rib: ["chest"],
  neck: ["traps", "upper-back"]
};

const mapInjuryToMuscles = (
  injuries: WizardInjury[],
  muscleGroups: MuscleGroupRow[]
): Map<number, number> => {
  const { slugToId } = buildMuscleMaps(muscleGroups);
  const severityByMuscle = new Map<number, number>();
  const muscleNames = muscleGroups.map((group) => ({
    id: group.id,
    slug: typeof group.slug === "string" ? normalize(group.slug) : "",
    name: typeof group.name === "string" ? normalize(group.name) : ""
  }));

  injuries.forEach((injury) => {
    const name = normalize(injury.name);
    const candidates: number[] = [];
    for (const group of muscleNames) {
      if (!group.slug || typeof group.id !== "number") continue;
      if (name.includes(group.slug) || group.slug.includes(name) || group.name.includes(name)) {
        candidates.push(group.id);
      }
    }
    for (const [keyword, targets] of Object.entries(keywordInjuryMap)) {
      if (name.includes(keyword)) {
        targets.forEach((slug) => {
          const id = slugToId.get(normalize(slug));
          if (id) candidates.push(id);
        });
      }
    }
    candidates.forEach((id) => {
      const prev = severityByMuscle.get(id) ?? 0;
      severityByMuscle.set(id, Math.max(prev, injury.severity ?? 0));
    });
  });

  return severityByMuscle;
};

const parseContraindications = (value: unknown): { muscle_group_ids: number[]; replace: number; avoid: number }[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) return null;
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

export const isHypertrophyTemplate = (value: unknown): value is HypertrophyTemplate =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as { pools?: unknown }).pools) &&
  Array.isArray((value as { sessions?: unknown }).sessions);

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

type ResolvedSession = {
  session_key: string;
  focus: string;
  label?: string;
  slots: ResolvedSlot[];
  removed: number;
};

const orderCandidates = (
  candidates: ExerciseRow[],
  preferredNames: string[],
  defaultNames: string[]
) => {
  const preferredNormalized = preferredNames.map(normalize);
  const defaultNormalized = defaultNames.map(normalize);
  const scored = candidates.map((candidate) => {
    const name = normalize(candidate.canonical_name);
    const preferredIndex = preferredNormalized.indexOf(name);
    const defaultIndex = defaultNormalized.indexOf(name);
    return {
      candidate,
      priority: preferredIndex >= 0 ? preferredIndex : Number.POSITIVE_INFINITY,
      defaultPriority: defaultIndex >= 0 ? defaultIndex : Number.POSITIVE_INFINITY
    };
  });

  return scored
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.defaultPriority !== b.defaultPriority) return a.defaultPriority - b.defaultPriority;
      return a.candidate.canonical_name.localeCompare(b.candidate.canonical_name);
    })
    .map((entry) => entry.candidate);
};

const resolveSlot = (params: {
  slot: SlotDescriptor;
  pool: ExercisePool | null;
  poolExercises: Map<string, ExerciseRow[]>;
  poolPreferences: Map<string, PoolPreference>;
  injuryMap: Map<number, number>;
  muscleSlugToId: Map<string, number>;
  seed: string;
  availableEquipment: Set<string> | null;
  preferredNames?: string[];
  fallbackPools?: ExercisePool[];
}): { slot: ResolvedSlot; removed: number } => {
  const { slot: slotDescriptor, pool, poolExercises, poolPreferences, injuryMap, muscleSlugToId, seed, availableEquipment, preferredNames = [], fallbackPools = [] } = params;
  let removed = 0;
  if (!pool) {
    return {
      slot: {
        slot_key: slotDescriptor.slot_key,
        pool_key: slotDescriptor.pool_key,
        exercise_id: null,
        exercise_name: slotDescriptor.pool_key,
        movement_pattern: slotDescriptor.movement_pattern,
        primary_muscle_group_id: null,
        secondary_muscle_group_ids: [],
        tags: slotDescriptor.tags ?? [],
        sets: slotDescriptor.sets,
        reps: slotDescriptor.reps ?? null,
        rir: slotDescriptor.rir ?? null,
        rpe: slotDescriptor.rpe ?? null,
        optional: slotDescriptor.optional,
        skip_reason: "no_pool"
      },
      removed: 1
    };
  }

  const preference = poolPreferences.get(pool.pool_key);
  const bannedNames = new Set((preference?.banned ?? []).map(normalize));
  const pinnedName = preference?.pinned ? normalize(preference.pinned) : null;
  const targetMuscles = (slotDescriptor.target_muscles ?? [])
    .map((slug) => muscleSlugToId.get(normalize(slug)))
    .filter((id): id is number => typeof id === "number");

  const tryPool = (candidatePool: ExercisePool | null, reasonPrefix: string) => {
    if (!candidatePool) return null;
    const base = poolExercises.get(candidatePool.pool_key) ?? [];
    let filtered = base.filter((exercise) => equipmentAllowed(exercise.equipment, availableEquipment));
    filtered = filtered.filter((exercise) => !violatesInjuryRule(exercise, injuryMap));
    filtered = filtered.filter((exercise) => !bannedNames.has(normalize(exercise.canonical_name)));

    const tags = (slotDescriptor.tags ?? []).map(normalize);
    if (tags.length > 0) {
      const tagFiltered = filtered.filter((exercise) => {
        const exerciseTags = (exercise.tags ?? []).map(normalize);
        return tags.every((tag) => exerciseTags.includes(tag));
      });
      if (tagFiltered.length === 0) {
        return { slot: null, reason: `${reasonPrefix}_tag_mismatch` };
      }
      filtered = tagFiltered;
    }

    if (targetMuscles.length > 0) {
      const muscleFiltered = filtered.filter((exercise) => {
        const primaries = typeof exercise.primary_muscle_group_id === "number" ? [exercise.primary_muscle_group_id] : [];
        const secondary = Array.isArray(exercise.secondary_muscle_group_ids)
          ? exercise.secondary_muscle_group_ids.filter((id): id is number => typeof id === "number")
          : [];
        const muscles = [...primaries, ...secondary];
        return muscles.some((id) => targetMuscles.includes(id));
      });
      if (muscleFiltered.length === 0) {
        return { slot: null, reason: `${reasonPrefix}_muscle_mismatch` };
      }
      filtered = muscleFiltered;
    }

    if (filtered.length === 0) {
      return { slot: null, reason: `${reasonPrefix}_empty` };
    }

    const preferredList = preferredNames.length ? preferredNames : [];
    const ordered = orderCandidates(filtered, preferredList, candidatePool.default_exercise_names);

    const pinnedCandidate = pinnedName
      ? ordered.find((candidate) => normalize(candidate.canonical_name) === pinnedName)
      : null;
    const pickFrom = pinnedCandidate ? [pinnedCandidate] : ordered;

    if (pickFrom.length === 0) {
      return { slot: null, reason: `${reasonPrefix}_no_candidate` };
    }

    const index = seededIndex(seed, `${slotDescriptor.slot_key}_${candidatePool.pool_key}`) % pickFrom.length;
    const chosen = pickFrom[index];

    const resolved: ResolvedSlot = {
      slot_key: slotDescriptor.slot_key,
      pool_key: candidatePool.pool_key,
      exercise_id: chosen.id ?? null,
      exercise_name: chosen.canonical_name,
      movement_pattern: chosen.movement_pattern,
      primary_muscle_group_id:
        typeof chosen.primary_muscle_group_id === "number" ? chosen.primary_muscle_group_id : null,
      secondary_muscle_group_ids: Array.isArray(chosen.secondary_muscle_group_ids)
        ? chosen.secondary_muscle_group_ids.filter((id): id is number => typeof id === "number")
        : [],
      tags: Array.isArray(chosen.tags) ? chosen.tags : [],
      sets: slotDescriptor.sets,
      reps: slotDescriptor.reps ?? null,
      rir: slotDescriptor.rir ?? null,
      rpe: slotDescriptor.rpe ?? null,
      optional: slotDescriptor.optional
    };

    return { slot: resolved, reason: null };
  };

  const poolsToTry = [pool, ...(fallbackPools ?? [])];
  let lastReason: string | null = null;
  for (const attempt of poolsToTry) {
    const resolved = tryPool(attempt, attempt?.pool_key ?? "pool");
    if (resolved?.slot) {
      return { slot: resolved.slot, removed };
    }
    if (resolved?.reason) {
      lastReason = resolved.reason;
    }
  }

  removed += 1;
  return {
    slot: {
      slot_key: slotDescriptor.slot_key,
      pool_key: pool.pool_key,
      exercise_id: null,
      exercise_name: pool.pool_key,
      movement_pattern: slotDescriptor.movement_pattern,
      primary_muscle_group_id: null,
      secondary_muscle_group_ids: [],
      tags: slotDescriptor.tags ?? [],
      sets: slotDescriptor.sets,
      reps: slotDescriptor.reps ?? null,
      rir: slotDescriptor.rir ?? null,
      rpe: slotDescriptor.rpe ?? null,
      optional: slotDescriptor.optional,
      skip_reason: lastReason ?? "no_match"
    },
    removed
  };
};

const weakPointPreset: Record<string, [string, string]> = {
  lats: ["Neutral-Grip Pullup", "Half-Kneeling 1-Arm Lat Pulldown"],
  delts: ["DB Lateral Raise", "Arnold Press"],
  chest: ["Incline DB Press", "Flat DB Press"],
  glutes: ["Hip Thrust", "DB Bulgarian Split Squat"],
  triceps: ["Triceps Pushdown", "DB Triceps Extension"]
};

const resolveWeakPointSelection = (
  template: HypertrophyTemplate,
  selection: WeakPointSelection | null | undefined
): WeakPointSelection => {
  if (selection?.focus && selection.option1) return selection;
  const focus = selection?.focus ?? Object.keys(template.weak_points ?? {})[0] ?? "lats";
  const templateOptions = (template.weak_points ?? {})[focus] ?? [];
  const preset = weakPointPreset[focus] ?? weakPointPreset.lats;
  return {
    focus,
    option1: selection?.option1 ?? templateOptions[0] ?? preset[0],
    option2: selection?.option2 ?? templateOptions[1] ?? preset[1]
  };
};

const resolveSessions = (params: {
  template: HypertrophyTemplate;
  exercises: ExerciseRow[];
  muscleGroups: MuscleGroupRow[];
  poolPreferences: PoolPreference[];
  weakPointSelection: WeakPointSelection;
  injuries: WizardInjury[];
  seed: string;
  availableEquipment: Set<string> | null;
}): { sessions: ResolvedSession[]; removed: number } => {
  const { template, exercises, muscleGroups, poolPreferences, weakPointSelection, injuries, seed, availableEquipment } = params;
  const poolIndex = new Map(template.pools.map((pool) => [pool.pool_key, pool]));
  const preferenceMap = new Map(poolPreferences.map((pref) => [pref.pool_key, pref]));
  const { slugToId } = buildMuscleMaps(muscleGroups);
  const injuryMap = mapInjuryToMuscles(injuries, muscleGroups);

  const poolExercises = new Map<string, ExerciseRow[]>();
  template.pools.forEach((pool) => {
    const matches = exercises.filter((exercise) => {
      if (exercise.movement_pattern !== pool.selection_query.movement_pattern) return false;
      const tags = (exercise.tags ?? []).map(normalize);
      const queryTags = (pool.selection_query.tags ?? []).map(normalize);
      if (queryTags.length > 0 && !queryTags.every((tag) => tags.includes(tag))) {
        return false;
      }
      if (pool.selection_query.equipment && pool.selection_query.equipment.length > 0) {
        const equipNormalized = (exercise.equipment ?? []).map(normalizeEquipment).filter(Boolean) as string[];
        const queryEquip = pool.selection_query.equipment.map(normalizeEquipment).filter(Boolean) as string[];
        if (!equipNormalized.some((equip) => queryEquip.includes(equip))) {
          return false;
        }
      }
      return true;
    });
    poolExercises.set(pool.pool_key, matches);
  });

  const weakPoolKey = (() => {
    if (weakPointSelection.focus === "delts") return "delts_iso";
    if (weakPointSelection.focus === "chest") return "hpress_chest";
    if (weakPointSelection.focus === "glutes") return "hinge_hamstring";
    if (weakPointSelection.focus === "triceps") return "triceps";
    return "vpull_lats";
  })();

  let removed = 0;
  const sessions: ResolvedSession[] = template.sessions.map((session) => {
    let sessionRemoved = 0;
    const resolvedSlots: ResolvedSlot[] = [];
    session.slots.forEach((slot) => {
      let targetPool = poolIndex.get(slot.pool_key) ?? null;
      const fallbackPools = (targetPool?.fallback_pool_keys ?? [])
        .map((key) => poolIndex.get(key) ?? null)
        .filter(Boolean) as ExercisePool[];
      const preferredNames: string[] = [];

      if (slot.slot_key.startsWith("weak_point")) {
        targetPool = poolIndex.get(weakPoolKey) ?? targetPool;
        if (slot.slot_key.endsWith("1")) {
          preferredNames.push(weakPointSelection.option1);
        } else if (slot.slot_key.endsWith("2") && weakPointSelection.option2) {
          preferredNames.push(weakPointSelection.option2);
        }
      }

      const shouldSkipWeakPoint2 =
        slot.slot_key.endsWith("2") &&
        slot.slot_key.startsWith("weak_point") &&
        (!weakPointSelection.option2 || injuries.some((injury) => injury.severity >= 4));

      if (shouldSkipWeakPoint2) {
        sessionRemoved += 1;
        resolvedSlots.push({
          slot_key: slot.slot_key,
          pool_key: targetPool?.pool_key ?? slot.pool_key,
          exercise_id: null,
          exercise_name: "weak_point_hold",
          movement_pattern: slot.movement_pattern,
          primary_muscle_group_id: null,
          secondary_muscle_group_ids: [],
          tags: slot.tags ?? [],
          sets: slot.sets,
          reps: slot.reps ?? null,
          rir: slot.rir ?? null,
          rpe: slot.rpe ?? null,
          optional: true,
          skip_reason: "recovery_hold"
        });
        return;
      }

      const resolved = resolveSlot({
        slot,
        pool: targetPool,
        poolExercises,
        poolPreferences: preferenceMap,
        injuryMap,
        muscleSlugToId: slugToId,
        seed,
        availableEquipment,
        preferredNames,
        fallbackPools
      });
      sessionRemoved += resolved.removed;
      resolvedSlots.push(resolved.slot);
    });

    removed += sessionRemoved;
    return {
      session_key: session.session_key,
      focus: session.focus,
      label: session.label ?? session.focus,
      slots: resolvedSlots,
      removed: sessionRemoved
    };
  });

  return { sessions, removed };
};

const deriveWeekKeyFromSchedule = (schedule: PlannedSession[]): string => {
  if (schedule.length === 0) return startOfWeekIso(new Date());
  const earliest = schedule.reduce((candidate, session) =>
    session.date < candidate.date ? session : candidate
  );
  const parsed = new Date(earliest.date);
  return startOfWeekIso(parsed);
};

const buildPreviewFromSessions = (params: {
  sessions: ResolvedSession[];
  muscleGroups: MuscleGroupRow[];
  payload: {
    days_per_week: number;
    fatigue_profile: "low" | "medium" | "high";
    max_session_minutes?: number;
  };
  removedSlots: number;
  seed: string;
}): PreviewResult => {
  const { sessions, muscleGroups, payload, removedSlots, seed } = params;
  const { idToRegion } = buildMuscleMaps(muscleGroups);
  const weeklySessions = sessions;
  const regionTotals = new Map<string, number>();

  weeklySessions.forEach((session) => {
    session.slots.forEach((slot) => {
      if (slot.skip_reason) return;
      const sets = slot.sets ?? 3;
      const primaryRegion = slot.primary_muscle_group_id
        ? idToRegion.get(slot.primary_muscle_group_id)
        : null;
      const region = primaryRegion ?? "Upper";
      regionTotals.set(region, (regionTotals.get(region) ?? 0) + sets);
    });
  });

  const weeklySets = Array.from(regionTotals.entries()).map(([muscleGroup, sets]) => ({
    muscleGroup,
    sets
  }));

  const totalSets = weeklySets.reduce((sum, entry) => sum + entry.sets, 0);
  const scaledSets = totalSets * ((payload.max_session_minutes ?? 60) / 60);
  const volumeScore = scaledSets / Math.max(payload.days_per_week, 1);
  const recoveryLoad = Math.min(
    100,
    Math.round(
      (volumeScore * 2.8 + payload.days_per_week * 6 + removedSlots * 3) *
        fatigueLoadMultiplier[payload.fatigue_profile]
    )
  );

  const warnings: PreviewWarning[] = [];
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

const generatePlanId = (seed: string): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return createHash("sha256")
    .update(`${seed}-${Date.now()}`)
    .digest("hex")
    .slice(0, 32);
};

export const buildHypertrophyPlan = (params: {
  template: HypertrophyTemplate;
  templateId: number;
  exercises: ExerciseRow[];
  muscleGroups: MuscleGroupRow[];
  payload: {
    days_per_week: number;
    fatigue_profile: "low" | "medium" | "high";
    max_session_minutes?: number;
    preferred_days?: string[];
    equipment_profile?: EquipmentOption[];
    pool_preferences?: PoolPreference[];
    weak_point_selection?: WeakPointSelection | null;
  };
  injuries: WizardInjury[];
  seed: string;
  planId?: string;
}): {
  sessionPlans: SessionPlan[];
  schedule: PlannedSession[];
  preview: PreviewResult;
  planId: string;
  weekKey: string;
} => {
  const weeks = Math.max(1, params.template.weeks ?? 4);
  const trainingDays = pickTrainingDays(params.payload.preferred_days, params.payload.days_per_week);
  const availableEquipment = expandEquipmentProfile(params.payload.equipment_profile);
  const weakPointSelection = resolveWeakPointSelection(
    params.template,
    params.payload.weak_point_selection
  );
  const preferences = params.payload.pool_preferences ?? [];

  const resolved = resolveSessions({
    template: params.template,
    exercises: params.exercises,
    muscleGroups: params.muscleGroups,
    poolPreferences: preferences,
    weakPointSelection,
    injuries: params.injuries,
    seed: params.seed,
    availableEquipment
  });

  const firstWeekDates = trainingDays.map((day) => nextDateForDay(day as (typeof dayOptions)[number]));
  const sessionPlans: SessionPlan[] = [];
  const schedule: PlannedSession[] = [];
  const planId = params.planId ?? generatePlanId(params.seed);

  for (let week = 0; week < weeks; week++) {
    trainingDays.forEach((day, index) => {
      const base = resolved.sessions[index % resolved.sessions.length];
      const programKey = `${base.session_key}_w${week + 1}_${day.toLowerCase()}_${params.seed.slice(0, 6)}`;
      const label = `${base.label ?? base.focus} - ${day}`;
      const date = addDays(firstWeekDates[index], week * 7);
      const planSlots = base.slots.map((slot) => ({ ...slot }));
      sessionPlans.push({
        template_id: params.templateId,
        program_session_key: programKey,
        focus: base.focus,
        label,
        week_offset: week,
        slots: planSlots
      });
      schedule.push({
        date,
        label,
        program_session_key: programKey,
        template_id: params.templateId,
        focus: base.focus,
        week
      });
    });
  }

  const preview = buildPreviewFromSessions({
    sessions: resolved.sessions,
    muscleGroups: params.muscleGroups,
    payload: {
      days_per_week: params.payload.days_per_week,
      fatigue_profile: params.payload.fatigue_profile,
      max_session_minutes: params.payload.max_session_minutes
    },
    removedSlots: resolved.removed,
    seed: params.seed
  });

  const weekKey = deriveWeekKeyFromSchedule(schedule);
  return { sessionPlans, schedule, preview, planId, weekKey };
};

export const composeHypertrophySnapshot = (params: {
  payload: {
    user_id: string;
    fatigue_profile: "low" | "medium" | "high";
    equipment_profile?: EquipmentOption[];
    days_per_week: number;
    max_session_minutes?: number;
    preferred_days?: string[];
    injuries: WizardInjury[];
    selected_programs: { template_id: number; weight_override?: number }[];
    pool_preferences?: PoolPreference[];
    weak_point_selection?: WeakPointSelection | null;
  };
  seed: string;
  planId: string;
  weekKey: string;
  schedule: PlannedSession[];
  preview: PreviewResult;
  sessionPlans: SessionPlan[];
}): ActiveProgramSnapshot => {
  const decisions: string[] = [
    `Selected templates: ${params.payload.selected_programs
      .map((program) => program.template_id)
      .join(", ")}`,
    `Days per week: ${params.payload.days_per_week}`,
    `Preferred days: ${(params.payload.preferred_days ?? []).join(", ") || "auto-assigned"}`,
    `Fatigue profile: ${params.payload.fatigue_profile}`
  ];
  if (params.payload.weak_point_selection?.focus) {
    decisions.push(`Weak point focus: ${params.payload.weak_point_selection.focus}`);
  }

  return {
    seed: params.seed,
    seed_strategy: "static",
    plan_id: params.planId,
    week_key: params.weekKey,
    restart_counter: 0,
    generated_at: new Date().toISOString(),
    fatigue_profile: params.payload.fatigue_profile,
    equipment_profile: params.payload.equipment_profile ?? [],
    days_per_week: params.payload.days_per_week,
    max_session_minutes: params.payload.max_session_minutes,
    preferred_days: params.payload.preferred_days ?? [],
    injuries: params.payload.injuries,
    selected_programs: params.payload.selected_programs,
    schedule: params.schedule,
    decisions_log: decisions,
    preview: params.preview,
    pool_preferences: params.payload.pool_preferences ?? [],
    weak_point_selection: params.payload.weak_point_selection ?? null,
    session_plans: params.sessionPlans
  };
};
