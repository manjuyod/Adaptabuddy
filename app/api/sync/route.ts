import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createSupabaseRouteClient,
  ensureUserProfile,
  type SupabaseClientType
} from "@/lib/supabase/server";
import { loadUpcomingSession } from "@/lib/train/session-loader";
import type { SyncEvent, SyncResponseBody } from "@/lib/train/types";
import { ensureInjuryIds } from "@/lib/wizard/injuries";
import type { WizardInjury } from "@/lib/wizard/types";

const baseEventSchema = z.object({
  event_id: z.string().min(8),
  user_id: z.string(),
  ts: z.string(),
  local_seq: z.number().int().nonnegative().optional()
});

const upsertSetPayload = z.object({
  id: z.number().optional().nullable(),
  exercise_id: z.number(),
  set_index: z.number(),
  reps: z.number().nullable().optional(),
  weight: z.number().nullable().optional(),
  rpe: z.number().nullable().optional(),
  rir: z.number().nullable().optional(),
  tempo: z.string().nullable().optional(),
  rest_seconds: z.number().nullable().optional(),
  is_amrap: z.boolean().optional(),
  is_joker: z.boolean().optional()
});

const deleteSetPayload = z
  .object({
    exercise_id: z.number(),
    set_id: z.number().optional(),
    set_index: z.number().optional()
  })
  .refine(
    (payload) => payload.set_id !== undefined || typeof payload.set_index === "number",
    { message: "Provide set_id or set_index to delete a training set." }
  );

const toggleExercisePayload = z.object({
  exercise_id: z.number(),
  is_completed: z.boolean()
});

const updatePainPayload = z.object({
  exercise_id: z.number(),
  pain_score: z.number().nullable()
});

const updateBodyweightPayload = z.object({
  bodyweight: z.number().nullable()
});

const injurySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  severity: z.number().int(),
  notes: z.string().optional()
});

const updateInjuriesPayload = z.object({
  injuries: z.array(injurySchema)
});

const syncEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("UPSERT_SET"),
    payload: upsertSetPayload
  }).merge(baseEventSchema),
  z.object({
    type: z.literal("DELETE_SET"),
    payload: deleteSetPayload
  }).merge(baseEventSchema),
  z.object({
    type: z.literal("TOGGLE_EXERCISE"),
    payload: toggleExercisePayload
  }).merge(baseEventSchema),
  z.object({
    type: z.literal("UPDATE_PAIN"),
    payload: updatePainPayload
  }).merge(baseEventSchema),
  z.object({
    type: z.literal("UPDATE_BODYWEIGHT"),
    payload: updateBodyweightPayload
  }).merge(baseEventSchema),
  z.object({
    type: z.literal("UPDATE_INJURIES"),
    payload: updateInjuriesPayload
  }).merge(baseEventSchema)
]);

const syncRequestSchema = z.object({
  events: z.array(syncEventSchema).default([])
});

const parseInjuries = (value: unknown): WizardInjury[] => {
  if (!Array.isArray(value)) return [];
  const parsed = value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) return null;
      const name = (entry as { name?: unknown }).name;
      const severity = (entry as { severity?: unknown }).severity;
      const notes = (entry as { notes?: unknown }).notes;
      const id = (entry as { id?: unknown }).id;
      if (typeof name !== "string") return null;
      return {
        id: typeof id === "string" ? id : undefined,
        name,
        severity:
          typeof severity === "number" && Number.isFinite(severity)
            ? severity
            : 1,
        notes: typeof notes === "string" ? notes : undefined
      };
    })
    .filter(Boolean) as WizardInjury[];

  return ensureInjuryIds(parsed);
};

