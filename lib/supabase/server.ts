import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { appConfig } from "../config";

type GenericRelationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type GenericView = {
  Row: Record<string, unknown>;
  Relationships: GenericRelationship[];
};

type GenericFunction = { Args: Record<string, unknown>; Returns: unknown };

export type UserProfile = {
  user_id: string;
  active_program_json: Record<string, unknown> | null;
  injuries: unknown[];
  preferences: Record<string, unknown>;
  bodyweight: number | null;
  offline_sync_cursor: number;
  active_program_version?: number;
  units_pref?: string;
  unit_conversion?: number;
  sex?: string;
};

type MuscleGroupRow = {
  id: number;
  name: string;
  slug: string;
  region: string;
  parent_id: number | null;
  created_at: string | null;
};

type MuscleGroupInsert = {
  id?: number;
  name: string;
  slug: string;
  region: string;
  parent_id?: number | null;
  created_at?: string | null;
};

type MuscleGroupUpdate = Partial<MuscleGroupInsert>;

type ExerciseRow = {
  id: number;
  canonical_name: string;
  aliases: string[] | null;
  movement_pattern: string;
  equipment: string[] | null;
  is_bodyweight: boolean | null;
  primary_muscle_group_id: number | null;
  secondary_muscle_group_ids: number[] | null;
  tags: string[] | null;
  contraindications: unknown;
  default_warmups: unknown;
  default_warmdowns: unknown;
  media: unknown;
  created_at: string | null;
};

type ExerciseInsert = {
  id?: number;
  canonical_name: string;
  aliases?: string[] | null;
  movement_pattern: string;
  equipment?: string[] | null;
  is_bodyweight?: boolean | null;
  primary_muscle_group_id?: number | null;
  secondary_muscle_group_ids?: number[] | null;
  tags?: string[] | null;
  contraindications?: unknown;
  default_warmups?: unknown;
  default_warmdowns?: unknown;
  media?: unknown;
  created_at?: string | null;
};

type ExerciseUpdate = Partial<ExerciseInsert>;

type TemplateRow = {
  id: number;
  name: string;
  disciplines: string[];
  methodology: string | null;
  version: number;
  template_json: unknown;
  created_at: string | null;
};

type TemplateInsert = {
  id?: number;
  name: string;
  disciplines?: string[];
  methodology?: string | null;
  version?: number;
  template_json?: unknown;
  created_at?: string | null;
};

type TemplateUpdate = Partial<TemplateInsert>;

type UserRow = {
  user_id: string;
  display_name: string | null;
  units_pref: "lbs" | "kg";
  unit_conversion: number;
  bodyweight: number | null;
  sex: "male" | "female";
  injuries: unknown[];
  preferences: Record<string, unknown>;
  active_program_json: Record<string, unknown> | null;
  active_program_version: number;
  offline_sync_cursor: number;
  created_at: string | null;
  updated_at: string | null;
};

type TrainingExerciseRow = {
  id: number;
  session_id: number | null;
  exercise_id: number | null;
  exercise_key: string;
  name: string;
  tags: string[];
  movement_pattern: string | null;
  primary_muscle_group_id: number | null;
  secondary_muscle_group_ids: number[];
  is_completed: boolean | null;
  pain_score: number | null;
  order_index: number;
};

type TrainingExerciseInsert = {
  id?: number;
  session_id?: number | null;
  exercise_id?: number | null;
  exercise_key: string;
  name: string;
  tags?: string[];
  movement_pattern?: string | null;
  primary_muscle_group_id?: number | null;
  secondary_muscle_group_ids?: number[];
  is_completed?: boolean | null;
  pain_score?: number | null;
  order_index?: number;
};

type TrainingExerciseUpdate = Partial<TrainingExerciseInsert>;

type TrainingSetRow = {
  id: number;
  exercise_id: number | null;
  set_index: number;
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  rir: number | null;
  tempo: string | null;
  rest_seconds: number | null;
  is_amrap: boolean | null;
  is_joker: boolean | null;
  created_at: string | null;
};

