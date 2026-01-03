import type { WizardInjury } from "@/lib/wizard/types";

export type TrainingSet = {
  id: number | null;
  exercise_id: number;
  set_index: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  rir: number | null;
  tempo: string | null;
  rest_seconds: number | null;
  is_amrap: boolean;
  is_joker: boolean;
};

export type TrainingExercise = {
  id: number;
  session_id: number | null;
  exercise_id: number | null;
  exercise_key: string;
  name: string;
  tags: string[];
  movement_pattern: string | null;
  primary_muscle_group_id: number | null;
  secondary_muscle_group_ids: number[];
  is_completed: boolean;
  pain_score: number | null;
  order_index: number;
  sets: TrainingSet[];
};

export type TrainingSession = {
  id: number;
  session_date: string;
  status: string | null;
  program_session_key: string;
  notes: string | null;
  exercises: TrainingExercise[];
};

export type SessionCache = {
  session: TrainingSession | null;
  bodyweight: number | null;
  injuries: WizardInjury[];
  cachedAt: number;
};

export type SyncEventType =
  | "UPSERT_SET"
  | "DELETE_SET"
  | "TOGGLE_EXERCISE"
  | "UPDATE_PAIN"
  | "UPDATE_BODYWEIGHT"
  | "UPDATE_INJURIES";

type BaseEvent<T extends SyncEventType, P> = {
  event_id: string;
  user_id: string;
  ts: string;
  type: T;
  payload: P;
  local_seq?: number;
};

export type UpsertSetEvent = BaseEvent<
  "UPSERT_SET",
  {
    id?: number | null;
    exercise_id: number;
    set_index: number;
    reps?: number | null;
    weight?: number | null;
    rpe?: number | null;
    rir?: number | null;
    tempo?: string | null;
    rest_seconds?: number | null;
    is_amrap?: boolean;
    is_joker?: boolean;
  }
>;

export type DeleteSetEvent = BaseEvent<
  "DELETE_SET",
  {
    exercise_id: number;
    set_id?: number;
    set_index?: number;
  }
>;

export type ToggleExerciseEvent = BaseEvent<
  "TOGGLE_EXERCISE",
  {
    exercise_id: number;
    is_completed: boolean;
  }
>;

export type UpdatePainEvent = BaseEvent<
  "UPDATE_PAIN",
  {
    exercise_id: number;
    pain_score: number | null;
  }
>;

export type UpdateBodyweightEvent = BaseEvent<
  "UPDATE_BODYWEIGHT",
  {
    bodyweight: number | null;
  }
>;

export type UpdateInjuriesEvent = BaseEvent<
  "UPDATE_INJURIES",
  {
    injuries: WizardInjury[];
  }
>;

export type SyncEvent =
  | UpsertSetEvent
  | DeleteSetEvent
  | ToggleExerciseEvent
  | UpdatePainEvent
  | UpdateBodyweightEvent
  | UpdateInjuriesEvent;

export type SyncRequestBody = {
  events: SyncEvent[];
  session_id?: number | null;
};

export type SyncResponseBody = {
  session: TrainingSession | null;
  offline_sync_cursor: number;
  bodyweight: number | null;
  injuries: WizardInjury[];
};
