"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast-provider";
import { clearEventsThrough, appendEvent, loadEvents, persistActiveProgram, persistSession, readCachedSession } from "@/lib/train/offline";
import type { RescheduleResponse, SyncEvent, SyncEventType, TrainingSession, TrainingSet } from "@/lib/train/types";
import { ensureInjuryIds, createInjuryId } from "@/lib/wizard/injuries";
import type { WizardInjury } from "@/lib/wizard/types";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle,
  CloudOff,
  CloudUpload,
  Dumbbell,
  Flame,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Shuffle,
  Trash2,
  WifiOff
} from "lucide-react";

type TrainClientProps = {
  userId: string;
  initialSession: TrainingSession | null;
  initialBodyweight: number | null;
  initialInjuries: WizardInjury[];
  activeProgram: Record<string, unknown> | null;
  offlineCursor: number;
};

type SyncPayload = SyncEvent["payload"];

const buildEvent = <T extends SyncEventType>(userId: string, type: T, payload: SyncPayload) => {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    event_id: id,
    user_id: userId,
    ts: new Date().toISOString(),
    type,
    payload
  } as SyncEvent;
};

const numberOrNull = (value: string) => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const tonnageForSet = (set: TrainingSet) =>
  (set.reps ?? 0) * (set.weight ?? 0);

const e1rmForSet = (set: TrainingSet) =>
  set.weight !== null && set.reps !== null && set.reps > 0
    ? Math.round(set.weight * (1 + set.reps / 30))
    : null;

const formatDate = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

