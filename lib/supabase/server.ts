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
};

type Database = {
  public: {
    Tables: {
      users: {
        Row: UserProfile;
        Insert: {
          user_id: string;
          active_program_json?: Record<string, unknown> | null;
        };
        Update: {
          active_program_json?: Record<string, unknown> | null;
        };
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
): value is { user_id: string; active_program_json?: unknown } => {
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
    throw new Error(
      upsertResult.error instanceof Error
        ? upsertResult.error.message
        : "Failed to ensure user profile."
    );
  }

  const { data, error } = await userClient
    .from("users")
    .select("user_id, active_program_json")
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
  const activeProgram = isRecord(active_program_json) ? active_program_json : null;

  return {
    user_id,
    active_program_json: activeProgram
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
