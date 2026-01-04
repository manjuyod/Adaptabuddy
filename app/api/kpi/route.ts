import { NextResponse, type NextRequest } from "next/server";
import {
  createSupabaseRouteClient,
  ensureUserProfile,
  type SupabaseClientType
} from "@/lib/supabase/server";
import type { KpiResponse } from "@/lib/kpi/types";

type SessionRow = {
  id: number;
  session_date: string;
  status: string | null;
};

type ExerciseRow = {
  id: number;
  session_id: number | null;
  name: string;
  movement_pattern: string | null;
  primary_muscle_group_id: number | null;
  secondary_muscle_group_ids: number[] | null;
  is_completed: boolean | null;
  pain_score: number | null;
};

type SetRow = {
  exercise_id: number | null;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
};

type MuscleGroupRow = {
  id: number;
  name: string;
};

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

const parseIsoDate = (value: string): Date | null => {
  const parts = value.split("-").map((entry) => Number(entry));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
};

const startOfIsoWeek = (value: Date): Date => {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const weekday = date.getUTCDay();
  const diff = (weekday + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return date;
};

const addDays = (iso: string, delta: number): string => {
  const parsed = parseIsoDate(iso) ?? new Date();
  parsed.setUTCDate(parsed.getUTCDate() + delta);
  return toIsoDate(parsed);
};

const weekKey = (iso: string) => toIsoDate(startOfIsoWeek(parseIsoDate(iso) ?? new Date()));

const tonnageForSet = (set: SetRow) =>
  Math.max(0, (set.reps ?? 0) * (set.weight ?? 0));

const e1rmForSet = (set: SetRow) =>
  set.weight !== null && set.reps !== null && set.reps > 0
    ? Math.round(set.weight * (1 + set.reps / 30))
    : null;

const normalizePattern = (
  pattern: string | null
): "push" | "pull" | "squat" | "hinge" | "carry" | "core" | "other" => {
  const value = (pattern ?? "").toLowerCase();
  if (value.includes("press") || value.includes("push")) return "push";
  if (value.includes("pull") || value.includes("row")) return "pull";
  if (value.includes("squat")) return "squat";
  if (value.includes("hinge") || value.includes("dead")) return "hinge";
  if (value.includes("carry") || value.includes("walk")) return "carry";
  if (value.includes("core") || value.includes("ab")) return "core";
  return "other";
};

const detectLift = (
  name: string,
  pattern: string | null
): "squat" | "bench" | "deadlift" | null => {
  const lowerName = name.toLowerCase();
  const lowerPattern = (pattern ?? "").toLowerCase();
  if (lowerName.includes("deadlift") || lowerName.includes("rdl") || lowerPattern.includes("dead")) {
    return "deadlift";
  }
  if (lowerName.includes("bench") || lowerPattern.includes("horizontal_press")) {
    return "bench";
  }
  if (lowerName.includes("squat") || lowerPattern.includes("squat")) {
    return "squat";
  }
  return null;
};

// Attribute 60% of a set's tonnage to the primary muscle and spread the rest across secondaries.
const allocateMuscleTonnage = (
  tonnage: number,
  primary: number | null,
  secondary: number[]
): [number, number][] => {
  if (tonnage <= 0) return [];
  const uniqueSecondary = Array.from(new Set(secondary.filter((id) => Number.isFinite(id))));
  if (typeof primary === "number" && Number.isFinite(primary)) {
    if (uniqueSecondary.length === 0) {
      return [[primary, tonnage]];
    }
    const primaryShare = tonnage * 0.6;
    const secondaryShare =
      uniqueSecondary.length > 0 ? (tonnage - primaryShare) / uniqueSecondary.length : 0;
    return [
      [primary, primaryShare],
      ...uniqueSecondary.map((id) => [id, secondaryShare] as [number, number])
    ];
  }
  if (uniqueSecondary.length === 0) return [];
  const equalShare = tonnage / uniqueSecondary.length;
  return uniqueSecondary.map((id) => [id, equalShare] as [number, number]);
};

const calcDots = (total: number | null, bodyweight: number | null, sex?: string | null) => {
  if (total === null || total <= 0 || bodyweight === null || bodyweight <= 0) return null;
  const lowerSex = (sex ?? "").toLowerCase();
  const coeffs =
    lowerSex === "female"
      ? { a: 0.00001791, b: -0.0006251, c: 0.01008, d: -0.06753, e: 0.297 }
      : lowerSex === "male"
        ? { a: 0.00001291, b: -0.0003658, c: 0.006198, d: -0.05042, e: 0.25 }
        : null;
  if (!coeffs) return null;
  const { a, b, c, d, e } = coeffs;
  const denom =
    a * bodyweight ** 4 + b * bodyweight ** 3 + c * bodyweight ** 2 + d * bodyweight + e;
  if (!Number.isFinite(denom) || denom <= 0) return null;
  return Math.round((500 / denom) * total);
};

const averageRange = (
  buckets: Map<string, number[]>,
  startIso: string,
  endIso: string
): number | null => {
  const values: number[] = [];
  let cursor = startIso;
  while (cursor <= endIso) {
    const entries = buckets.get(cursor);
    if (entries) {
      values.push(...entries.filter((entry) => Number.isFinite(entry)));
    }
    cursor = addDays(cursor, 1);
  }
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
};

const sumRange = (buckets: Map<string, number>, startIso: string, endIso: string): number => {
  let cursor = startIso;
  let total = 0;
  while (cursor <= endIso) {
    total += buckets.get(cursor) ?? 0;
    cursor = addDays(cursor, 1);
  }
  return total;
};

const safeNumberArray = (value: unknown): number[] =>
  Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "number" && Number.isFinite(entry) ? entry : null))
        .filter((entry): entry is number => entry !== null)
    : [];

