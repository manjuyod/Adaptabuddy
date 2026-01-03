"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BadgeInfo,
  Dumbbell,
  Filter,
  Link as LinkIcon,
  Play,
  Search,
  Tag,
  X
} from "lucide-react";
import type { LibraryExercise, MuscleGroup, WarmEntry } from "./types";

type ExercisesClientProps = {
  exercises: LibraryExercise[];
  muscleGroups: MuscleGroup[];
};

type FilterPillProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

const FilterPill = ({ label, active, onClick }: FilterPillProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-full border px-3 py-1 text-xs font-semibold transition",
      active
        ? "border-brand-400 bg-brand-500/10 text-brand-100 shadow-sm"
        : "border-slate-800 bg-slate-900/80 text-slate-200 hover:border-slate-600"
    )}
  >
    {label}
  </button>
);

const formatWarmEntry = (entry: WarmEntry) => {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    const { name, title, note, description } = entry as Record<string, string | undefined>;
    return name ?? title ?? description ?? note ?? "Custom sequence";
  }
  return "Custom sequence";
};

export function ExercisesClient({ exercises, muscleGroups }: ExercisesClientProps) {
  const [query, setQuery] = useState("");
  const [movementFilter, setMovementFilter] = useState<string | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [muscleFilter, setMuscleFilter] = useState<number | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<LibraryExercise | null>(null);
  const closeDetails = () => setSelectedExercise(null);
  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      closeDetails();
    }
  };

  const muscleMap = useMemo(() => {
    const map = new Map<number, MuscleGroup>();
    muscleGroups.forEach((group) => {
      map.set(group.id, group);
    });
    return map;
  }, [muscleGroups]);

  const movementOptions = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((exercise) => {
      set.add(exercise.movement_pattern);
    });
    return Array.from(set).sort();
  }, [exercises]);

  const equipmentOptions = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((exercise) => {
      exercise.equipment.forEach((item) => {
        if (item) {
          set.add(item);
        }
      });
    });
    return Array.from(set).sort();
  }, [exercises]);

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    exercises.forEach((exercise) => {
      exercise.tags.forEach((tag) => {
        if (tag) {
          set.add(tag);
        }
      });
    });
    return Array.from(set).sort();
  }, [exercises]);

  const activeFilters =
    (movementFilter ? 1 : 0) +
    equipmentFilter.size +
    tagFilter.size +
    (muscleFilter ? 1 : 0);

  const clearFilters = () => {
    setMovementFilter(null);
    setEquipmentFilter(new Set());
    setTagFilter(new Set());
    setMuscleFilter(null);
  };

  const filteredExercises = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((exercise) => {
      const searchMatch =
        q.length === 0 ||
        exercise.canonical_name.toLowerCase().includes(q) ||
        exercise.aliases.some((alias) => alias.toLowerCase().includes(q));

      const movementMatch =
        movementFilter === null || exercise.movement_pattern === movementFilter;

      const equipmentMatch =
        equipmentFilter.size === 0 ||
        exercise.equipment.some((item) => equipmentFilter.has(item));

      const tagMatch =
        tagFilter.size === 0 || exercise.tags.some((tag) => tagFilter.has(tag));

      const muscleMatch =
        muscleFilter === null ||
        exercise.primary_muscle_group_id === muscleFilter ||
        exercise.secondary_muscle_group_ids.includes(muscleFilter);

      return searchMatch && movementMatch && equipmentMatch && tagMatch && muscleMatch;
    });
  }, [equipmentFilter, exercises, movementFilter, muscleFilter, query, tagFilter]);

  const describeMuscles = (exercise: LibraryExercise) => {
    const primaryName =
      exercise.primary_muscle_group_id !== null
        ? muscleMap.get(exercise.primary_muscle_group_id)?.name
        : null;
    const secondary = exercise.secondary_muscle_group_ids
      .map((id) => muscleMap.get(id)?.name)
      .filter(Boolean) as string[];
    const names = primaryName ? [primaryName, ...secondary] : secondary;
    return names.length ? names.join(", ") : "Unspecified muscles";
  };

  const renderWarmSection = (title: string, items: WarmEntry[]) => (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      {items.length ? (
        <ul className="space-y-2 text-sm text-slate-200">
          {items.map((item, index) => (
            <li
              key={`${title}-${index}`}
              className="rounded-xl border border-slate-800/70 bg-slate-900/70 px-3 py-2"
            >
              {formatWarmEntry(item)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No sequences yet.</p>
      )}
    </div>
  );

  const mediaLink = (url?: string | null) =>
    url ? (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 text-sm text-brand-200 hover:text-brand-100"
      >
        <LinkIcon size={14} />
        {url}
      </a>
    ) : (
      <p className="text-sm text-slate-500">Placeholder</p>
    );

  return (
    <div className="space-y-5">
      <Card className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Live exercise library
          </p>
          <h3 className="text-xl font-semibold text-white">
            Browse, search, and check contraindications
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Filters are applied locally after the authenticated Supabase query.
          </p>
        </div>
        <Chip variant="warning" className="whitespace-nowrap">
          Read-only
        </Chip>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative w-full">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or alias"
              className="pl-10"
            />
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
          </div>
          {activeFilters > 0 ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X size={14} className="mr-2" />
              Clear
            </Button>
          ) : null}
        </div>

        <Card className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Filter size={16} />
            Filters
            <span className="text-xs font-normal text-slate-400">
              ({activeFilters} active)
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Movement pattern
            </p>
            <div className="flex flex-wrap gap-2">
              <FilterPill
                label="All"
                active={movementFilter === null}
                onClick={() => setMovementFilter(null)}
              />
              {movementOptions.map((item) => (
                <FilterPill
                  key={item}
                  label={item.replaceAll("_", " ")}
                  active={movementFilter === item}
                  onClick={() =>
                    setMovementFilter((current) => (current === item ? null : item))
                  }
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Equipment</p>
            <div className="flex flex-wrap gap-2">
              {equipmentOptions.map((item) => (
                <FilterPill
                  key={item}
                  label={item}
                  active={equipmentFilter.has(item)}
                  onClick={() =>
                    setEquipmentFilter((previous) => {
                      const next = new Set(previous);
                      if (next.has(item)) {
                        next.delete(item);
                      } else {
                        next.add(item);
                      }
                      return next;
                    })
                  }
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Muscle group</p>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
              <FilterPill
                label="Any"
                active={muscleFilter === null}
                onClick={() => setMuscleFilter(null)}
              />
              {muscleGroups.map((group) => (
                <FilterPill
                  key={group.id}
                  label={group.name}
                  active={muscleFilter === group.id}
                  onClick={() =>
                    setMuscleFilter((current) => (current === group.id ? null : group.id))
                  }
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">Tags</p>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
              {tagOptions.map((tag) => (
                <FilterPill
                  key={tag}
                  label={`#${tag}`}
                  active={tagFilter.has(tag)}
                  onClick={() =>
                    setTagFilter((previous) => {
                      const next = new Set(previous);
                      if (next.has(tag)) {
                        next.delete(tag);
                      } else {
                        next.add(tag);
                      }
                      return next;
                    })
                  }
                />
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>
          {filteredExercises.length} result{filteredExercises.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2 text-slate-400">
          <Dumbbell size={14} />
          <span>{exercises.length} total synced</span>
        </div>
      </div>

      <div className="grid gap-3">
        {filteredExercises.map((exercise) => {
          const aliasesLabel =
            exercise.aliases.length > 0
              ? `${exercise.aliases.length} alias${exercise.aliases.length === 1 ? "" : "es"}`
              : "No aliases";
          const muscleLabel = describeMuscles(exercise);

          return (
            <Card
              key={exercise.id}
              className="flex cursor-pointer items-start justify-between gap-3"
              role="button"
              tabIndex={0}
              onClick={() => setSelectedExercise(exercise)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedExercise(exercise);
                }
              }}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-semibold text-white">
                    {exercise.canonical_name}
                  </h4>
                  {exercise.is_bodyweight ? (
                    <Chip className="px-2 py-0.5 text-[10px] uppercase">Bodyweight</Chip>
                  ) : null}
                </div>
                <p className="text-sm text-slate-300">
                  {exercise.movement_pattern.replaceAll("_", " ")} - {muscleLabel}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Tag size={12} /> {aliasesLabel}
                  </span>
                  <span>Equipment: {exercise.equipment.join(", ") || "Any"}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {exercise.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-brand-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-100"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0 text-sm">
                <Play size={14} className="mr-2" />
                Details
              </Button>
            </Card>
          );
        })}
        {filteredExercises.length === 0 ? (
          <Card className="text-center text-sm text-slate-400">
            No exercises matched these filters. Try clearing tags or switching muscle groups.
          </Card>
        ) : null}
      </div>

      {selectedExercise ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
          <div
            role="button"
            tabIndex={0}
            aria-label="Close exercise details"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={closeDetails}
            onKeyDown={handleOverlayKeyDown}
          />
          <div className="relative z-10 w-full max-h-[90vh] overflow-y-auto rounded-t-3xl bg-slate-900/95 p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Exercise details
                </p>
                <h4 className="text-xl font-semibold text-white">
                  {selectedExercise.canonical_name}
                </h4>
                {selectedExercise.aliases.length ? (
                  <p className="text-sm text-slate-400">
                    Also known as: {selectedExercise.aliases.join(", ")}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">No aliases</p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={closeDetails}>
                <X size={16} />
              </Button>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <BadgeInfo size={16} />
                  Basics
                </div>
                <div className="grid gap-2 text-sm text-slate-300">
                  <div className="flex flex-wrap gap-2">
                    <Chip className="bg-brand-500/15 text-brand-100">
                      {selectedExercise.movement_pattern.replaceAll("_", " ")}
                    </Chip>
                    <Chip className="bg-slate-800 text-slate-100">
                      Equipment:{" "}
                      {selectedExercise.equipment.length
                        ? selectedExercise.equipment.join(", ")
                        : "Any"}
                    </Chip>
                  </div>
                  <p className="text-slate-300">
                    Muscles: {describeMuscles(selectedExercise)}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Tag size={16} />
                  Contraindications
                </div>
                {selectedExercise.contraindications.length ? (
                  <div className="space-y-3">
                    {selectedExercise.contraindications.map((item, index) => {
                      const muscles = (item.target?.muscle_group_ids ?? [])
                        .map((id) => muscleMap.get(id)?.name)
                        .filter(Boolean) as string[];
                      const hasReplace =
                        item.replace_severity_min !== undefined &&
                        item.replace_severity_min !== null;
                      const hasAvoid =
                        item.avoid_severity_min !== undefined &&
                        item.avoid_severity_min !== null;

                      return (
                        <div
                          key={`${selectedExercise.id}-contra-${index}`}
                          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"
                        >
                          <p className="text-sm font-semibold text-amber-100">
                            {muscles.length ? muscles.join(", ") : "General"}
                          </p>
                          <p className="text-xs text-amber-200">
                            {hasReplace ? `Replace at >= ${item.replace_severity_min}` : "Replace threshold n/a"}
                            {" | "}
                            {hasAvoid ? `Avoid at >= ${item.avoid_severity_min}` : "Avoid threshold n/a"}
                          </p>
                          {item.reason ? (
                            <p className="mt-1 text-sm text-amber-100/90">{item.reason}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No contraindications listed.</p>
                )}
              </div>

              <div className="grid gap-4 rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Dumbbell size={16} />
                  Warmups and warmdowns
                </div>
                <div className="grid gap-4">
                  {renderWarmSection("Warmup suggestions", selectedExercise.default_warmups)}
                  {renderWarmSection("Warmdown suggestions", selectedExercise.default_warmdowns)}
                </div>
              </div>

              <div className="grid gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/80 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Play size={16} />
                  Media
                </div>
                <div className="space-y-2 text-sm text-slate-300">
                  <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Image
                    </p>
                    {mediaLink(
                      typeof selectedExercise.media.image_url === "string"
                        ? selectedExercise.media.image_url
                        : null
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Video
                    </p>
                    {mediaLink(
                      typeof selectedExercise.media.video_url === "string"
                        ? selectedExercise.media.video_url
                        : null
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
