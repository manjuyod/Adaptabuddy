import "server-only";

import { createClient } from "@supabase/supabase-js";
import { appConfig } from "../config";

/**
 * Server-only Supabase client with the service role key.
 * Never import this into the client/runtime; it bypasses RLS.
 */
export const createSupabaseAdminClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for admin client.");
  }

  return createClient(appConfig.supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};
