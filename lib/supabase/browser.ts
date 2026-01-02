/**
 * Browser-only Supabase client using the public anonymous key.
 */
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { appConfig } from "../config";

export const createSupabaseBrowserClient = () =>
  createBrowserClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey);