type TrainingSetInsert = {
  id?: number;
  exercise_id: number;
  set_index: number;
  reps?: number | null;
  weight?: number | null;
  rpe?: number | null;
  rir?: number | null;
  tempo?: string | null;
  rest_seconds?: number | null;
  is_amrap?: boolean | null;
  is_joker?: boolean | null;
};

type TrainingSetUpdate = Partial<TrainingSetInsert>;

type PushSubscriptionRow = {
  id: number;
  user_id: string | null;
  subscription: unknown;
  created_at: string | null;
};

type PushSubscriptionInsert = {
  id?: number;
  user_id: string;
  subscription: unknown;
  created_at?: string | null;
};

type PushSubscriptionUpdate = Partial<PushSubscriptionInsert>;

type SyncEventRow = {
  id: number;
  user_id: string | null;
  event_id: string;
  local_seq: number;
  ts: string;
  type: string;
  payload: unknown;
  created_at: string | null;
};

type SyncEventInsert = {
  id?: number;
  user_id: string;
  event_id: string;
  local_seq: number;
  ts: string;
  type: string;
  payload: unknown;
  created_at?: string | null;
};

type SyncEventUpdate = Partial<SyncEventInsert>;

type TrainingSessionRow = {
  id: number;
  user_id: string | null;
  session_date: string;
  program_session_key: string;
  plan_id: string | null;
  week_key: string | null;
  status: string | null;
  reschedule_flag: boolean | null;
  inconsistency_score: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type TrainingSessionInsert = {
  id?: number;
  user_id: string;
  session_date: string;
  program_session_key: string;
  plan_id?: string | null;
  week_key?: string | null;
  status?: string | null;
  reschedule_flag?: boolean | null;
  inconsistency_score?: number | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type TrainingSessionUpdate = Partial<TrainingSessionInsert>;

export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: {
          user_id: string;
          display_name?: string | null;
          units_pref?: string;
          unit_conversion?: number;
          bodyweight?: number;
          sex?: string;
          injuries?: unknown;
          preferences?: Record<string, unknown>;
          active_program_json?: Record<string, unknown> | null;
          active_program_version?: number;
          offline_sync_cursor?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          active_program_json?: Record<string, unknown> | null;
          injuries?: unknown;
          preferences?: Record<string, unknown>;
          bodyweight?: number | null;
          offline_sync_cursor?: number;
          active_program_version?: number;
          units_pref?: string;
          unit_conversion?: number;
          sex?: string;
        };
        Relationships: GenericRelationship[];
      };
      muscle_groups: {
        Row: MuscleGroupRow;
        Insert: MuscleGroupInsert;
        Update: MuscleGroupUpdate;
        Relationships: GenericRelationship[];
      };
      exercises: {
        Row: ExerciseRow;
        Insert: ExerciseInsert;
        Update: ExerciseUpdate;
        Relationships: GenericRelationship[];
      };
      templates: {
        Row: TemplateRow;
        Insert: TemplateInsert;
        Update: TemplateUpdate;
        Relationships: GenericRelationship[];
      };
      training_sessions: {
        Row: TrainingSessionRow;
        Insert: TrainingSessionInsert;
        Update: TrainingSessionUpdate;
        Relationships: GenericRelationship[];
      };
      training_exercises: {
        Row: TrainingExerciseRow;
        Insert: TrainingExerciseInsert;
        Update: TrainingExerciseUpdate;
        Relationships: GenericRelationship[];
      };
      training_sets: {
        Row: TrainingSetRow;
        Insert: TrainingSetInsert;
        Update: TrainingSetUpdate;
        Relationships: GenericRelationship[];
      };
      sync_events: {
        Row: SyncEventRow;
        Insert: SyncEventInsert;
        Update: SyncEventUpdate;
        Relationships: GenericRelationship[];
      };
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: PushSubscriptionInsert;
        Update: PushSubscriptionUpdate;
        Relationships: GenericRelationship[];
      };
    };
    Views: Record<string, GenericView>;
    Functions: Record<string, GenericFunction>;
    Enums: Record<string, never>;
    CompositeTypes?: Record<string, never>;
  };
};

type SupabaseCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

type CookieStore = {
  getAll: () => SupabaseCookie[];
  set: (name: string, value: string, options?: CookieOptions) => void;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isUserProfilePayload = (
  value: unknown
): value is {
  user_id: string;
  active_program_json?: unknown;
  injuries?: unknown;
  preferences?: unknown;
  bodyweight?: unknown;
  offline_sync_cursor?: unknown;
  active_program_version?: unknown;
  units_pref?: unknown;
  unit_conversion?: unknown;
  sex?: unknown;
} => {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { user_id?: unknown }).user_id === "string"
  );
};

const createClient = (cookieStore: CookieStore) =>
  createServerClient<Database>(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: SupabaseCookie[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      }
    }
  });

export type SupabaseClientType = SupabaseClient<Database>;

export const createSupabaseServerClient = async (): Promise<SupabaseClientType> => {
  const cookieStore = await cookies();
  return createClient({
    getAll: () => cookieStore.getAll(),
    set: (name, value, options) => {
      cookieStore.set(name, value, options);
    }
  }) as unknown as SupabaseClientType;
};

export const createSupabaseRouteClient = (
  request: NextRequest,
  response: NextResponse
): SupabaseClientType =>
  createClient({
    getAll: () => request.cookies.getAll(),
    set: (name, value, options) => {
      response.cookies.set(name, value, options);
    }
  }) as unknown as SupabaseClientType;

export const ensureUserProfile = async (
  supabase: SupabaseClientType,
  user: User
): Promise<UserProfile> => {
  type UsersTableClient = {
    from: (
      table: "users"
    ) => {
      upsert: (
        values: { user_id: string },
        options: { onConflict?: string }
      ) => Promise<{ error: unknown }>;
      select: (columns: string) => {
        eq: (
          column: string,
          value: string
        ) => {
          maybeSingle: () => Promise<{
            data: unknown;
            error: unknown;
          }>;
        };
      };
    };
  };

  // TODO: replace manual typing with generated Supabase types.
  const userClient = supabase as unknown as UsersTableClient;
  const upsertResult = await userClient
    .from("users")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });
  if (upsertResult.error) {
    const err = upsertResult.error as { message?: string };
    throw new Error(
      typeof err.message === "string"
        ? err.message
        : "Failed to ensure user profile."
    );
  }

  const { data, error } = await userClient
    .from("users")
    .select(
      "user_id, active_program_json, injuries, preferences, bodyweight, offline_sync_cursor, active_program_version, units_pref, unit_conversion, sex"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(
      error instanceof Error ? error.message : "Failed to load user profile."
    );
  }
  const profileRow = data;

  if (!isUserProfilePayload(profileRow)) {
    throw new Error("User profile not found after upsert.");
  }

  const {
    user_id,
    active_program_json,
    bodyweight,
    offline_sync_cursor = 0,
    active_program_version,
    units_pref,
    unit_conversion,
    sex
  } = profileRow;
  const injuries = Array.isArray(profileRow.injuries) ? profileRow.injuries : [];
  const preferences = isRecord(profileRow.preferences) ? profileRow.preferences : {};
  const activeProgram = isRecord(active_program_json) ? active_program_json : null;

  return {
    user_id,
    active_program_json: activeProgram,
    injuries,
    preferences,
    bodyweight: typeof bodyweight === "number" ? bodyweight : null,
    offline_sync_cursor:
      typeof offline_sync_cursor === "number" && Number.isFinite(offline_sync_cursor)
        ? offline_sync_cursor
        : 0,
    active_program_version:
      typeof active_program_version === "number" ? active_program_version : undefined,
    units_pref: typeof units_pref === "string" ? units_pref : undefined,
    unit_conversion: typeof unit_conversion === "number" ? unit_conversion : undefined,
    sex: typeof sex === "string" ? sex : undefined
  };
};

export const getSessionWithProfile = async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }

  const user = data.user;
  if (!user) {
    return { supabase, user: null, profile: null };
  }

  const profile = await ensureUserProfile(supabase, user);
  return { supabase, user, profile };
};
