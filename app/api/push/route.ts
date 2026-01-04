import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createSupabaseServerClient,
  type SupabaseClientType
} from "@/lib/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string()
  })
});

export async function POST(request: NextRequest) {
  const supabase: SupabaseClientType = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let subscription: unknown;
  try {
    subscription = subscriptionSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid subscription", details: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: authData.user.id, subscription },
      { onConflict: "user_id" }
    );

  if (error) {
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "subscribed" });
}

export async function DELETE() {
  const supabase: SupabaseClientType = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", authData.user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to remove subscription" },
      { status: 500 }
    );
  }

  return NextResponse.json({ status: "unsubscribed" });
}
