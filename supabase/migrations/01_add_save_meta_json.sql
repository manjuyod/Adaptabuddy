-- Add optional save state metadata for user progress
alter table public.users
add column if not exists save_meta_json jsonb not null default '{}'::jsonb;