const applyEvents = async (params: {
  supabase: SupabaseClientType;
  events: SyncEvent[];
  userId: string;
}) => {
  const { supabase, events, userId } = params;
  let maxSeq = 0;
  let latestBodyweight: number | null | undefined = undefined;
  let latestInjuries: WizardInjury[] | undefined;

  for (const event of events) {
    maxSeq = Math.max(maxSeq, event.local_seq ?? 0);
    const { data: inserted, error: insertError } = await supabase
      .from("sync_events")
      .upsert(
        {
          user_id: userId,
          event_id: event.event_id,
          local_seq: event.local_seq ?? 0,
          ts: event.ts,
          type: event.type,
          payload: event.payload
        },
        { onConflict: "user_id,event_id", ignoreDuplicates: true }
      )
      .select("event_id");

    if (insertError) {
      throw new Error(
        insertError instanceof Error
          ? insertError.message
          : "Failed to record sync event."
      );
    }

    const isNew = (inserted?.length ?? 0) > 0;
    if (!isNew) {
      continue;
    }

    if (event.type === "UPSERT_SET") {
      const payload = event.payload;
      const { error } = await supabase
        .from("training_sets")
        .upsert(
          {
            id: payload.id ?? undefined,
            exercise_id: payload.exercise_id,
            set_index: payload.set_index,
            reps: payload.reps ?? null,
            weight: payload.weight ?? null,
            rpe: payload.rpe ?? null,
            rir: payload.rir ?? null,
            tempo: payload.tempo ?? null,
            rest_seconds: payload.rest_seconds ?? null,
            is_amrap: payload.is_amrap ?? false,
            is_joker: payload.is_joker ?? false
          },
          { onConflict: "exercise_id,set_index" }
        );
      if (error) {
        throw new Error(
          error instanceof Error ? error.message : "Failed to upsert training set."
        );
      }
    } else if (event.type === "DELETE_SET") {
      const payload = event.payload;
      if (payload.set_id === undefined && typeof payload.set_index !== "number") {
        throw new Error("DELETE_SET payload must include set_id or set_index.");
      }
      let query = supabase.from("training_sets").delete().eq("exercise_id", payload.exercise_id);
      if (payload.set_id) {
        query = query.eq("id", payload.set_id);
      } else if (typeof payload.set_index === "number") {
        query = query.eq("set_index", payload.set_index);
      }
      const { error } = await query;
      if (error) {
        throw new Error(
          error instanceof Error ? error.message : "Failed to delete training set."
        );
      }
    } else if (event.type === "TOGGLE_EXERCISE") {
      const { error } = await supabase
        .from("training_exercises")
        .update({ is_completed: event.payload.is_completed })
        .eq("id", event.payload.exercise_id);
      if (error) {
        throw new Error(
          error instanceof Error ? error.message : "Failed to toggle exercise."
        );
      }
    } else if (event.type === "UPDATE_PAIN") {
      const { error } = await supabase
        .from("training_exercises")
        .update({ pain_score: event.payload.pain_score })
        .eq("id", event.payload.exercise_id);
      if (error) {
        throw new Error(
          error instanceof Error ? error.message : "Failed to update pain score."
        );
      }
    } else if (event.type === "UPDATE_BODYWEIGHT") {
      latestBodyweight = event.payload.bodyweight ?? null;
      const { error } = await supabase
        .from("users")
        .update({ bodyweight: latestBodyweight })
        .eq("user_id", userId);
      if (error) {
        throw new Error(
          error instanceof Error ? error.message : "Failed to update bodyweight."
        );
      }
    } else if (event.type === "UPDATE_INJURIES") {
      latestInjuries = parseInjuries(event.payload.injuries);
      const { error } = await supabase
        .from("users")
        .update({ injuries: latestInjuries })
        .eq("user_id", userId);
      if (error) {
        throw new Error(
          error instanceof Error ? error.message : "Failed to update injuries."
        );
      }
    }
  }

  return {
    maxSeq,
    latestBodyweight,
    latestInjuries
  };
};

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase: SupabaseClientType = createSupabaseRouteClient(request, response);

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: response.headers }
    );
  }

  let events: SyncEvent[] = [];
  try {
    const body: unknown = await request.json();
    const parsed = syncRequestSchema.parse(body);
    events = parsed.events.map((event) => {
      const ts = new Date(event.ts).toISOString();
      if (event.type === "UPDATE_INJURIES") {
        return {
          ...event,
          user_id: authData.user.id,
          ts,
          payload: { injuries: ensureInjuryIds(event.payload.injuries) }
        } satisfies SyncEvent;
      }
      return {
        ...event,
        user_id: authData.user.id,
        ts
      } satisfies SyncEvent;
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid payload", details: error instanceof Error ? error.message : String(error) },
      { status: 400, headers: response.headers }
    );
  }

  const profile = await ensureUserProfile(supabase, authData.user);
  let applied: Awaited<ReturnType<typeof applyEvents>>;
  try {
    applied = await applyEvents({ supabase, events, userId: authData.user.id });
  } catch (error) {
    return NextResponse.json(
      { error: "Sync failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: response.headers }
    );
  }
  const nextCursor = Math.max(profile.offline_sync_cursor ?? 0, applied.maxSeq);

  if (events.length > 0 || nextCursor !== profile.offline_sync_cursor) {
    const { error: cursorError } = await supabase
      .from("users")
      .update({ offline_sync_cursor: nextCursor })
      .eq("user_id", authData.user.id);
    if (cursorError) {
      return NextResponse.json(
        { error: "Failed to advance cursor" },
        { status: 500, headers: response.headers }
      );
    }
  }

  let session = null;
  try {
    session = await loadUpcomingSession(supabase, authData.user.id);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load session after sync", details: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: response.headers }
    );
  }
  const responseBody: SyncResponseBody = {
    session,
    offline_sync_cursor: nextCursor,
    bodyweight:
      applied.latestBodyweight ?? profile.bodyweight ?? null,
    injuries: applied.latestInjuries ?? parseInjuries(profile.injuries)
  };

  return NextResponse.json(responseBody, { headers: response.headers });
}
