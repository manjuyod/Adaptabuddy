import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
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

type TrainingSessionRow = {
  id: number;
  user_id: string | null;
  session_date: string;
  program_session_key: string;
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
  status?: string | null;
  reschedule_flag?: boolean | null;
  inconsistency_score?: number | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type TrainingSessionUpdate = Partial<TrainingSessionInsert>;

type Database = {
  public: {
    Tables: {
      users: {
        Row: UserProfile;
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
    };
    Views: Record<string, GenericView>;
    Functions: Record<string, GenericFunction>;
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

type SupabaseClientType = ReturnType<typeof createServerClient<Database>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isUserProfilePayload = (
  value: unknown
): value is {
  user_id: string;
  active_program_json?: unknown;
  injuries?: unknown;
  preferences?: unknown;
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

export const createSupabaseServerClient = async (): Promise<SupabaseClientType> => {
  const cookieStore = await cookies();
  return createClient({
    getAll: () => cookieStore.getAll(),
    set: (name, value, options) => {
      cookieStore.set(name, value, options);
    }
  });
};

export const createSupabaseRouteClient = (
  request: NextRequest,
  response: NextResponse
) =>
  createClient({
    getAll: () => request.cookies.getAll(),
    set: (name, value, options) => {
      response.cookies.set(name, value, options);
    }
  });

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
    .select("user_id, active_program_json, injuries, preferences")
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

  const { user_id, active_program_json } = profileRow;
  const injuries = Array.isArray(profileRow.injuries) ? profileRow.injuries : [];
  const preferences = isRecord(profileRow.preferences) ? profileRow.preferences : {};
  const activeProgram = isRecord(active_program_json) ? active_program_json : null;

  return {
    user_id,
    active_program_json: activeProgram,
    injuries,
    preferences
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
