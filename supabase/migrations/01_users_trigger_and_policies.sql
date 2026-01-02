-- Ensure a public.users row exists for every auth.users insert
create or replace function public.handle_auth_user_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_insert();

-- RLS hardening: deny delete by default (service role policy still applies)
drop policy if exists "Users: Delete own" on public.users;
