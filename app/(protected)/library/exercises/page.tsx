import { Card } from "@/components/ui/card";
import { LibraryBig } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ExercisesClient } from "./exercise-client";
import type {
  Contraindication,
  LibraryExercise,
  MediaInfo,
  MuscleGroup,
  WarmEntry
} from "./types";

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const toNumberArray = (value: unknown): number[] =>
  Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : [];

const toContraindications = (value: unknown): Contraindication[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is Contraindication => typeof item === "object" && item !== null
      )
    : [];

const toWarmEntries = (value: unknown): WarmEntry[] =>
  Array.isArray(value) ? (value as WarmEntry[]) : [];

const toMediaInfo = (value: unknown): MediaInfo =>
  value && typeof value === "object" ? (value as MediaInfo) : {};

const normalizeExercise = (exercise: {
  id: number;
  canonical_name: string;
  aliases: unknown;
  movement_pattern: string;
  equipment: unknown;
  is_bodyweight: boolean | null;
  primary_muscle_group_id: number | null;
  secondary_muscle_group_ids: unknown;
  tags: unknown;
  contraindications: unknown;
  default_warmups: unknown;
  default_warmdowns: unknown;
  media: unknown;
  created_at: string | null;
}): LibraryExercise => ({
  id: exercise.id,
  canonical_name: exercise.canonical_name,
  aliases: toStringArray(exercise.aliases),
  movement_pattern: exercise.movement_pattern,
  equipment: toStringArray(exercise.equipment),
  is_bodyweight: exercise.is_bodyweight ?? false,
  primary_muscle_group_id: exercise.primary_muscle_group_id,
  secondary_muscle_group_ids: toNumberArray(exercise.secondary_muscle_group_ids),
  tags: toStringArray(exercise.tags),
  contraindications: toContraindications(exercise.contraindications),
  default_warmups: toWarmEntries(exercise.default_warmups),
  default_warmdowns: toWarmEntries(exercise.default_warmdowns),
  media: toMediaInfo(exercise.media),
  created_at: exercise.created_at
});

const normalizeMuscleGroup = (group: {
  id: number;
  name: string;
  slug: string;
  region: string;
  parent_id: number | null;
  created_at: string | null;
}): MuscleGroup => ({
  id: group.id,
  name: group.name,
  slug: group.slug,
  region: group.region,
  parent_id: group.parent_id,
  created_at: group.created_at
});

const loadLibraryData = async () => {
  const supabase = await createSupabaseServerClient();

  const [exerciseResult, muscleGroupResult] = await Promise.all([
    supabase
      .from("exercises")
      .select(
        "id, canonical_name, aliases, movement_pattern, equipment, is_bodyweight, primary_muscle_group_id, secondary_muscle_group_ids, tags, contraindications, default_warmups, default_warmdowns, media, created_at"
      )
      .order("canonical_name", { ascending: true }),
    supabase
      .from("muscle_groups")
      .select("id, name, slug, region, parent_id, created_at")
      .order("name", { ascending: true })
  ]);

  const errorMessage =
    exerciseResult.error?.message ?? muscleGroupResult.error?.message ?? null;

  const exercises = (exerciseResult.data ?? []).map(normalizeExercise);
  const muscleGroups = (muscleGroupResult.data ?? []).map(normalizeMuscleGroup);

  return { exercises, muscleGroups, errorMessage };
};

export default async function ExercisesPage() {
  const { exercises, muscleGroups, errorMessage } = await loadLibraryData();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200">
          <LibraryBig size={18} className="text-brand-200" />
          <h2 className="text-lg font-semibold text-white">Exercise library</h2>
        </div>
        <div className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-400">
          Supabase sync
        </div>
      </div>

      {errorMessage ? (
        <Card className="border-red-500/40 bg-red-500/10 text-sm text-red-100">
          Could not load exercises right now: {errorMessage}
        </Card>
      ) : (
        <ExercisesClient exercises={exercises} muscleGroups={muscleGroups} />
      )}
    </div>
  );
}
