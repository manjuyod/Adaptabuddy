import { createBrowserClient } from "@supabase/ssr";
import { appConfig } from "../config";

export const createSupabaseBrowserClient = () =>
  createBrowserClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey);
