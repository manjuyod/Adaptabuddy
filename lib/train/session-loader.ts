try {
  // Optional in tests; available in Next runtime
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  require("server-only");
} catch {
  // no-op
}

import type { Database, SupabaseClientType } from "@/lib/supabase/server";
import type { TrainingExercise, TrainingSession, TrainingSet } from "@/lib/train/types";

type Client = SupabaseClientType;

const isStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const isNumberArray = (value: unknown): number[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is number => typeof item === "number" && Number.isFinite(item)
      )
    : [];

const mapSet = (
  row: Database["public"]["Tables"]["training_sets"]["Row"] | null | undefined
): TrainingSet | null => {
  if (!row) return null;
  return {
    id: typeof row.id === "number" ? row.id : null,
    exercise_id: typeof row.exercise_id === "number" ? row.exercise_id : 0,
    set_index: typeof row.set_index === "number" ? row.set_index : 0,
    reps: typeof row.reps === "number" && Number.isFinite(row.reps) ? row.reps : null,
    weight:
      typeof row.weight === "number" && Number.isFinite(row.weight) ? row.weight : null,
    rpe: typeof row.rpe === "number" && Number.isFinite(row.rpe) ? row.rpe : null,
    rir: typeof row.rir === "number" && Number.isFinite(row.rir) ? row.rir : null,
    tempo: typeof row.tempo === "string" ? row.tempo : null,
    rest_seconds:
      typeof row.rest_seconds === "number" && Number.isFinite(row.rest_seconds)
        ? row.rest_seconds
        : null,
    is_amrap: Boolean(row.is_amrap),
    is_joker: Boolean(row.is_joker)
  };
};

export const loadUpcomingSession = async (
  supabase: Client,
  userId: string
): Promise<TrainingSession | null> => {
  const today = new Date().toISOString().slice(0, 10);

  const { data: sessions, error: sessionError } = await supabase
    .from("training_sessions")
    .select("id, session_date, status, program_session_key, notes")
    .eq("user_id", userId)
    .or("status.eq.planned,status.is.null")
    .gte("session_date", today)
    .order("session_date", { ascending: true })
    .limit(1);

  if (sessionError) {
    throw new Error(
      sessionError instanceof Error
        ? sessionError.message
        : "Failed to load upcoming training session."
    );
  }

  const targetSession = sessions?.[0];
  if (!targetSession) return null;

  const { data: exercisesRaw, error: exercisesError } = await supabase
    .from("training_exercises")
    .select(
      "id, session_id, exercise_id, exercise_key, name, tags, movement_pattern, primary_muscle_group_id, secondary_muscle_group_ids, is_completed, pain_score, order_index"
    )
    .eq("session_id", targetSession.id)
    .order("order_index", { ascending: true });

  if (exercisesError) {
    throw new Error(
      exercisesError instanceof Error
        ? exercisesError.message
        : "Failed to load training exercises."
    );
  }

  const exercisesData = exercisesRaw ?? [];
  const exerciseIds = exercisesData
    .map((exercise) => exercise.id)
    .filter((id): id is number => typeof id === "number");
  const { data: setsRaw, error: setsError } = await supabase
    .from("training_sets")
    .select(
      "id, exercise_id, set_index, reps, weight, rpe, rir, tempo, rest_seconds, is_amrap, is_joker, created_at"
    )
    .in("exercise_id", exerciseIds.length > 0 ? exerciseIds : [-1])
    .order("set_index", { ascending: true });

  if (setsError) {
    throw new Error(
      setsError instanceof Error ? setsError.message : "Failed to load training sets."
    );
  }

  const setsByExercise = new Map<number, TrainingSet[]>();
  const setsData = setsRaw ?? [];
  setsData.forEach((setRow) => {
    const mapped = mapSet(setRow);
    if (!mapped) return;
    const existing = setsByExercise.get(mapped.exercise_id) ?? [];
    existing.push(mapped);
    setsByExercise.set(mapped.exercise_id, existing);
  });

  const exercises: TrainingExercise[] = exercisesData.map((row) => ({
    id: row.id,
    session_id: row.session_id,
    exercise_id: row.exercise_id,
    exercise_key: row.exercise_key,
    name: row.name,
    tags: isStringArray(row.tags),
    movement_pattern: row.movement_pattern ?? null,
    primary_muscle_group_id: row.primary_muscle_group_id ?? null,
    secondary_muscle_group_ids: isNumberArray(row.secondary_muscle_group_ids),
    is_completed: Boolean(row.is_completed),
    pain_score:
      typeof row.pain_score === "number" && Number.isFinite(row.pain_score)
        ? row.pain_score
        : null,
    order_index: row.order_index ?? 0,
    sets: (setsByExercise.get(row.id) ?? []).sort((a, b) => a.set_index - b.set_index)
  }));

  return {
    id: targetSession.id,
    session_date: targetSession.session_date,
    status: targetSession.status ?? null,
    program_session_key: targetSession.program_session_key,
    notes: targetSession.notes ?? null,
    exercises
  };
};