export default function TrainClient({
  userId,
  initialSession,
  initialBodyweight,
  initialInjuries,
  activeProgram,
  offlineCursor
}: TrainClientProps) {
  const { toast } = useToast();
  const [session, setSession] = useState<TrainingSession | null>(initialSession);
  const sessionRef = useRef<TrainingSession | null>(initialSession);
  const [bodyweight, setBodyweight] = useState<number | null>(initialBodyweight);
  const [bodyweightInput, setBodyweightInput] = useState(
    initialBodyweight !== null && typeof initialBodyweight === "number"
      ? String(initialBodyweight)
      : ""
  );
  const [injuries, setInjuries] = useState<WizardInjury[]>(() =>
    ensureInjuryIds(initialInjuries)
  );
  const [newInjuryName, setNewInjuryName] = useState("");
  const [newInjurySeverity, setNewInjurySeverity] = useState(1);
  const [pendingEvents, setPendingEvents] = useState<SyncEvent[]>([]);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [cursor, setCursor] = useState(offlineCursor);
  const [program, setProgram] = useState<Record<string, unknown> | null>(activeProgram);
  const [reshuffleSeed, setReshuffleSeed] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState<null | "auto" | "soft" | "hard">(null);

  const persistSnapshot = useCallback(
    async (nextSession: TrainingSession | null = session) => {
      await persistSession({
        session: nextSession,
        bodyweight: bodyweight ?? null,
        injuries,
        cachedAt: Date.now()
      });
    },
    [bodyweight, injuries, session]
  );

  const refreshQueueState = useCallback(async () => {
    const queue = await loadEvents();
    setPendingEvents(queue);
  }, []);

  const flushQueue = useCallback(
    async (force = false) => {
      if (!isOnline && !force) return;
      if (isSyncing) return;

      const events = await loadEvents();
      if (!force && events.length === 0) {
        return;
      }

      setIsSyncing(true);
      try {
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events })
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Sync failed");
        }

        const payload = (await response.json()) as {
          session: TrainingSession | null;
          offline_sync_cursor: number;
          bodyweight: number | null;
          injuries: WizardInjury[];
        };

        setSession(payload.session);
        setCursor(payload.offline_sync_cursor);
        setBodyweight(payload.bodyweight);
        setBodyweightInput(
          payload.bodyweight !== null && typeof payload.bodyweight === "number"
            ? String(payload.bodyweight)
            : ""
        );
        const nextInjuries = ensureInjuryIds(payload.injuries ?? []);
        setInjuries(nextInjuries);
        setLastSyncAt(Date.now());
        await persistSession({
          session: payload.session,
          bodyweight: payload.bodyweight,
          injuries: nextInjuries,
          cachedAt: Date.now()
        });
        await clearEventsThrough(payload.offline_sync_cursor);
        await refreshQueueState();

        toast({
          title: "Synced",
          description: "Offline queue flushed and state refreshed."
        });
      } catch (error) {
        toast({
          title: "Sync failed",
          description:
            error instanceof Error ? error.message : "Unable to reach sync endpoint."
        });
      } finally {
        setIsSyncing(false);
      }
    },
    [isOnline, isSyncing, refreshQueueState, toast]
  );

  const enqueueEvent = useCallback(
    async (event: SyncEvent) => {
      const stored = await appendEvent(event);
      setPendingEvents((prev) =>
        [...prev, stored].sort(
          (a, b) => (a.local_seq ?? Number.MAX_SAFE_INTEGER) - (b.local_seq ?? Number.MAX_SAFE_INTEGER)
        )
      );
      if (typeof navigator === "undefined" || navigator.onLine) {
        void flushQueue();
      }
    },
    [flushQueue]
  );

  const runReschedule = useCallback(
    async (mode: "auto" | "soft" | "hard") => {
      setIsRescheduling(mode);
      try {
        const response = await fetch("/api/reschedule/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            reshuffle: mode !== "auto" ? reshuffleSeed : undefined
          })
        });

        const payload = (await response.json()) as RescheduleResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Reschedule failed");
        }

        if (payload.active_program) {
          setProgram(payload.active_program as Record<string, unknown>);
        }
        if ("upcoming_session" in payload) {
          setSession(payload.upcoming_session ?? null);
        }
        setLastSyncAt(Date.now());

        const title =
          mode === "auto"
            ? "Auto-reschedule complete"
            : mode === "soft"
              ? "Soft restart applied"
              : "Hard restart applied";
        const summary = `Missed ${payload.missed ?? 0}, rescheduled ${payload.rescheduled ?? 0}, created ${payload.created ?? 0}`;
        const restartNote =
          payload.restart_required && payload.restart_reason
            ? ` (${payload.restart_reason})`
            : "";
        toast({
          title,
          description: `${summary}${restartNote}`
        });
      } catch (error) {
        toast({
          title: "Reschedule failed",
          description: error instanceof Error ? error.message : "Unable to reschedule."
        });
      } finally {
        setIsRescheduling(null);
      }
    },
    [reshuffleSeed, toast]
  );

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      const cached = await readCachedSession();
      if (!cancelled && cached) {
        if (!sessionRef.current) {
          setSession(cached.session);
        }
        if (cached.bodyweight !== undefined) {
          setBodyweight(cached.bodyweight);
          setBodyweightInput(
            cached.bodyweight !== null && typeof cached.bodyweight === "number"
              ? String(cached.bodyweight)
              : ""
          );
        }
        setInjuries(ensureInjuryIds(cached.injuries));
      }

      const queue = await loadEvents();
      if (!cancelled) {
        setPendingEvents(queue);
        if ((typeof navigator === "undefined" || navigator.onLine) && queue.length > 0) {
          void flushQueue();
        }
      }
    };

    void bootstrap();

    const handleOnline = () => {
      setIsOnline(true);
      void flushQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushQueue]);

  useEffect(() => {
    if (!program) return;
    void persistActiveProgram(program);
  }, [program]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    void persistSnapshot();
  }, [session, bodyweight, injuries, persistSnapshot]);

  const addInjury = () => {
    if (!newInjuryName.trim()) {
      toast({
        title: "Add injury name",
        description: "Example: Left knee ache."
      });
      return;
    }
    setInjuries((prev) => [
      ...prev,
      { id: createInjuryId(), name: newInjuryName.trim(), severity: newInjurySeverity }
    ]);
    setNewInjuryName("");
    setNewInjurySeverity(1);
  };

  const saveInjuries = async () => {
    const event = buildEvent(userId, "UPDATE_INJURIES", {
      injuries
    });
    await enqueueEvent(event);
    toast({
      title: "Injuries queued",
      description: "Updates will sync when online."
    });
  };

  const saveBodyweight = async () => {
    const parsed = numberOrNull(bodyweightInput);
    if (bodyweightInput.trim() !== "" && parsed === null) {
      toast({
        title: "Invalid bodyweight",
        description: "Enter a number (lbs or kg) or leave blank."
      });
      return;
    }
    setBodyweight(parsed);
    const event = buildEvent(userId, "UPDATE_BODYWEIGHT", { bodyweight: parsed });
    await enqueueEvent(event);
    toast({
      title: "Bodyweight queued",
      description: "Will sync with your profile."
    });
  };

  const toggleExerciseComplete = async (exerciseId: number, checked: boolean) => {
    setSession((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((exercise) =>
              exercise.id === exerciseId ? { ...exercise, is_completed: checked } : exercise
            )
          }
        : prev
    );

    const event = buildEvent(userId, "TOGGLE_EXERCISE", {
      exercise_id: exerciseId,
      is_completed: checked
    });
    await enqueueEvent(event);
  };

  const updatePainScore = async (exerciseId: number, value: number | null) => {
    setSession((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((exercise) =>
              exercise.id === exerciseId ? { ...exercise, pain_score: value } : exercise
            )
          }
        : prev
    );
    const event = buildEvent(userId, "UPDATE_PAIN", {
      exercise_id: exerciseId,
      pain_score: value
    });
    await enqueueEvent(event);
  };

  const upsertSet = async (
    exerciseId: number,
    setIndex: number,
    updates: Partial<TrainingSet>
  ) => {
    const currentExercise = session?.exercises.find((exercise) => exercise.id === exerciseId);
    const existingSet = currentExercise?.sets.find((set) => set.set_index === setIndex);
    const baseSet: TrainingSet =
      existingSet ??
      ({
        id: null,
        exercise_id: exerciseId,
        set_index: setIndex,
        reps: null,
        weight: null,
        rpe: null,
        rir: null,
        tempo: null,
        rest_seconds: null,
        is_amrap: false,
        is_joker: false
      } satisfies TrainingSet);

    const nextSet: TrainingSet = {
      ...baseSet,
      ...updates
    };

    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((exercise) => {
          if (exercise.id !== exerciseId) return exercise;
          const hasSet = exercise.sets.some((set) => set.set_index === setIndex);
          const sets = hasSet
            ? exercise.sets.map((set) => (set.set_index === setIndex ? nextSet : set))
            : [...exercise.sets, nextSet];
          return {
            ...exercise,
            sets: sets.sort((a, b) => a.set_index - b.set_index)
          };
        })
      };
    });

    const event = buildEvent(userId, "UPSERT_SET", {
      id: nextSet.id ?? undefined,
      exercise_id: exerciseId,
      set_index: setIndex,
      reps: nextSet.reps,
      weight: nextSet.weight,
      rpe: nextSet.rpe,
      rir: nextSet.rir,
      tempo: nextSet.tempo,
      rest_seconds: nextSet.rest_seconds,
      is_amrap: nextSet.is_amrap,
      is_joker: nextSet.is_joker
    });
    await enqueueEvent(event);
  };

  const addSet = async (exerciseId: number) => {
    const exercise = session?.exercises.find((item) => item.id === exerciseId);
    const nextIndex =
      exercise && exercise.sets.length > 0
        ? Math.max(...exercise.sets.map((set) => set.set_index)) + 1
        : 1;
    await upsertSet(exerciseId, nextIndex, {
      reps: 8,
      weight: null,
      rpe: null,
      rir: null,
      tempo: null,
      rest_seconds: 90,
      is_amrap: false,
      is_joker: false
    });
  };

  const deleteSet = async (
    exerciseId: number,
    setIndex: number,
    setId?: number | null
  ) => {
    setSession((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((exercise) =>
              exercise.id === exerciseId
                ? {
                    ...exercise,
                    sets: exercise.sets.filter((set) => set.set_index !== setIndex)
                  }
                : exercise
            )
          }
        : prev
    );

    const event = buildEvent(userId, "DELETE_SET", {
      exercise_id: exerciseId,
      set_index: setIndex,
      set_id: setId ?? undefined
    });
    await enqueueEvent(event);
  };

  const sessionTonnage = useMemo(() => {
    if (!session) return 0;
    return session.exercises.reduce(
      (total, exercise) =>
        total + exercise.sets.reduce((sum, set) => sum + tonnageForSet(set), 0),
      0
    );
  }, [session]);

  const completedExercises = useMemo(
    () => session?.exercises.filter((exercise) => exercise.is_completed).length ?? 0,
    [session]
  );

  const pendingCount = pendingEvents.length;

  const planMeta = useMemo(() => {
    const seed =
      program && typeof (program as { seed?: unknown }).seed === "string"
        ? (program as { seed: string }).seed
        : null;
    const planId =
      program && typeof (program as { plan_id?: unknown }).plan_id === "string"
        ? (program as { plan_id: string }).plan_id
        : null;
    const restartCounter =
      program && typeof (program as { restart_counter?: unknown }).restart_counter === "number"
        ? (program as { restart_counter: number }).restart_counter
        : 0;
    return { seed, planId, restartCounter };
  }, [program]);

  const offlineBanner = (
    <Card className="flex flex-col gap-3 bg-slate-900/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Chip variant={isOnline ? "success" : "warning"}>
          {isOnline ? "Online" : "Offline"}
        </Chip>
        <div className="text-sm text-slate-200">
          {isOnline ? "Sync enabled" : "Logging offline - queueing events"}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
        <div className="flex items-center gap-1">
          <CloudOff size={14} /> {pendingCount} queued
        </div>
        <div className="flex items-center gap-1">
          <Activity size={14} /> Cursor {cursor}
        </div>
        <div className="flex items-center gap-1">
          <CloudUpload size={14} />{" "}
          {lastSyncAt ? `Last sync ${new Date(lastSyncAt).toLocaleTimeString()}` : "Not synced"}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => void flushQueue(true)}
          disabled={isSyncing}
        >
          {isSyncing ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          <span className="ml-2">Sync now</span>
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="space-y-5">
      {offlineBanner}

      <Card className="space-y-3 border border-slate-800 bg-slate-950/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Schedule controls</p>
            <p className="text-xs text-slate-400">
              Auto-reschedule missed sessions or restart this week.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Toggle
              checked={reshuffleSeed}
              onCheckedChange={(checked) => setReshuffleSeed(checked)}
              aria-label="Toggle seed reshuffle"
            >
              <Shuffle size={14} />
            </Toggle>
            <span>Reshuffle seed</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void runReschedule("auto")}
            disabled={isRescheduling !== null}
          >
            {isRescheduling === "auto" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Auto-reschedule
          </Button>
          <Button
            size="sm"
            onClick={() => void runReschedule("soft")}
            disabled={isRescheduling !== null}
          >
            {isRescheduling === "soft" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Soft restart
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-amber-200"
            onClick={() => void runReschedule("hard")}
            disabled={isRescheduling !== null}
          >
            {isRescheduling === "hard" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="mr-2 h-4 w-4" />
            )}
            Hard restart
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          {planMeta.seed && (
            <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-200">
              Seed {planMeta.seed}
            </span>
          )}
          {planMeta.planId && (
            <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-200">
              Plan {planMeta.planId.slice(0, 8)}
            </span>
          )}
          <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-200">
            Restarts {planMeta.restartCounter}
          </span>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Today</p>
            <h2 className="text-xl font-semibold text-white">
              {session ? "Session view" : "No session planned today"}
            </h2>
            <p className="text-sm text-slate-300">
              {session ? formatDate(session.session_date) : "Run the wizard to schedule more"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-300">
              {completedExercises}/{session?.exercises.length ?? 0} completed
            </div>
            <div className="text-xs text-slate-400">Session tonnage {sessionTonnage.toFixed(0)}</div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="flex items-center justify-between text-sm text-slate-200">
              <div className="flex items-center gap-2">
                <Flame size={16} className="text-amber-300" />
                <span>Bodyweight</span>
              </div>
              <Button size="sm" variant="outline" className="h-8" onClick={() => void saveBodyweight()}>
                Save
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Input
                value={bodyweightInput}
                onChange={(event) => setBodyweightInput(event.target.value)}
                placeholder="Enter weight"
                className="flex-1"
              />
              <div className="text-xs text-slate-400">{bodyweight ? `${bodyweight}` : "N/A"}</div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Saves locally and queues a bodyweight update.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-200">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-300" />
                <span>Injuries</span>
              </div>
              <Button size="sm" variant="outline" className="h-8" onClick={() => void saveInjuries()}>
                Save
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {injuries.map((injury) => (
                <Chip key={injury.id} className="bg-slate-800">
                  <div className="flex items-center gap-2 text-slate-100">
                    <span>{injury.name}</span>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={injury.severity}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        setInjuries((prev) =>
                          prev.map((entry) =>
                            entry.id === injury.id
                              ? { ...entry, severity: Number.isFinite(next) ? next : entry.severity }
                              : entry
                          )
                        );
                      }}
                      className="h-8 w-16 text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-slate-300"
                      onClick={() =>
                        setInjuries((prev) =>
                          prev.filter((entry) => entry.id !== injury.id)
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </Chip>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Injury"
                value={newInjuryName}
                onChange={(event) => setNewInjuryName(event.target.value)}
                className="col-span-2"
              />
              <Input
                type="number"
                min={0}
                max={10}
                value={newInjurySeverity}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setNewInjurySeverity(
                    Number.isFinite(next) ? Math.min(10, Math.max(0, next)) : 1
                  );
                }}
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={addInjury}>
                <Plus size={16} className="mr-2" />
                Add injury
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {!session && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2 text-slate-200">
            <AlertTriangle size={18} className="text-amber-300" />
            <p>No planned session for today.</p>
          </div>
          <p className="text-sm text-slate-400">
            Generate a program in the wizard or reschedule an existing plan.
          </p>
        </Card>
      )}

      {session && (
        <div className="space-y-4">
          {session.exercises.map((exercise) => {
            const open = expanded[exercise.id] ?? true;
            const exerciseTonnage = exercise.sets.reduce(
              (sum, set) => sum + tonnageForSet(set),
              0
            );
            return (
              <Card key={exercise.id} className="space-y-3 border border-slate-800 bg-slate-900/70">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Dumbbell size={16} className="text-brand-200" />
                      <p className="text-base font-semibold text-white">{exercise.name}</p>
                    </div>
                    <p className="text-xs text-slate-400">
                      {exercise.movement_pattern ?? "Movement"} - Tonnage {exerciseTonnage.toFixed(0)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Toggle
                      checked={exercise.is_completed}
                      onCheckedChange={(checked) => void toggleExerciseComplete(exercise.id, checked)}
                    />
                    <Chip variant={exercise.is_completed ? "success" : "default"}>
                      {exercise.is_completed ? "Completed" : "Pending"}
                    </Chip>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-slate-300"
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [exercise.id]: !open }))
                      }
                    >
                      {open ? "Collapse" : "Expand"}
                    </Button>
                  </div>
                </div>

                {open && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <span>Pain score (0-10)</span>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        className="h-9 w-20"
                        value={exercise.pain_score ?? ""}
                        onChange={(event) => {
                          const next = numberOrNull(event.target.value);
                          void updatePainScore(exercise.id, next);
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      {exercise.sets.map((set) => (
                        <div
                          key={`${exercise.id}-${set.set_index}`}
                          className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                        >
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>Set {set.set_index}</span>
                            <div className="flex items-center gap-3">
                              <span>Tonnage {tonnageForSet(set).toFixed(0)}</span>
                              <span>E1RM {e1rmForSet(set) ?? "-"}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-red-200"
                                onClick={() => void deleteSet(exercise.id, set.set_index, set.id)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                            <Input
                              type="number"
                              value={set.reps ?? ""}
                              placeholder="Reps"
                              onChange={(event) =>
                                void upsertSet(exercise.id, set.set_index, {
                                  reps: numberOrNull(event.target.value)
                                })
                              }
                            />
                            <Input
                              type="number"
                              value={set.weight ?? ""}
                              placeholder="Weight"
                              onChange={(event) =>
                                void upsertSet(exercise.id, set.set_index, {
                                  weight: numberOrNull(event.target.value)
                                })
                              }
                            />
                            <Input
                              type="number"
                              value={set.rpe ?? ""}
                              placeholder="RPE"
                              onChange={(event) =>
                                void upsertSet(exercise.id, set.set_index, {
                                  rpe: numberOrNull(event.target.value)
                                })
                              }
                            />
                            <Input
                              type="number"
                              value={set.rir ?? ""}
                              placeholder="RIR"
                              onChange={(event) =>
                                void upsertSet(exercise.id, set.set_index, {
                                  rir: numberOrNull(event.target.value)
                                })
                              }
                            />
                            <Input
                              value={set.tempo ?? ""}
                              placeholder="Tempo"
                              onChange={(event) =>
                                void upsertSet(exercise.id, set.set_index, {
                                  tempo: event.target.value || null
                                })
                              }
                            />
                            <Input
                              type="number"
                              value={set.rest_seconds ?? ""}
                              placeholder="Rest (sec)"
                              onChange={(event) =>
                                void upsertSet(exercise.id, set.set_index, {
                                  rest_seconds: numberOrNull(event.target.value)
                                })
                              }
                            />
                            <div className="flex items-center gap-2">
                              <Toggle
                                checked={set.is_amrap}
                                onCheckedChange={(checked) =>
                                  void upsertSet(exercise.id, set.set_index, {
                                    is_amrap: checked
                                  })
                                }
                              />
                              <span className="text-xs text-slate-300">AMRAP</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Toggle
                                checked={set.is_joker}
                                onCheckedChange={(checked) =>
                                  void upsertSet(exercise.id, set.set_index, {
                                    is_joker: checked
                                  })
                                }
                              />
                              <span className="text-xs text-slate-300">Joker</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <CheckCircle size={14} className="text-emerald-300" />
                        <span>
                          Session tonnage: {sessionTonnage.toFixed(0)} - Exercise tonnage:{" "}
                          {exerciseTonnage.toFixed(0)}
                        </span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void addSet(exercise.id)}>
                        <Plus size={16} className="mr-2" />
                        Add set
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card className="flex items-start gap-3 bg-slate-950/80 p-4">
        <WifiOff size={18} className="text-amber-300" />
        <div className="space-y-1 text-sm text-slate-300">
          <p className="font-semibold text-white">Offline-first logging</p>
          <p>
            Every action is queued with a local sequence. When back online, we post to
            /api/sync, persist to Supabase, advance your cursor, and return the
            authoritative session state.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1">
              <Check size={14} /> Toggle completion
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1">
              <Check size={14} /> Set CRUD
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1">
              <Check size={14} /> Pain + injuries + bodyweight
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
