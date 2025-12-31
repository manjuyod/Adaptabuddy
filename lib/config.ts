export const appConfig = {
  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "public-anon-key"
};