const weeksBetween = (startIso: string, weeks: number) => {
  const result: string[] = [];
  const startDate = parseIsoDate(startIso) ?? new Date();
  for (let i = 0; i < weeks; i++) {
    const current = new Date(startDate);
    current.setUTCDate(startDate.getUTCDate() + i * 7);
    result.push(toIsoDate(current));
  }
  return result;
};

const buildEmptyWeekSeries = (endOfWeekIso: string, totalWeeks: number) => {
  const endDate = parseIsoDate(endOfWeekIso) ?? new Date();
  const startDate = new Date(endDate);
  startDate.setUTCDate(endDate.getUTCDate() - (totalWeeks - 1) * 7);
  return weeksBetween(toIsoDate(startDate), totalWeeks).map((weekStart) =>
    toIsoDate(startOfIsoWeek(parseIsoDate(weekStart) ?? new Date()))
  );
};

export async function GET(request: NextRequest) {
  const response = NextResponse.next();
  const supabase: SupabaseClientType = createSupabaseRouteClient(request, response);

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: response.headers }
    );
  }

  const profile = await ensureUserProfile(supabase, authData.user);
  const todayIso = toIsoDate(new Date());
  const currentWeekStart = weekKey(todayIso);
  const lookbackWeeks = 12;
  const rangeStartDate = startOfIsoWeek(parseIsoDate(todayIso) ?? new Date());
  rangeStartDate.setUTCDate(rangeStartDate.getUTCDate() - (lookbackWeeks - 1) * 7);
  const rangeStartIso = toIsoDate(rangeStartDate);

  const { data: sessions, error: sessionError } = await supabase
    .from("training_sessions")
    .select("id, session_date, status")
    .eq("user_id", authData.user.id)
    .gte("session_date", rangeStartIso)
    .order("session_date", { ascending: true });

  if (sessionError) {
    return NextResponse.json(
      { error: "Failed to load sessions" },
      { status: 500, headers: response.headers }
    );
  }

  const sessionIds = (sessions ?? [])
    .map((session) => session.id)
    .filter((id): id is number => typeof id === "number");

  const { data: exercises, error: exerciseError } = await supabase
    .from("training_exercises")
    .select(
      "id, session_id, name, movement_pattern, primary_muscle_group_id, secondary_muscle_group_ids, is_completed, pain_score"
    )
    .in("session_id", sessionIds.length > 0 ? sessionIds : [-1]);

  if (exerciseError) {
    return NextResponse.json(
      { error: "Failed to load exercises" },
      { status: 500, headers: response.headers }
    );
  }

  const exerciseIds = (exercises ?? [])
    .map((exercise) => exercise.id)
    .filter((id): id is number => typeof id === "number");

  const { data: sets, error: setError } = await supabase
    .from("training_sets")
    .select("exercise_id, reps, weight, rpe")
    .in("exercise_id", exerciseIds.length > 0 ? exerciseIds : [-1]);

  if (setError) {
    return NextResponse.json(
      { error: "Failed to load sets" },
      { status: 500, headers: response.headers }
    );
  }

  const { data: muscleGroups } = await supabase
    .from("muscle_groups")
    .select("id, name");

  const muscleNameLookup = new Map<number, string>(
    (muscleGroups ?? [])
      .filter((row): row is MuscleGroupRow => typeof row.id === "number" && typeof row.name === "string")
      .map((row) => [row.id, row.name])
  );

  const sessionById = new Map<number, SessionRow>();
  (sessions ?? []).forEach((session) => {
    if (typeof session.id === "number" && typeof session.session_date === "string") {
      sessionById.set(session.id, {
        id: session.id,
        session_date: session.session_date,
        status: typeof session.status === "string" ? session.status : null
      });
    }
  });

  const exerciseById = new Map<number, ExerciseRow>();
  const exercisesBySession = new Map<number, ExerciseRow[]>();
  const painByDate = new Map<string, number[]>();
  (exercises ?? []).forEach((exercise) => {
    if (typeof exercise.id !== "number" || typeof exercise.session_id !== "number") return;
    const secondary = safeNumberArray(exercise.secondary_muscle_group_ids ?? []);
    const normalized: ExerciseRow = {
      id: exercise.id,
      session_id: exercise.session_id,
      name: exercise.name,
      movement_pattern: exercise.movement_pattern ?? null,
      primary_muscle_group_id:
        typeof exercise.primary_muscle_group_id === "number"
          ? exercise.primary_muscle_group_id
          : null,
      secondary_muscle_group_ids: secondary,
      is_completed: Boolean(exercise.is_completed),
      pain_score:
        typeof exercise.pain_score === "number" && Number.isFinite(exercise.pain_score)
          ? exercise.pain_score
          : null
    };
    exerciseById.set(exercise.id, normalized);
    const list = exercisesBySession.get(exercise.session_id) ?? [];
    list.push(normalized);
    exercisesBySession.set(exercise.session_id, list);
    const session = sessionById.get(exercise.session_id);
    if (session && normalized.pain_score !== null) {
      const arr = painByDate.get(session.session_date) ?? [];
      arr.push(normalized.pain_score);
      painByDate.set(session.session_date, arr);
    }
  });

  const tonnageBySession = new Map<number, number>();
  const dailyTonnage = new Map<string, number>();
  const dailyRpe = new Map<string, number[]>();
  const patternByWeek = new Map<string, Map<string, number>>();
  const muscleByWeek = new Map<string, Map<number, number>>();
  const e1rmByLiftWeek: Record<"squat" | "bench" | "deadlift", Map<string, number>> = {
    squat: new Map(),
    bench: new Map(),
    deadlift: new Map()
  };
  const bestLifts: Record<"squat" | "bench" | "deadlift", number> = {
    squat: 0,
    bench: 0,
    deadlift: 0
  };

  (sets ?? []).forEach((set) => {
    if (typeof set.exercise_id !== "number") return;
    const exercise = exerciseById.get(set.exercise_id);
    if (!exercise) return;
    const session = sessionById.get(exercise.session_id ?? -1);
    if (!session) return;
    const iso = session.session_date;
    const week = weekKey(iso);
    const tonnage = tonnageForSet(set);
    tonnageBySession.set(
      exercise.session_id ?? -1,
      (tonnageBySession.get(exercise.session_id ?? -1) ?? 0) + tonnage
    );
    dailyTonnage.set(iso, (dailyTonnage.get(iso) ?? 0) + tonnage);

    const pattern = normalizePattern(exercise.movement_pattern);
    const patternWeek = patternByWeek.get(week) ?? new Map<string, number>();
    patternWeek.set(pattern, (patternWeek.get(pattern) ?? 0) + tonnage);
    patternByWeek.set(week, patternWeek);

    const allocations = allocateMuscleTonnage(
      tonnage,
      exercise.primary_muscle_group_id,
      exercise.secondary_muscle_group_ids ?? []
    );
    if (allocations.length > 0) {
      const muscleWeek = muscleByWeek.get(week) ?? new Map<number, number>();
      allocations.forEach(([id, share]) => {
        muscleWeek.set(id, (muscleWeek.get(id) ?? 0) + share);
      });
      muscleByWeek.set(week, muscleWeek);
    }

    if (typeof set.rpe === "number" && Number.isFinite(set.rpe)) {
      const arr = dailyRpe.get(iso) ?? [];
      arr.push(set.rpe);
      dailyRpe.set(iso, arr);
    }

    const e1rm = e1rmForSet(set);
    const lift = e1rm !== null ? detectLift(exercise.name, exercise.movement_pattern) : null;
    if (e1rm !== null && lift) {
      const liftWeek = e1rmByLiftWeek[lift];
      liftWeek.set(week, Math.max(liftWeek.get(week) ?? 0, e1rm));
      bestLifts[lift] = Math.max(bestLifts[lift], e1rm);
    }
  });

  const weeklyCompletion = new Map<string, { completed: number; total: number }>();
  let currentStreak = 0;
  let longestStreak = 0;
  const orderedSessions = (sessions ?? [])
    .filter(
      (session): session is SessionRow =>
        typeof session.id === "number" && typeof session.session_date === "string"
    )
    .sort((a, b) => a.session_date.localeCompare(b.session_date));

  orderedSessions.forEach((session) => {
    const exercisesForSession = exercisesBySession.get(session.id) ?? [];
    const totalExercises = exercisesForSession.length;
    const completedExercises = exercisesForSession.filter((exercise) => exercise.is_completed).length;
    const tonnage = tonnageBySession.get(session.id) ?? 0;
    const sessionCompleted =
      session.status === "completed" ||
      (totalExercises > 0 && completedExercises === totalExercises) ||
      tonnage > 0;
    const week = weekKey(session.session_date);
    const entry = weeklyCompletion.get(week) ?? { completed: 0, total: 0 };
    entry.total += 1;
    if (sessionCompleted) {
      entry.completed += 1;
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
    weeklyCompletion.set(week, entry);
  });

  const completionWeeks = buildEmptyWeekSeries(currentWeekStart, 8).map((weekStart) => {
    const entry = weeklyCompletion.get(weekStart) ?? { completed: 0, total: 0 };
    const rate = entry.total > 0 ? entry.completed / entry.total : 0;
    return {
      week_start: weekStart,
      completed: entry.completed,
      total: entry.total,
      rate
    };
  });

  const tonnageByPattern: KpiResponse["tonnage_by_pattern"] = [];
  buildEmptyWeekSeries(currentWeekStart, 8).forEach((weekStart) => {
    const patternTotals = patternByWeek.get(weekStart) ?? new Map<string, number>();
    ["push", "pull", "squat", "hinge", "carry", "core"].forEach((pattern) => {
      tonnageByPattern.push({
        week_start: weekStart,
        pattern,
        tonnage: patternTotals.get(pattern) ?? 0
      });
    });
  });

  const tonnageByMuscle: KpiResponse["tonnage_by_muscle"] = [];
  buildEmptyWeekSeries(currentWeekStart, 8).forEach((weekStart) => {
    const muscleTotals = muscleByWeek.get(weekStart) ?? new Map<number, number>();
    muscleTotals.forEach((tonnage, id) => {
      tonnageByMuscle.push({
        week_start: weekStart,
        muscle_group_id: id,
        muscle_group: muscleNameLookup.get(id) ?? `Muscle ${id}`,
        tonnage
      });
    });
  });

  const buildE1rmSeries = (lift: "squat" | "bench" | "deadlift") =>
    buildEmptyWeekSeries(currentWeekStart, 8).map((weekStart) => ({
      week_start: weekStart,
      e1rm: e1rmByLiftWeek[lift].get(weekStart) ?? 0
    }));

  const totalStrength =
    bestLifts.squat > 0 && bestLifts.bench > 0 && bestLifts.deadlift > 0
      ? bestLifts.squat + bestLifts.bench + bestLifts.deadlift
      : null;
  const dotsScore = calcDots(totalStrength, profile.bodyweight, profile.sex);

  const last7Start = addDays(todayIso, -6);
  const prev28Start = addDays(todayIso, -34);
  const prev28End = addDays(todayIso, -7);
  const last7Volume = sumRange(dailyTonnage, last7Start, todayIso);
  const prev28Volume = sumRange(dailyTonnage, prev28Start, prev28End);
  const prevWeeklyAvg = prev28Volume / 4;
  const volumeChange =
    prevWeeklyAvg > 0 ? Math.round(((last7Volume / prevWeeklyAvg - 1) * 100) * 10) / 10 : null;
  const volumeSpike =
    prevWeeklyAvg > 0 ? last7Volume > prevWeeklyAvg * 1.25 : false;

  const last7Rpe = averageRange(dailyRpe, last7Start, todayIso);
  const prev28Rpe = averageRange(dailyRpe, prev28Start, prev28End);
  const rpeChange =
    last7Rpe !== null && prev28Rpe !== null
      ? Math.round((last7Rpe - prev28Rpe) * 10) / 10
      : null;
  const volumeStable =
    prevWeeklyAvg > 0
      ? Math.abs(last7Volume - prevWeeklyAvg) / prevWeeklyAvg <= 0.1
      : false;
  const rpeRising = volumeStable && rpeChange !== null && rpeChange >= 0.5;

  const painCurrentStart = addDays(todayIso, -13);
  const painPrevStart = addDays(todayIso, -27);
  const painPrevEnd = addDays(todayIso, -14);
  const painCurrent = averageRange(painByDate, painCurrentStart, todayIso);
  const painPrevious = averageRange(painByDate, painPrevStart, painPrevEnd);
  const painDelta =
    painCurrent !== null && painPrevious !== null
      ? Math.round((painCurrent - painPrevious) * 10) / 10
      : null;
  const painRising =
    painDelta !== null && painDelta >= 1 && (painCurrent ?? 0) >= 2;

  const payload: KpiResponse = {
    completion: {
      weeks: completionWeeks,
      current_streak: currentStreak,
      longest_streak: longestStreak
    },
    tonnage_by_pattern: tonnageByPattern,
    tonnage_by_muscle: tonnageByMuscle,
    e1rm: {
      squat: buildE1rmSeries("squat"),
      bench: buildE1rmSeries("bench"),
      deadlift: buildE1rmSeries("deadlift")
    },
    dots: {
      score: dotsScore,
      total: totalStrength,
      status: dotsScore !== null ? "ok" : "needs_data",
      bodyweight: profile.bodyweight
    },
    fatigue: {
      volume_spike: volumeSpike,
      volume_change: volumeChange,
      rpe_rising: rpeRising,
      rpe_change: rpeChange,
      pain_rising: painRising,
      pain_delta: painDelta
    }
  };

  return NextResponse.json(payload, { headers: response.headers });
}
